use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{
    AppHandle, Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder,
    webview::PageLoadEvent,
};

#[derive(Clone, Serialize)]
struct OpenedFile {
    path: String,
    content: String,
}

struct OpenedUrls(Mutex<Vec<tauri::Url>>);

fn urls_to_paths(urls: &[tauri::Url]) -> Vec<PathBuf> {
    urls
        .iter()
        .filter_map(|u| u.to_file_path().ok())
        .collect()
}

fn read_files(paths: &[PathBuf]) -> Vec<OpenedFile> {
    paths
        .iter()
        .filter_map(|path| {
            let content = fs::read_to_string(path).ok()?;
            Some(OpenedFile {
                path: path.to_string_lossy().into_owned(),
                content,
            })
        })
        .collect()
}

fn store_urls(app: &AppHandle, urls: Vec<tauri::Url>) {
    if urls.is_empty() {
        return;
    }
    app.state::<OpenedUrls>()
        .0
        .lock()
        .unwrap()
        .extend(urls);
}

fn pending_files(app: &AppHandle) -> Vec<OpenedFile> {
    let paths = urls_to_paths(
        &app.state::<OpenedUrls>()
            .0
            .lock()
            .unwrap()
            .clone(),
    );
    read_files(&paths)
}

fn deliver_files(app: &AppHandle) {
    let files = pending_files(app);
    if files.is_empty() {
        return;
    }

    let Ok(json) = serde_json::to_string(&files) else {
        return;
    };

    let script = format!(
        "(function(){{\
           var files = {json};\
           if (window.__mdViewerShowFiles) window.__mdViewerShowFiles(files);\
           else window.__mdViewerPendingFiles = files;\
         }})();"
    );

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(&script);
        let _ = window.set_focus();
    }

    let _ = app.emit("open-file", &files);
    let _ = app.emit_to("main", "open-file", &files);
}

fn ensure_main_window(app: &AppHandle, init_files: Option<Vec<OpenedFile>>) -> tauri::Result<()> {
    if app.get_webview_window("main").is_some() {
        return Ok(());
    }

    let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("MD Viewer")
        .inner_size(960.0, 720.0)
        .min_inner_size(480.0, 360.0);

    if let Some(files) = init_files {
        let json = serde_json::to_string(&files).unwrap_or_else(|_| "[]".to_string());
        builder = builder.initialization_script(format!(
            "window.__mdViewerPendingFiles = {json};"
        ));
    }

    builder.build()?;
    Ok(())
}

#[tauri::command]
fn opened_urls(app: tauri::AppHandle) -> Vec<String> {
    urls_to_paths(
        &app.state::<OpenedUrls>()
            .0
            .lock()
            .unwrap()
            .clone(),
    )
    .into_iter()
    .map(|p| p.to_string_lossy().into_owned())
    .collect()
}

#[tauri::command]
fn read_markdown_file(path: String) -> Result<String, String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("Not a file: {}", path.display()));
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn collect_launch_paths() -> Vec<PathBuf> {
    std::env::args()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .filter_map(|arg| {
            if let Ok(url) = tauri::Url::parse(&arg) {
                url.to_file_path().ok()
            } else {
                Some(PathBuf::from(arg))
            }
        })
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(OpenedUrls(Mutex::new(vec![])))
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Finished {
                deliver_files(webview.app_handle());
            }
        })
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let paths = collect_launch_paths();
                if !paths.is_empty() {
                    let urls: Vec<tauri::Url> = paths
                        .iter()
                        .filter_map(|p| tauri::Url::from_file_path(p).ok())
                        .collect();
                    store_urls(&app.handle(), urls);
                }
            }

            let files = pending_files(&app.handle());
            let init = if files.is_empty() { None } else { Some(files) };
            ensure_main_window(&app.handle(), init)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![opened_urls, read_markdown_file])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            match event {
                RunEvent::Ready => deliver_files(app),
                #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
                RunEvent::Opened { urls } => {
                    store_urls(app, urls);
                    deliver_files(app);
                }
                _ => {}
            }
        });
}
