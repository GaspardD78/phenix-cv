//! Échelon principal (Windows) : `ICoreWebView2_7::PrintToPdf` sur une fenêtre WebView2 cachée.
//!
//! Aucun navigateur externe : le runtime WebView2 est déjà requis par l'application. La disponibilité de
//! l'interface est détectée à l'exécution (`cast`), pas en comparant des numéros de version ; si elle manque,
//! l'erreur est renvoyée et l'échelon suivant prend le relais. La fenêtre cachée est TOUJOURS détruite.

#[cfg(not(windows))]
pub async fn print(_app: &tauri::AppHandle, _html: &str) -> Result<Vec<u8>, String> {
    Err("WebView2 n'existe que sous Windows".to_string())
}

#[cfg(windows)]
pub async fn print(app: &tauri::AppHandle, html: &str) -> Result<Vec<u8>, String> {
    use std::sync::{Arc, Mutex};
    use tauri::webview::PageLoadEvent;
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    use tokio::sync::oneshot;

    use super::STEP_TIMEOUT;

    let dir = tempfile::tempdir().map_err(|e| format!("dossier temporaire : {e}"))?;
    let html_path = dir.path().join("cv.html");
    let pdf_path = dir.path().join("cv.pdf");
    std::fs::write(&html_path, html).map_err(|e| format!("écriture du HTML : {e}"))?;
    let url = url::Url::from_file_path(&html_path).map_err(|_| "chemin du HTML invalide".to_string())?;

    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let label = format!("pdf-export-{nanos}");

    let (nav_tx, nav_rx) = oneshot::channel::<()>();
    let nav_tx = Arc::new(Mutex::new(Some(nav_tx)));
    let nav_signal = nav_tx.clone();

    let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
        .visible(false)
        .focused(false)
        .skip_taskbar(true)
        .decorations(false)
        .resizable(false)
        .inner_size(794.0, 1123.0)
        .on_page_load(move |_w, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished) {
                if let Some(tx) = nav_signal.lock().ok().and_then(|mut g| g.take()) {
                    let _ = tx.send(());
                }
            }
        })
        .build()
        .map_err(|e| format!("création de la fenêtre cachée : {e}"))?;

    // Quoi qu'il arrive, la fenêtre cachée est détruite avant de rendre la main.
    let outcome = async {
        tokio::time::timeout(STEP_TIMEOUT, nav_rx)
            .await
            .map_err(|_| format!("délai dépassé pendant le chargement ({} s)", STEP_TIMEOUT.as_secs()))?
            .map_err(|_| "chargement interrompu".to_string())?;
        // Laisse le temps aux polices et aux images de se poser avant l'impression.
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;

        let (done_tx, done_rx) = oneshot::channel::<Result<(), String>>();
        let done_tx = Arc::new(Mutex::new(Some(done_tx)));
        let report = done_tx.clone();
        let target = pdf_path.clone();
        window
            .with_webview(move |webview| {
                let send = |res: Result<(), String>| {
                    if let Some(tx) = report.lock().ok().and_then(|mut g| g.take()) {
                        let _ = tx.send(res);
                    }
                };
                if let Err(e) = unsafe { start_print(&webview, &target, report.clone()) } {
                    send(Err(e));
                }
            })
            .map_err(|e| format!("accès à WebView2 : {e}"))?;
        tokio::time::timeout(STEP_TIMEOUT, done_rx)
            .await
            .map_err(|_| format!("délai dépassé pendant l'impression ({} s)", STEP_TIMEOUT.as_secs()))?
            .map_err(|_| "impression interrompue".to_string())??;
        std::fs::read(&pdf_path).map_err(|e| format!("lecture du PDF : {e}"))
    }
    .await;

    let _ = window.destroy();
    drop(dir);
    outcome
}

#[cfg(windows)]
type Reporter = std::sync::Arc<std::sync::Mutex<Option<tokio::sync::oneshot::Sender<Result<(), String>>>>>;

/// Lance `PrintToPdf` (A4, sans marges, fonds imprimés, sans en-têtes ni pieds de page).
#[cfg(windows)]
unsafe fn start_print(webview: &tauri::webview::PlatformWebview, target: &std::path::Path, report: Reporter) -> Result<(), String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_2, ICoreWebView2_7, ICoreWebView2Environment6, COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
    };
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{Interface, HSTRING};

    let err = |what: &str, e: windows::core::Error| format!("{what} : {e}");

    let core = webview.controller().CoreWebView2().map_err(|e| err("CoreWebView2", e))?;
    // Détection à l'exécution : l'interface existe ou non, sans comparer de numéro de version.
    let core7: ICoreWebView2_7 = core
        .cast()
        .map_err(|_| "ICoreWebView2_7 (PrintToPdf) absente : runtime WebView2 trop ancien".to_string())?;
    let env6: ICoreWebView2Environment6 = core
        .cast::<ICoreWebView2_2>()
        .map_err(|e| err("ICoreWebView2_2", e))?
        .Environment()
        .map_err(|e| err("Environment", e))?
        .cast()
        .map_err(|_| "ICoreWebView2Environment6 (CreatePrintSettings) absente : runtime WebView2 trop ancien".to_string())?;

    let settings = env6.CreatePrintSettings().map_err(|e| err("CreatePrintSettings", e))?;
    settings.SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT).map_err(|e| err("SetOrientation", e))?;
    settings.SetScaleFactor(1.0).map_err(|e| err("SetScaleFactor", e))?;
    settings.SetPageWidth(8.27).map_err(|e| err("SetPageWidth", e))?;
    settings.SetPageHeight(11.69).map_err(|e| err("SetPageHeight", e))?;
    settings.SetMarginTop(0.0).map_err(|e| err("SetMarginTop", e))?;
    settings.SetMarginBottom(0.0).map_err(|e| err("SetMarginBottom", e))?;
    settings.SetMarginLeft(0.0).map_err(|e| err("SetMarginLeft", e))?;
    settings.SetMarginRight(0.0).map_err(|e| err("SetMarginRight", e))?;
    settings.SetShouldPrintBackgrounds(true).map_err(|e| err("SetShouldPrintBackgrounds", e))?;
    settings.SetShouldPrintHeaderAndFooter(false).map_err(|e| err("SetShouldPrintHeaderAndFooter", e))?;

    let handler = PrintToPdfCompletedHandler::create(Box::new(move |result, success| {
        let res = match result {
            Ok(()) if success => Ok(()),
            Ok(()) => Err("PrintToPdf a échoué (résultat négatif)".to_string()),
            Err(e) => Err(format!("PrintToPdf : {e}")),
        };
        if let Some(tx) = report.lock().ok().and_then(|mut g| g.take()) {
            let _ = tx.send(res);
        }
        Ok(())
    }));
    let path = HSTRING::from(target.as_os_str());
    core7.PrintToPdf(&path, &settings, &handler).map_err(|e| err("PrintToPdf", e))
}
