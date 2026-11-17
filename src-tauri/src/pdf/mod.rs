//! Export PDF vectoriel, avec échelle de repli.
//!
//! Ordre en mode automatique : WebView2 (`PrintToPdf`, sans dépendance externe) → Edge → Chrome.
//! L'impression système est le dernier recours, côté interface (elle exige l'avis de l'utilisateur).
//! Chaque tentative est journalisée dans `pdf-export-last.json` (dossier de données de l'application).

mod browser;
mod webview2;

use std::path::PathBuf;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// Délai maximal d'une étape (navigation, impression) avant de passer à l'échelon suivant.
pub const STEP_TIMEOUT: Duration = Duration::from_secs(20);
/// Variable d'environnement qui impose la méthode (prioritaire sur le réglage de l'application).
pub const METHOD_ENV: &str = "PHENIXCV_PDF_METHOD";
const LOG_FILE: &str = "pdf-export-last.json";

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Method {
    #[serde(rename = "webview2")]
    WebView2,
    Edge,
    Chrome,
}

impl Method {
    pub fn as_str(self) -> &'static str {
        match self {
            Method::WebView2 => "webview2",
            Method::Edge => "edge",
            Method::Chrome => "chrome",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Requested {
    Auto,
    Only(Method),
}

/// Lit une méthode demandée. « système » n'est pas géré ici : l'interface appelle l'impression système sans passer par Rust.
pub fn parse_requested(value: &str) -> Result<Requested, String> {
    match value.trim().to_lowercase().as_str() {
        "" | "auto" | "automatique" => Ok(Requested::Auto),
        "webview2" => Ok(Requested::Only(Method::WebView2)),
        "edge" => Ok(Requested::Only(Method::Edge)),
        "chrome" => Ok(Requested::Only(Method::Chrome)),
        other => Err(format!("méthode d'export PDF inconnue : « {other} »")),
    }
}

/// Échelons à essayer, dans l'ordre. WebView2 n'existe que sous Windows.
pub fn plan(requested: Requested, windows: bool) -> Vec<Method> {
    match requested {
        Requested::Auto if windows => vec![Method::WebView2, Method::Edge, Method::Chrome],
        Requested::Auto => vec![Method::Edge, Method::Chrome],
        Requested::Only(m) => vec![m],
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attempt {
    pub method: Method,
    pub ok: bool,
    pub duration_ms: u64,
    pub error: Option<String>,
}

/// Journal de la dernière tentative d'export (écrasé à chaque export).
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportLog {
    pub at_unix: u64,
    pub requested: String,
    pub attempts: Vec<Attempt>,
    pub final_method: Option<String>,
    pub bytes: usize,
    pub app_version: String,
    pub os: String,
    /// Renseigné quand l'interface a dû se rabattre sur l'impression système.
    pub system_print_reason: Option<String>,
}

fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn log_path(app: &AppHandle) -> Option<PathBuf> {
    // Mode portable : le journal reste dans `data/`, à côté de l'application.
    let dir = match crate::mode().data_dir() {
        Some(dir) => dir.to_path_buf(),
        None => app.path().app_data_dir().ok()?,
    };
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join(LOG_FILE))
}

fn write_log(app: &AppHandle, log: &ExportLog) {
    if let Some(path) = log_path(app) {
        if let Ok(json) = serde_json::to_string_pretty(log) {
            let _ = std::fs::write(path, json);
        }
    }
}

/// Résultat d'une exécution de l'échelle de repli.
pub struct Outcome {
    pub result: Result<(Vec<u8>, Method), String>,
    pub log: ExportLog,
}

async fn attempt(app: &AppHandle, method: Method, html: &str) -> Result<Vec<u8>, String> {
    match method {
        Method::WebView2 => webview2::print(app, html).await,
        Method::Edge => browser::print(browser::Browser::Edge, html).await,
        Method::Chrome => browser::print(browser::Browser::Chrome, html).await,
    }
}

/// Exécute l'échelle de repli ; chaque échec est consigné et on passe au suivant.
pub async fn run(app: &AppHandle, html: &str, requested_text: &str) -> Outcome {
    // La variable d'environnement l'emporte sur le réglage : le journal indique la méthode réellement demandée.
    let effective = std::env::var(METHOD_ENV)
        .ok()
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| requested_text.to_string());
    let requested = parse_requested(&effective);
    let mut log = ExportLog {
        at_unix: now_unix(),
        requested: effective,
        attempts: vec![],
        final_method: None,
        bytes: 0,
        app_version: app.package_info().version.to_string(),
        os: std::env::consts::OS.to_string(),
        system_print_reason: None,
    };
    let requested = match requested {
        Ok(r) => r,
        Err(e) => {
            write_log(app, &log);
            return Outcome { result: Err(e), log };
        }
    };
    let mut last_error = String::from("aucune méthode disponible");
    for method in plan(requested, cfg!(windows)) {
        let started = Instant::now();
        let res = attempt(app, method, html).await;
        let duration_ms = started.elapsed().as_millis() as u64;
        match res {
            Ok(bytes) => {
                log.attempts.push(Attempt { method, ok: true, duration_ms, error: None });
                log.final_method = Some(method.as_str().to_string());
                log.bytes = bytes.len();
                write_log(app, &log);
                return Outcome { result: Ok((bytes, method)), log };
            }
            Err(e) => {
                last_error = format!("{} : {e}", method.as_str());
                log.attempts.push(Attempt { method, ok: false, duration_ms, error: Some(e) });
            }
        }
    }
    write_log(app, &log);
    Outcome { result: Err(last_error), log }
}

#[derive(Serialize)]
pub struct PdfOutput {
    pub bytes: Vec<u8>,
    pub method: &'static str,
}

#[tauri::command]
pub async fn generate_pdf(app: AppHandle, html: String, method: Option<String>) -> Result<PdfOutput, String> {
    let outcome = run(&app, &html, method.as_deref().unwrap_or("auto")).await;
    outcome.result.map(|(bytes, m)| PdfOutput { bytes, method: m.as_str() })
}

/// Contenu du journal de la dernière tentative (JSON), pour « Copier les détails de l'erreur ».
#[tauri::command]
pub fn get_last_pdf_export_log(app: AppHandle) -> Option<String> {
    std::fs::read_to_string(log_path(&app)?).ok()
}

/// L'interface a dû utiliser l'impression système : on l'ajoute au journal existant.
#[tauri::command]
pub fn log_pdf_system_print(app: AppHandle, reason: String) {
    let Some(path) = log_path(&app) else { return };
    let mut log: ExportLog = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| ExportLog {
            at_unix: now_unix(),
            requested: "system".into(),
            attempts: vec![],
            final_method: None,
            bytes: 0,
            app_version: app.package_info().version.to_string(),
            os: std::env::consts::OS.to_string(),
            system_print_reason: None,
        });
    log.final_method = Some("system".into());
    log.system_print_reason = Some(reason);
    write_log(&app, &log);
}

/// Mode d'auto-test (CI) : `PHENIXCV_SELFTEST_HTML` (entrée) et `PHENIXCV_SELFTEST_PDF` (sortie).
/// Génère le PDF avec la méthode de `PHENIXCV_PDF_METHOD`, écrit `<sortie>.json` (journal) puis quitte
/// avec le code 0 en cas de succès, 1 sinon.
pub fn spawn_selftest_if_requested(app: &AppHandle) {
    let (Ok(html_path), Ok(pdf_path)) = (std::env::var("PHENIXCV_SELFTEST_HTML"), std::env::var("PHENIXCV_SELFTEST_PDF")) else {
        return;
    };
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let code = match std::fs::read_to_string(&html_path) {
            Err(_) => 1,
            Ok(html) => {
                let outcome = run(&app, &html, "auto").await;
                let _ = std::fs::write(
                    format!("{pdf_path}.json"),
                    serde_json::to_string_pretty(&outcome.log).unwrap_or_default(),
                );
                match outcome.result {
                    Ok((bytes, _)) => if std::fs::write(&pdf_path, bytes).is_ok() { 0 } else { 1 },
                    Err(_) => 1,
                }
            }
        };
        // `app.exit` ne propague pas le code de sortie au processus : on quitte explicitement.
        app.cleanup_before_exit();
        std::process::exit(code);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_des_methodes() {
        assert_eq!(parse_requested("auto"), Ok(Requested::Auto));
        assert_eq!(parse_requested(""), Ok(Requested::Auto));
        assert_eq!(parse_requested(" WebView2 "), Ok(Requested::Only(Method::WebView2)));
        assert_eq!(parse_requested("edge"), Ok(Requested::Only(Method::Edge)));
        assert_eq!(parse_requested("Chrome"), Ok(Requested::Only(Method::Chrome)));
        assert!(parse_requested("imprimante").is_err());
    }

    #[test]
    fn ordre_de_l_echelle() {
        assert_eq!(plan(Requested::Auto, true), vec![Method::WebView2, Method::Edge, Method::Chrome]);
        assert_eq!(plan(Requested::Auto, false), vec![Method::Edge, Method::Chrome]);
        assert_eq!(plan(Requested::Only(Method::Edge), true), vec![Method::Edge]);
    }

    #[test]
    fn journal_serialise_en_camel_case() {
        let log = ExportLog {
            at_unix: 1,
            requested: "auto".into(),
            attempts: vec![Attempt { method: Method::WebView2, ok: false, duration_ms: 12, error: Some("délai dépassé".into()) }],
            final_method: None,
            bytes: 0,
            app_version: "0.1.0".into(),
            os: "windows".into(),
            system_print_reason: None,
        };
        let json = serde_json::to_string(&log).unwrap();
        assert!(json.contains("\"durationMs\":12"));
        assert!(json.contains("\"method\":\"webview2\""));
        let back: ExportLog = serde_json::from_str(&json).unwrap();
        assert_eq!(back.attempts[0].method, Method::WebView2);
    }
}
