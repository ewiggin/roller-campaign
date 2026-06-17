// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Line the sidecar prints on stdout once it is listening (see
/// roller-backend/src/main.ts, desktop mode).
const PORT_PREFIX: &str = "ROLLER_API_PORT=";

/// Default superadmin credentials for the offline desktop build. Overridable
/// at compile time: ROLLER_ADMIN_EMAIL / ROLLER_ADMIN_PASSWORD env vars set
/// when running `cargo build` (CI does this for release artifacts).
const ADMIN_EMAIL: &str = match option_env!("ROLLER_ADMIN_EMAIL") {
    Some(v) => v,
    None => "admin@roller.local",
};
const ADMIN_PASSWORD: &str = match option_env!("ROLLER_ADMIN_PASSWORD") {
    Some(v) => v,
    None => "roller-admin",
};

struct Sidecar(Mutex<Option<CommandChild>>);

fn kill_sidecar(app: &tauri::AppHandle) {
    if let Some(child) = app.state::<Sidecar>().0.lock().unwrap().take() {
        let _ = child.kill();
    }
}

/// The JWT secret is generated once per installation and persisted next to
/// the database, so volunteer/admin sessions survive app restarts.
fn load_or_create_jwt_secret(data_dir: &Path) -> std::io::Result<String> {
    let path = data_dir.join("jwt.secret");
    if let Ok(existing) = std::fs::read_to_string(&path) {
        let existing = existing.trim().to_string();
        if !existing.is_empty() {
            return Ok(existing);
        }
    }
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes).map_err(std::io::Error::other)?;
    let secret: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    std::fs::write(&path, &secret)?;
    Ok(secret)
}

/// Hosts the WebView itself may load; anything else is an external link and
/// belongs in the system browser.
fn is_internal_url(url: &tauri::Url) -> bool {
    matches!(url.scheme(), "tauri" | "about" | "data" | "blob")
        || matches!(
            url.host_str(),
            Some("localhost" | "127.0.0.1" | "tauri.localhost")
        )
}

/// The WebView is not a browser: external links (especially target="_blank")
/// are silently dropped unless someone handles them. This script intercepts
/// anchor clicks and window.open and hands external URLs to the opener
/// plugin, which launches the system default browser / mail client.
fn build_init_script(port: u16) -> String {
    format!(
        r#"window.__ROLLER_API_PORT__ = {port};
(function () {{
  const INTERNAL_HOSTS = ['127.0.0.1', 'localhost', 'tauri.localhost'];
  const isExternal = (raw) => {{
    try {{
      const url = new URL(raw, window.location.href);
      if (url.protocol === 'mailto:' || url.protocol === 'tel:') return true;
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
      return !INTERNAL_HOSTS.includes(url.hostname);
    }} catch {{
      return false;
    }}
  }};
  const openExternal = (url) =>
    window.__TAURI_INTERNALS__.invoke('plugin:opener|open_url', {{ url }});
  document.addEventListener(
    'click',
    (event) => {{
      const anchor =
        event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor || !isExternal(anchor.href)) return;
      event.preventDefault();
      event.stopPropagation();
      openExternal(anchor.href);
    }},
    true,
  );
  const nativeOpen = window.open.bind(window);
  window.open = (url, ...args) => {{
    if (url && isExternal(String(url))) {{
      openExternal(String(url));
      return null;
    }}
    return nativeOpen(url, ...args);
  }};
}})();
"#
    )
}

/// Static splash page bundled into the binary. Written to disk on startup
/// and loaded via a `file://` URL, independent of frontendDist/devUrl, so it
/// shows identically in `tauri dev` and the packaged app.
const SPLASH_HTML: &str = include_str!("../assets/splashscreen.html");

/// Shown immediately on launch while the sidecar boots (TypeORM connection,
/// possible migrations); closed once the main window is ready.
fn create_splash_window(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let path = app.path().app_cache_dir()?.join("splashscreen.html");
    std::fs::create_dir_all(path.parent().unwrap())?;
    std::fs::write(&path, SPLASH_HTML)?;
    tauri::WebviewWindowBuilder::new(
        app,
        "splashscreen",
        tauri::WebviewUrl::External(
            tauri::Url::from_file_path(&path).map_err(|_| "invalid splash screen path")?,
        ),
    )
    .title("Roller Admin")
    .inner_size(360.0, 220.0)
    .resizable(false)
    .decorations(false)
    .center()
    .build()?;
    Ok(())
}

