use std::path::Path;
use walkdir::WalkDir;

/// One audio file found under the chosen root. Mirrors the `AudioFile` type
/// on the frontend (see `src/types.ts`).
#[derive(serde::Serialize, Clone)]
struct AudioFile {
    name: String,       // file name with extension, e.g. "explosion_01.wav"
    path: String,       // absolute path, used for convertFileSrc
    rel_path: String,   // path relative to root, forward-slashed, e.g. "weapons/explosion_01.wav"
    folder: String,     // immediate parent folder name, e.g. "weapons"
    ext: String,        // lowercase extension without dot, e.g. "wav"
    size_bytes: u64,
}

/// Supported audio extensions (lowercase, no dot).
const AUDIO_EXTS: &[&str] = &[
    "wav", "mp3", "ogg", "flac", "aiff", "aif", "m4a", "aac", "opus", "wma",
];

/// Recursively scan `root` for audio files. Pure filesystem walk — never decodes
/// audio (duration comes from the `<audio>` element on the frontend). Stays fast
/// for 1000+ files.
#[tauri::command]
fn scan_folder(root: String) -> Result<Vec<AudioFile>, String> {
    let root_path = Path::new(&root);
    if !root_path.exists() {
        return Err(format!("Folder no longer exists: {root}"));
    }
    if !root_path.is_dir() {
        return Err(format!("Not a folder: {root}"));
    }

    let mut files: Vec<AudioFile> = Vec::new();

    let walker = WalkDir::new(root_path)
        .follow_links(false)
        .into_iter()
        // Skip hidden files/folders (names starting with '.'); pruning a hidden
        // dir here also skips everything inside it.
        .filter_entry(|e| {
            e.file_name()
                .to_str()
                .map(|s| !s.starts_with('.'))
                .unwrap_or(false)
        });

    for entry in walker {
        // A permission error on a single sub-entry shouldn't abort the whole scan.
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();

        let ext = match path.extension().and_then(|e| e.to_str()) {
            Some(e) => e.to_lowercase(),
            None => continue,
        };
        if !AUDIO_EXTS.contains(&ext.as_str()) {
            continue;
        }

        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        // Relative path, normalized to forward slashes so display/search is
        // consistent across platforms.
        let rel_path = path
            .strip_prefix(root_path)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/");

        let folder = path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);

        files.push(AudioFile {
            name,
            path: path.to_string_lossy().to_string(),
            rel_path,
            folder,
            ext,
            size_bytes,
        });
    }

    // Stable, case-insensitive order by relative path groups subfolders together.
    files.sort_by(|a, b| a.rel_path.to_lowercase().cmp(&b.rel_path.to_lowercase()));

    Ok(files)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![scan_folder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
