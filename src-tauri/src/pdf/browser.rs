//! Échelons Edge et Chrome : navigateur Chromium lancé sans fenêtre (`headless_chrome`).

use std::io::Write;
use std::path::PathBuf;
use std::time::Duration;

use headless_chrome::types::PrintToPdfOptions;
use headless_chrome::{Browser as Chromium, LaunchOptions};

use super::STEP_TIMEOUT;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Browser {
    Edge,
    Chrome,
}

/// Chemins candidats d'Edge : valeur du registre (App Paths) d'abord, puis les emplacements standards.
pub fn edge_paths(get_env: &dyn Fn(&str) -> Option<String>, registry: Option<String>) -> Vec<PathBuf> {
    standard_paths(get_env, registry, "Microsoft/Edge/Application/msedge.exe")
}

/// Chemins candidats de Chrome : registre, puis emplacements standards.
pub fn chrome_paths(get_env: &dyn Fn(&str) -> Option<String>, registry: Option<String>) -> Vec<PathBuf> {
    standard_paths(get_env, registry, "Google/Chrome/Application/chrome.exe")
}

fn standard_paths(get_env: &dyn Fn(&str) -> Option<String>, registry: Option<String>, relative: &str) -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();
    if let Some(p) = registry.filter(|p| !p.trim().is_empty()) {
        out.push(PathBuf::from(p.trim_matches('"')));
    }
    for var in ["ProgramFiles", "ProgramFiles(x86)", "LocalAppData"] {
        if let Some(base) = get_env(var).filter(|b| !b.is_empty()) {
            let p = PathBuf::from(base).join(relative);
            if !out.contains(&p) {
                out.push(p);
            }
        }
    }
    out
}

#[cfg(windows)]
fn registry_app_path(exe: &str) -> Option<String> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;
    let key = format!(r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{exe}");
    [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER]
        .iter()
        .find_map(|hive| RegKey::predef(*hive).open_subkey(&key).ok()?.get_value::<String, _>("").ok())
}

#[cfg(not(windows))]
fn registry_app_path(_exe: &str) -> Option<String> {
    None
}

/// Cherche l'exécutable du navigateur demandé.
pub fn find(browser: Browser) -> Option<PathBuf> {
    let env = |name: &str| std::env::var(name).ok();
    let mut candidates = match browser {
        Browser::Edge => edge_paths(&env, registry_app_path("msedge.exe")),
        Browser::Chrome => chrome_paths(&env, registry_app_path("chrome.exe")),
    };
    if !cfg!(windows) {
        // Développement Linux/macOS : exécutables du PATH.
        let names: &[&str] = match browser {
            Browser::Edge => &["microsoft-edge", "microsoft-edge-stable", "msedge"],
            Browser::Chrome => &["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"],
        };
        if let Some(path) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&path) {
                candidates.extend(names.iter().map(|n| dir.join(n)));
            }
        }
        if browser == Browser::Chrome {
            if let Ok(p) = headless_chrome::browser::default_executable() {
                candidates.push(p);
            }
        }
    }
    candidates.into_iter().find(|p| p.is_file())
}