/// Created only after the sidecar announced its port, so the injected global
/// is guaranteed to exist before any Angular code runs.
fn create_main_window(app: &tauri::AppHandle, port: u16) {
    let app = app.clone();
    // Window creation must happen on the main thread (hard requirement on
    // macOS); this callback runs from the async stdout-reader task.
    let _ = app.clone().run_on_main_thread(move || {
        let nav_app = app.clone();
        tauri::WebviewWindowBuilder::new(&app, "main", tauri::WebviewUrl::default())
            .title("Roller Admin")
            .inner_size(1280.0, 800.0)
            .min_inner_size(900.0, 600.0)
            .initialization_script(&build_init_script(port))
            // Covers plain (non _blank) external links: instead of navigating
            // the WebView away from the app, open the system browser.
            .on_navigation(move |url| {
                if is_internal_url(url) {
                    return true;
                }
                let _ = nav_app.opener().open_url(url.as_str(), None::<&str>);
                false
            })
            .build()
            .expect("failed to create main window");

        if let Some(splash) = app.get_webview_window("splashscreen") {
            let _ = splash.close();
        }
    });
}

fn spawn_sidecar(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;
    let jwt_secret = load_or_create_jwt_secret(&data_dir)?;
    let db_path = data_dir.join("roller.db");

    let envs: HashMap<String, String> = HashMap::from([
        ("ROLLER_DESKTOP".into(), "1".into()),
        ("DATABASE_PATH".into(), db_path.to_string_lossy().into_owned()),
        ("JWT_SECRET".into(), jwt_secret),
        ("ADMIN_EMAIL".into(), ADMIN_EMAIL.into()),
        ("ADMIN_PASSWORD".into(), ADMIN_PASSWORD.into()),
    ]);

    let (mut rx, child) = app.shell().sidecar("roller-backend")?.envs(envs).spawn()?;
    app.manage(Sidecar(Mutex::new(Some(child))));

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut port: Option<u16> = None;
        // Keep draining stdout/stderr for the whole sidecar lifetime: if the
        // pipes fill up (morgan logs every request), Node blocks on write.
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    print!("[sidecar] {text}");
                    if port.is_none() {
                        if let Some(value) = text.trim().strip_prefix(PORT_PREFIX) {
                            if let Ok(parsed) = value.parse::<u16>() {
                                port = Some(parsed);
                                create_main_window(&handle, parsed);
                            }
                        }
                    }
                }
                CommandEvent::Stderr(line) => {
                    eprint!("[sidecar] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Terminated(payload) => {
                    if port.is_none() {
                        eprintln!(
                            "[sidecar] exited before announcing a port (code {:?}); aborting",
                            payload.code
                        );
                        handle.exit(1);
                    }
                }
                _ => {}
            }
        }
    });

    Ok(())
}

fn main() {
    tauri::Builder::default()
        // Must be registered first: focuses the existing window instead of
        // letting a second instance start (shared SQLite database + port).
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            } else if let Some(splash) = app.get_webview_window("splashscreen") {
                let _ = splash.set_focus();
            }
        }))
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // Remembers the main window's size/position/maximized state between
        // launches. The splash screen is excluded: it's always centered and
        // its size is fixed.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_denylist(&["splashscreen"])
                .build(),
        )
        .setup(|app| {
            // Best-effort: if the splash window can't be created for some
            // reason, fall back to the previous behavior (no window until
            // the sidecar is ready) instead of failing app startup.
            if let Err(err) = create_splash_window(app.handle()) {
                eprintln!("[splash] failed to create splash window: {err}");
            }
            spawn_sidecar(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // The splash screen is closed programmatically once the main
            // window is ready; that also fires CloseRequested and must not
            // kill the sidecar.
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { .. } = event {
                    kill_sidecar(window.app_handle());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Covers every exit path (Cmd+Q, app.exit(), last window closed).
            if let RunEvent::Exit = event {
                kill_sidecar(app);
            }
        });
}
