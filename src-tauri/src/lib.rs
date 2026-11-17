mod pdf;
mod portable;

use serde::Serialize;
use std::sync::OnceLock;
use tauri::{Emitter, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

/// Resolved database URI, computed once at startup.
static DB_URI: OnceLock<String> = OnceLock::new();

/// Mode portable (voir `portable.rs`), déterminé une fois au lancement.
static MODE: OnceLock<portable::Mode> = OnceLock::new();

pub(crate) fn mode() -> &'static portable::Mode {
    MODE.get_or_init(portable::current_mode)
}

/// Base de données : dans `data/` à côté de l'exécutable en mode portable, sinon le chemin géré par Tauri.
fn resolve_db_uri() -> String {
    match mode().data_dir() {
        Some(dir) => portable::db_uri(dir),
        None => "sqlite:phenixcv.db".to_string(),
    }
}

/// Returns the port the server is listening on.
/// When the callback arrives, emits an "oauth://callback" event with the request path.
#[tauri::command]
fn start_oauth_server(app: tauri::AppHandle) -> Result<u16, String> {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    tauri::async_runtime::spawn(async move {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut buf = [0u8; 4096];
            let n = stream.read(&mut buf).unwrap_or(0);
            let request = std::str::from_utf8(&buf[..n]).unwrap_or("");

            // Extract path from "GET /callback?code=...&state=... HTTP/1.1"
            if let Some(path) = request.lines().next().and_then(|l| l.split_whitespace().nth(1)) {
                let body = concat!(
                    "<!DOCTYPE html><html><head><meta charset='UTF-8'>",
                    "<style>body{font-family:sans-serif;text-align:center;padding:60px;color:#333}</style>",
                    "</head><body>",
                    "<h2>&#x2705; Authentification réussie</h2>",
                    "<p>Vous pouvez fermer cet onglet et retourner dans Phénix CV.</p>",
                    "<script>setTimeout(()=>window.close(),2000);</script>",
                    "</body></html>"
                );
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes());
                drop(stream);
                let _ = app.emit("oauth://callback", path.to_string());
            }
        }
    });

    Ok(port)
}

#[tauri::command]
fn get_db_uri() -> String {
    DB_URI.get_or_init(resolve_db_uri).clone()
}

/// Où sont les données, pour l'écran « Mes données ».
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppMode {
    /// Mode portable actif : tout est dans le dossier `data`, à côté de l'application.
    portable: bool,
    /// Dossier des données (portable : `data` ; sinon le dossier de données de Windows).
    data_dir: Option<String>,
    /// Le fichier `.portable` est présent mais le dossier `data` n'est pas utilisable.
    warning: Option<String>,
}

#[tauri::command]
fn get_app_mode(app: tauri::AppHandle) -> AppMode {
    let installed_dir = || app.path().app_config_dir().ok().map(|p| p.display().to_string());
    match mode() {
        portable::Mode::Portable(dir) => AppMode { portable: true, data_dir: Some(dir.display().to_string()), warning: None },
        portable::Mode::Unavailable { data_dir, reason } => AppMode {
            portable: false,
            data_dir: installed_dir(),
            warning: Some(format!(
                "Le dossier « {} » n'est pas accessible en écriture ({reason}). Vos données sont enregistrées sur cet ordinateur, pas sur la clé.",
                data_dir.display()
            )),
        },
        portable::Mode::Off => AppMode { portable: false, data_dir: installed_dir(), warning: None },
    }
}

/// Sauvegarde automatique avant une restauration ou un import : écrite dans `data/` en mode portable,
/// sinon dans le dossier de données de l'application. Renvoie le chemin complet du fichier.
#[tauri::command]
fn write_auto_backup(app: tauri::AppHandle, file_name: String, content: String) -> Result<String, String> {
    if !portable::is_valid_backup_name(&file_name) {
        return Err("Nom de fichier de sauvegarde invalide.".to_string());
    }
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = portable::auto_backup_dir(mode(), &app_data);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&file_name);
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}


pub fn run() {
    // Mode portable : le moteur d'affichage (WebView2) garde son cache et son stockage dans `data/`,
    // pour ne rien laisser sur l'ordinateur d'accueil. Doit être fait avant la création de la fenêtre.
    if let Some(dir) = mode().data_dir() {
        let webview = dir.join(portable::WEBVIEW_DIR);
        let _ = std::fs::create_dir_all(&webview);
        std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &webview);
    }
    let db_uri = DB_URI.get_or_init(resolve_db_uri).clone();

    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_target_briefs",
            sql: include_str!("../migrations/002_target_briefs.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_uri, migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_db_uri, get_app_mode, write_auto_backup, pdf::generate_pdf, pdf::get_last_pdf_export_log, pdf::log_pdf_system_print, start_oauth_server])
        .setup(|app| {
            pdf::spawn_selftest_if_requested(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
