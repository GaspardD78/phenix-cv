mod pdf;

use std::sync::OnceLock;
use tauri::Emitter;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Resolved database URI, computed once at startup.
static DB_URI: OnceLock<String> = OnceLock::new();

/// Mode portable : si un fichier `.portable` existe à côté de l'exécutable, la
/// base est stockée dans un dossier `data/` à côté de lui (clé USB). Sinon, le
/// chemin géré par Tauri est utilisé.
fn resolve_db_uri() -> String {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            if exe_dir.join(".portable").exists() {
                let data_dir = exe_dir.join("data");
                let _ = std::fs::create_dir_all(&data_dir);
                return format!("sqlite:{}", data_dir.join("phenixcv.db").display());
            }
        }
    }
    "sqlite:phenixcv.db".to_string()
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


pub fn run() {
    let db_uri = DB_URI.get_or_init(resolve_db_uri).clone();

    let migrations = vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: include_str!("../migrations/001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_uri, migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_db_uri, pdf::generate_pdf, pdf::get_last_pdf_export_log, pdf::log_pdf_system_print, start_oauth_server])
        .setup(|app| {
            pdf::spawn_selftest_if_requested(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