fn render_blocking(exe: PathBuf, html: String) -> Result<Vec<u8>, String> {
    let mut temp_file = tempfile::Builder::new().suffix(".html").tempfile().map_err(|e| e.to_string())?;
    temp_file.write_all(html.as_bytes()).map_err(|e| e.to_string())?;
    let temp_path = temp_file.into_temp_path();
    let file_url = url::Url::from_file_path(&temp_path)
        .map_err(|_| "chemin du fichier temporaire invalide".to_string())?
        .to_string();

    let browser = Chromium::new(
        LaunchOptions::default_builder()
            .path(Some(exe))
            .headless(true)
            // Exécution en root (conteneurs, CI Linux) : le bac à sable de Chromium doit être désactivé.
            .sandbox(std::env::var_os("PHENIXCV_NO_SANDBOX").is_none())
            .idle_browser_timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let tab = browser.new_tab().map_err(|e| e.to_string())?;
    tab.set_default_timeout(STEP_TIMEOUT);
    tab.navigate_to(&file_url).map_err(|e| e.to_string())?;
    tab.wait_until_navigated().map_err(|e| e.to_string())?;
    tab.print_to_pdf(Some(PrintToPdfOptions {
        landscape: Some(false),
        display_header_footer: Some(false),
        print_background: Some(true),
        scale: Some(1.0),
        paper_width: Some(8.27),
        paper_height: Some(11.69),
        margin_top: Some(0.0),
        margin_bottom: Some(0.0),
        margin_left: Some(0.0),
        margin_right: Some(0.0),
        page_ranges: None,
        ignore_invalid_page_ranges: None,
        header_template: None,
        footer_template: None,
        prefer_css_page_size: Some(true),
        transfer_mode: None,
        generate_document_outline: None,
        generate_tagged_pdf: None,
    }))
    .map_err(|e| e.to_string())
}

/// Imprime le HTML en PDF avec le navigateur demandé ; erreur claire s'il est introuvable ou trop lent.
pub async fn print(browser: Browser, html: &str) -> Result<Vec<u8>, String> {
    let name = if browser == Browser::Edge { "Edge" } else { "Chrome" };
    let exe = find(browser).ok_or_else(|| format!("{name} est introuvable sur cet ordinateur"))?;
    let html = html.to_string();
    let job = tauri::async_runtime::spawn_blocking(move || render_blocking(exe, html));
    // Un navigateur qui ne répond plus ne doit pas bloquer l'application : le processus est arrêté
    // quand la tâche finit (délai d'inactivité), et on passe à l'échelon suivant.
    match tokio::time::timeout(STEP_TIMEOUT * 2, job).await {
        Ok(Ok(res)) => res,
        Ok(Err(e)) => Err(format!("{name} : tâche interrompue ({e})")),
        Err(_) => Err(format!("{name} : délai dépassé ({} s)", (STEP_TIMEOUT * 2).as_secs())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env(map: &'static [(&'static str, &'static str)]) -> impl Fn(&str) -> Option<String> {
        move |k| map.iter().find(|(n, _)| *n == k).map(|(_, v)| v.to_string())
    }

    #[test]
    fn edge_registre_puis_emplacements_standards() {
        let get = env(&[("ProgramFiles", r"C:\Program Files"), ("ProgramFiles(x86)", r"C:\Program Files (x86)"), ("LocalAppData", r"C:\Users\x\AppData\Local")]);
        let paths = edge_paths(&get, Some(r#""C:\Edge\msedge.exe""#.to_string()));
        assert_eq!(paths[0], PathBuf::from(r"C:\Edge\msedge.exe"));
        assert_eq!(paths.len(), 4);
        assert!(paths[1].ends_with("Microsoft/Edge/Application/msedge.exe"));
        assert!(paths[1].starts_with(r"C:\Program Files"));
        assert!(paths[2].starts_with(r"C:\Program Files (x86)"));
    }

    #[test]
    fn sans_registre_ni_variables() {
        assert!(edge_paths(&env(&[]), None).is_empty());
        assert!(chrome_paths(&env(&[]), Some("  ".into())).is_empty());
    }

    #[test]
    fn chrome_emplacements_standards() {
        let paths = chrome_paths(&env(&[("ProgramFiles", r"C:\PF")]), None);
        assert_eq!(paths.len(), 1);
        assert!(paths[0].ends_with("Google/Chrome/Application/chrome.exe"));
    }
}

#[cfg(test)]
mod integration {
    use super::*;

    /// Rendu réel avec le navigateur indiqué par `PHENIXCV_TEST_CHROME` (ignoré sans lui) :
    /// le PDF doit faire une page, contenir le texte attendu et embarquer ses polices.
    #[test]
    fn pdf_d_une_page_avec_texte_et_polices_embarquees() {
        let Ok(exe) = std::env::var("PHENIXCV_TEST_CHROME") else {
            eprintln!("PHENIXCV_TEST_CHROME absent : test ignoré");
            return;
        };
        let html = include_str!("../../../tests/pdf-selftest/cv.html").to_string();
        let pdf = render_blocking(PathBuf::from(exe), html).expect("rendu PDF");
        assert!(pdf.starts_with(b"%PDF"));
        let path = std::env::temp_dir().join("phenixcv-selftest.pdf");
        std::fs::write(&path, &pdf).unwrap();
        let info = std::process::Command::new("pdfinfo").arg(&path).output();
        let Ok(info) = info else { return eprintln!("pdfinfo absent : vérifications suivantes ignorées") };
        assert!(String::from_utf8_lossy(&info.stdout).contains("Pages:           1"), "une seule page attendue");
        let text = std::process::Command::new("pdftotext").arg(&path).arg("-").output().unwrap();
        assert!(String::from_utf8_lossy(&text.stdout).contains("Camille Martin"));
        let fonts = std::process::Command::new("pdffonts").arg(&path).output().unwrap();
        let rows: Vec<String> = String::from_utf8_lossy(&fonts.stdout).lines().skip(2).map(String::from).collect();
        assert!(!rows.is_empty(), "aucune police dans le PDF");
        assert!(rows.iter().all(|l| l.contains(" yes ")), "police non embarquée : {rows:?}");
    }
}
