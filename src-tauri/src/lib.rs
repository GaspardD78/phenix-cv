use std::io::Write;
use std::sync::OnceLock;
use headless_chrome::browser::default_executable;
use headless_chrome::{Browser, LaunchOptions};
use tauri::Emitter;
use tauri_plugin_sql::{Migration, MigrationKind};
use tempfile::Builder;

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


#[tauri::command]
async fn generate_pdf(html: String) -> Result<Vec<u8>, String> {
    // Generate PDF inside a blocking thread so it doesn't freeze the UI or the async runtime.
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<u8>, String> {
        // 1. Check if a browser executable is found
        if let Err(e) = default_executable() {
            return Err(format!("Aucun navigateur basé sur Chromium n'a été trouvé sur le système : {}", e));
        }

        // 2. Write the HTML string to a temporary file
        let mut temp_file = Builder::new()
            .suffix(".html")
            .tempfile()
            .map_err(|e| e.to_string())?;
        temp_file.write_all(html.as_bytes()).map_err(|e| e.to_string())?;
        let temp_path = temp_file.into_temp_path();

        let file_url = url::Url::from_file_path(&temp_path)
            .map_err(|_| "Failed to convert temp file path to URL".to_string())?
            .to_string();

        // 3. Launch headless browser
        let browser = Browser::new(
            LaunchOptions::default_builder()
                .headless(true)
                .build()
                .map_err(|e| e.to_string())?
        ).map_err(|e| e.to_string())?;

        // 4. Navigate to the temporary file
        let tab = browser.new_tab().map_err(|e| e.to_string())?;
        tab.navigate_to(&file_url).map_err(|e| e.to_string())?;
        tab.wait_until_navigated().map_err(|e| e.to_string())?;

        // 5. Generate PDF
        let pdf_data = tab.print_to_pdf(Some(headless_chrome::types::PrintToPdfOptions {
            landscape: Some(false),
            display_header_footer: Some(false),
            print_background: Some(true),
            scale: Some(1.0),
            paper_width: Some(8.27), // A4 width in inches
            paper_height: Some(11.69), // A4 height in inches
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
        })).map_err(|e| e.to_string())?;

        Ok(pdf_data)
    })
    .await
    .map_err(|e| format!("Task panicked: {}", e))?
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
        .invoke_handler(tauri::generate_handler![get_db_uri, generate_pdf, start_oauth_server])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
