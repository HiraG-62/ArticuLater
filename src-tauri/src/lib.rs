use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager, State};

/// 監視中のファイル。キーは比較用に正規化したパス、値は画面に渡すパス
type WatchedFiles = Arc<Mutex<HashMap<String, String>>>;

struct AppState {
    /// 起動時にコマンドラインで指定されたファイル（D12）
    initial_paths: Vec<String>,
    watcher: Mutex<Option<RecommendedWatcher>>,
    watched: WatchedFiles,
    /// 監視中のディレクトリと、その中で監視しているファイル数
    watched_dirs: Mutex<HashMap<PathBuf, usize>>,
}

#[derive(Serialize)]
struct LoadedDocument {
    path: String,
    name: String,
    source: String,
}

fn to_message(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// パスを絶対パスに解決する。Windowsでも `\\?\` の付かない表記にする
fn resolve(path: &str) -> Result<PathBuf, String> {
    dunce::canonicalize(path).map_err(|e| format!("{path}: {e}"))
}

/// 大文字小文字を区別しないWindowsでも同じファイルを同じキーにする
fn compare_key(path: &Path) -> String {
    let s = path.to_string_lossy().to_string();
    if cfg!(windows) {
        s.to_lowercase()
    } else {
        s
    }
}

/// コマンドライン引数のうち、存在するファイルを絶対パスにして返す
fn resolve_args(args: impl IntoIterator<Item = String>, cwd: &Path) -> Vec<String> {
    args.into_iter()
        .filter(|arg| !arg.starts_with('-'))
        .filter_map(|arg| {
            let p = Path::new(&arg);
            let joined = if p.is_absolute() { p.to_path_buf() } else { cwd.join(p) };
            dunce::canonicalize(joined).ok()
        })
        .filter(|p| p.is_file())
        .map(|p| p.to_string_lossy().to_string())
        .collect()
}

#[tauri::command]
fn get_initial_paths(state: State<AppState>) -> Vec<String> {
    state.initial_paths.clone()
}

#[tauri::command]
fn read_document(path: String) -> Result<LoadedDocument, String> {
    let resolved = resolve(&path)?;
    let bytes = std::fs::read(&resolved).map_err(to_message)?;
    let text = String::from_utf8(bytes).map_err(|_| "UTF-8のテキストとして読み込めませんでした".to_string())?;
    let source = text.strip_prefix('\u{feff}').unwrap_or(&text).to_string();
    let name = resolved
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(LoadedDocument {
        path: resolved.to_string_lossy().to_string(),
        name,
        source,
    })
}

/// Reviewの保存先（アプリデータ領域。D4）。文書のパスごとに1ファイル
fn review_file(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(to_message)?.join("reviews");
    let digest = Sha256::digest(compare_key(Path::new(path)).as_bytes());
    let name: String = digest.iter().map(|b| format!("{b:02x}")).collect();
    Ok(dir.join(format!("{name}.json")))
}

#[tauri::command]
fn load_review(app: AppHandle, path: String) -> Result<Option<String>, String> {
    let file = review_file(&app, &path)?;
    match std::fs::read_to_string(&file) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn save_review(app: AppHandle, path: String, data: String) -> Result<(), String> {
    let file = review_file(&app, &path)?;
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(to_message)?;
    }
    // 書き込み途中で終了しても壊れないよう、一時ファイルに書いてから置き換える
    let tmp = file.with_extension("json.tmp");
    std::fs::write(&tmp, data).map_err(to_message)?;
    std::fs::rename(&tmp, &file).map_err(to_message)
}

#[tauri::command]
fn write_text(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(to_message)
}

#[tauri::command]
fn watch_file(state: State<AppState>, path: String) -> Result<(), String> {
    let file = resolve(&path)?;
    let dir = file.parent().ok_or("フォルダを特定できませんでした")?.to_path_buf();
    // エディタが「別名で保存して置き換える」場合も追えるよう、親フォルダを監視する
    let mut dirs = state.watched_dirs.lock().map_err(to_message)?;
    let count = dirs.entry(dir.clone()).or_insert(0);
    if *count == 0 {
        if let Some(watcher) = state.watcher.lock().map_err(to_message)?.as_mut() {
            watcher.watch(&dir, RecursiveMode::NonRecursive).map_err(to_message)?;
        }
    }
    *count += 1;
    state
        .watched
        .lock()
        .map_err(to_message)?
        .insert(compare_key(&file), path);
    Ok(())
}

#[tauri::command]
fn unwatch_file(state: State<AppState>, path: String) -> Result<(), String> {
    let file = resolve(&path).unwrap_or_else(|_| PathBuf::from(&path));
    state.watched.lock().map_err(to_message)?.remove(&compare_key(&file));
    let Some(dir) = file.parent().map(Path::to_path_buf) else {
        return Ok(());
    };
    let mut dirs = state.watched_dirs.lock().map_err(to_message)?;
    if let Some(count) = dirs.get_mut(&dir) {
        *count -= 1;
        if *count == 0 {
            dirs.remove(&dir);
            if let Some(watcher) = state.watcher.lock().map_err(to_message)?.as_mut() {
                let _ = watcher.unwatch(&dir);
            }
        }
    }
    Ok(())
}

fn create_watcher(app: AppHandle, watched: WatchedFiles) -> Option<RecommendedWatcher> {
    notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else { return };
        if event.kind.is_access() {
            return;
        }
        let Ok(watched) = watched.lock() else { return };
        for changed in &event.paths {
            if let Some(path) = watched.get(&compare_key(changed)) {
                let _ = app.emit("file-changed", path.clone());
            }
        }
    })
    .ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cwd = std::env::current_dir().unwrap_or_default();
    let initial_paths = resolve_args(std::env::args().skip(1), &cwd);

    tauri::Builder::default()
        // 起動中にもう一度起動された場合は、そのファイルを既存のウィンドウで開く（D17）
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let paths = resolve_args(argv.into_iter().skip(1), Path::new(&cwd));
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            let _ = app.emit("open-paths", paths);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(move |app| {
            let watched: WatchedFiles = Arc::default();
            let watcher = create_watcher(app.handle().clone(), watched.clone());
            app.manage(AppState {
                initial_paths,
                watcher: Mutex::new(watcher),
                watched,
                watched_dirs: Mutex::default(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_paths,
            read_document,
            load_review,
            save_review,
            write_text,
            watch_file,
            unwatch_file
        ])
        .run(tauri::generate_context!())
        .expect("ArticuLaterの起動に失敗しました");
}
