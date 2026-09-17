use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{
    CustomMenuItem, GlobalShortcutManager, Manager, SystemTray, SystemTrayEvent,
    SystemTrayMenu, WindowEvent,
};

const QUICK_DEFAULT: &str = "CommandOrControl+Shift+Space";
const FLOATING_DEFAULT: &str = "CommandOrControl+Shift+T";
const MAIN_DEFAULT: &str = "CommandOrControl+Shift+O";
const CLICK_THROUGH_DEFAULT: &str = "CommandOrControl+Shift+L";

#[cfg(target_os = "macos")]
static MACOS_APP_HANDLE: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();

#[derive(Default)]
struct ShortcutState(Mutex<Vec<String>>);

struct WindowRestoreState(Mutex<String>);

impl Default for WindowRestoreState {
    fn default() -> Self {
        Self(Mutex::new("main".into()))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSettings {
    #[serde(default = "default_quick_shortcut")]
    quick_capture_shortcut: String,
    #[serde(default = "default_floating_shortcut")]
    floating_shortcut: String,
    #[serde(default = "default_main_shortcut")]
    main_window_shortcut: String,
    #[serde(default = "default_click_through_shortcut")]
    click_through_shortcut: String,
    #[serde(default = "default_true")]
    floating_always_on_top: bool,
    #[serde(default)]
    floating_click_through: bool,
}

fn default_true() -> bool { true }
fn default_quick_shortcut() -> String { QUICK_DEFAULT.into() }
fn default_floating_shortcut() -> String { FLOATING_DEFAULT.into() }
fn default_main_shortcut() -> String { MAIN_DEFAULT.into() }
fn default_click_through_shortcut() -> String { CLICK_THROUGH_DEFAULT.into() }

fn app_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let path = app.path_resolver().app_data_dir().ok_or("无法获取应用数据目录")?;
    fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(path)
}

fn data_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    Ok(app_dir(app)?.join("floating-todo.json"))
}

fn atomic_write(path: &Path, contents: &[u8]) -> Result<(), String> {
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, contents).map_err(|error| error.to_string())?;
    fs::rename(&temporary, path).map_err(|error| error.to_string())
}

fn validate_data(data: &Value) -> Result<(), String> {
    if data.get("version").and_then(Value::as_u64) != Some(1) {
        return Err("不支持的数据版本，仅支持 version: 1".into());
    }
    let tasks = data.get("tasks").and_then(Value::as_array).ok_or("缺少 tasks 数组")?;
    if tasks.len() > 100_000 { return Err("任务数量超过 100000 条限制".into()); }
    for task in tasks {
        let title = task.get("title").and_then(Value::as_str).ok_or("任务缺少标题")?;
        if title.trim().is_empty() || title.chars().count() > 10_000 {
            return Err("任务标题为空或过长".into());
        }
        if task.get("id").and_then(Value::as_str).unwrap_or_default().is_empty() {
            return Err("任务缺少 id".into());
        }
    }
    Ok(())
}

#[tauri::command]
fn load_app_data(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    let path = data_path(&app)?;
    if !path.exists() { return Ok(None); }
    let bytes = fs::read(&path).map_err(|error| error.to_string())?;
    let data: Value = serde_json::from_slice(&bytes).map_err(|error| format!("本地数据损坏：{error}"))?;
    validate_data(&data)?;
    Ok(Some(data))
}

#[tauri::command]
fn save_app_data(app: tauri::AppHandle, data: Value) -> Result<(), String> {
    validate_data(&data)?;
    let contents = serde_json::to_vec_pretty(&data).map_err(|error| error.to_string())?;
    atomic_write(&data_path(&app)?, &contents)
}

#[tauri::command]
fn create_backup(app: tauri::AppHandle, data: Value) -> Result<String, String> {
    validate_data(&data)?;
    let backups = app_dir(&app)?.join("backups");
    fs::create_dir_all(&backups).map_err(|error| error.to_string())?;
    let name = format!("floating-todo-{}.json", Local::now().format("%Y%m%d-%H%M%S"));
    let path = backups.join(name);
    let contents = serde_json::to_vec_pretty(&data).map_err(|error| error.to_string())?;
    atomic_write(&path, &contents)?;

    let mut files = fs::read_dir(&backups)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    files.sort_by_key(|entry| entry.metadata().and_then(|meta| meta.modified()).ok());
    while files.len() > 30 {
        if let Some(entry) = files.first() { let _ = fs::remove_file(entry.path()); }
        files.remove(0);
    }
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn export_app_data(data: Value, path: PathBuf) -> Result<String, String> {
    validate_data(&data)?;
    let contents = serde_json::to_vec_pretty(&data).map_err(|error| error.to_string())?;
    atomic_write(&path, &contents)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn import_app_data(path: PathBuf) -> Result<Value, String> {
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if metadata.len() > 50 * 1024 * 1024 { return Err("导入文件不能超过 50MB".into()); }
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let data: Value = serde_json::from_slice(&bytes).map_err(|error| format!("JSON 格式错误：{error}"))?;
    validate_data(&data)?;
    Ok(data)
}

fn show_named<R: tauri::Runtime>(app: &tauri::AppHandle<R>, label: &str) -> Result<(), String> {
    let window = app.get_window(label).ok_or_else(|| format!("窗口不存在：{label}"))?;
    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

fn remember_restore_target<R: tauri::Runtime>(app: &tauri::AppHandle<R>, label: &str) {
    if !matches!(label, "main" | "floating") {
        return;
    }
    if let Ok(mut target) = app.state::<WindowRestoreState>().0.lock() {
        *target = label.into();
    }
}

#[cfg(target_os = "macos")]
extern "C" fn application_should_handle_reopen(
    _delegate: &objc::runtime::Object,
    _selector: objc::runtime::Sel,
    _application: cocoa::base::id,
    _has_visible_windows: objc::runtime::BOOL,
) -> objc::runtime::BOOL {
    if let Some(app) = MACOS_APP_HANDLE.get() {
        let target = app
            .state::<WindowRestoreState>()
            .0
            .lock()
            .map(|target| target.clone())
            .unwrap_or_else(|_| "main".into());
        let _ = show_named(app, &target);
    }
    objc::runtime::YES
}

#[cfg(target_os = "macos")]
fn install_macos_reopen_handler(app: &tauri::AppHandle) {
    let _ = MACOS_APP_HANDLE.set(app.clone());

    unsafe {
        let class_name = b"TaoAppDelegate\0";
        let selector_name = b"applicationShouldHandleReopen:hasVisibleWindows:\0";
        let class = objc::runtime::objc_getClass(class_name.as_ptr().cast());
        if class.is_null() {
            eprintln!("无法获取 macOS 应用委托，Dock 重开处理未安装");
            return;
        }

        let selector = objc::runtime::sel_registerName(selector_name.as_ptr().cast());
        let implementation: objc::runtime::Imp = std::mem::transmute(
            application_should_handle_reopen
                as extern "C" fn(
                    &objc::runtime::Object,
                    objc::runtime::Sel,
                    cocoa::base::id,
                    objc::runtime::BOOL,
                ) -> objc::runtime::BOOL,
        );
        #[cfg(target_arch = "aarch64")]
        let type_encoding = b"B@:@B\0";
        #[cfg(not(target_arch = "aarch64"))]
        let type_encoding = b"c@:@c\0";

        let installed = objc::runtime::class_addMethod(
            class.cast_mut(),
            selector,
            implementation,
            type_encoding.as_ptr().cast(),
        );
        if installed == objc::runtime::NO {
            eprintln!("macOS Dock 重开处理已存在或安装失败");
        }
    }
}

fn toggle_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>, label: &str) -> Result<(), String> {
    let window = app.get_window(label).ok_or_else(|| format!("窗口不存在：{label}"))?;
    if window.is_visible().map_err(|error| error.to_string())? {
        window.hide().map_err(|error| error.to_string())
    } else {
        show_named(app, label)
    }
}

#[tauri::command]
fn show_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    match label.as_str() {
        "main" | "quick-capture" | "floating" => show_named(&app, &label),
        _ => Err("不允许的窗口名称".into()),
    }
}

#[tauri::command]
fn hide_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    match label.as_str() {
        "main" | "quick-capture" | "floating" => {
            remember_restore_target(&app, &label);
            app.get_window(&label)
                .ok_or_else(|| format!("窗口不存在：{label}"))?
                .hide()
                .map_err(|error| error.to_string())
        }
        _ => Err("不允许的窗口名称".into()),
    }
}

#[tauri::command]
fn set_floating_click_through(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let window = app.get_window("floating").ok_or("悬浮窗不存在")?;
    window.set_ignore_cursor_events(enabled).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_floating_always_on_top(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let window = app.get_window("floating").ok_or("悬浮窗不存在")?;
    window.set_always_on_top(enabled).map_err(|error| error.to_string())
}

fn register_shortcuts<R: tauri::Runtime>(app: &tauri::AppHandle<R>, settings: DesktopSettings) -> Result<(), String> {
    let state = app.state::<ShortcutState>();
    let old = state.0.lock().map_err(|_| "快捷键状态锁失败")?.clone();
    for shortcut in old { let _ = app.global_shortcut_manager().unregister(&shortcut); }

    let definitions = vec![
        (settings.quick_capture_shortcut, "quick-capture"),
        (settings.floating_shortcut, "floating"),
        (settings.main_window_shortcut, "main"),
        (settings.click_through_shortcut, "click-through"),
    ];
    let mut registered = Vec::new();
    for (shortcut, action) in definitions {
        let handle = app.clone();
        let shortcut_for_callback = shortcut.clone();
        app.global_shortcut_manager()
            .register(&shortcut, move || match action {
                "floating" => { let _ = toggle_window(&handle, "floating"); }
                "click-through" => {
                    if let Some(window) = handle.get_window("floating") {
                        let _ = window.set_ignore_cursor_events(false);
                        let _ = window.emit("floating://click-through-disabled", ());
                        let _ = window.show();
                    }
                }
                label => { let _ = show_named(&handle, label); }
            })
            .map_err(|error| format!("快捷键 {shortcut_for_callback} 注册失败：{error}"))?;
        registered.push(shortcut);
    }
    *state.0.lock().map_err(|_| "快捷键状态锁失败")? = registered;
    Ok(())
}

#[tauri::command]
fn configure_desktop(app: tauri::AppHandle, settings: DesktopSettings) -> Result<(), String> {
    if let Some(window) = app.get_window("floating") {
        window.set_always_on_top(settings.floating_always_on_top).map_err(|error| error.to_string())?;
        window.set_ignore_cursor_events(settings.floating_click_through).map_err(|error| error.to_string())?;
    }
    register_shortcuts(&app, settings)
}

fn tray() -> SystemTray {
    let menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("main", "打开浮光 Todo"))
        .add_item(CustomMenuItem::new("quick", "快速添加"))
        .add_item(CustomMenuItem::new("floating", "显示/隐藏悬浮窗"))
        .add_native_item(tauri::SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "退出"));
    SystemTray::new().with_menu(menu)
}

fn main() {
    // Keep the guard alive for the full event loop so a second launch cannot
    // create another always-on-top floating window over the existing one.
    // LaunchServices starts apps with `/` as their working directory, so the
    // lock must use an explicit user-writable path instead of a relative one.
    let instance_lock_path = std::env::temp_dir().join("com.local.floatingtodo.lock");
    let instance_guard = single_instance::SingleInstance::new(
        instance_lock_path.to_string_lossy().as_ref(),
    )
        .expect("创建应用单实例锁失败");
    if !instance_guard.is_single() {
        return;
    }

    let app = tauri::Builder::default()
        .manage(ShortcutState::default())
        .manage(WindowRestoreState::default())
        .system_tray(tray())
        .on_system_tray_event(|app, event| {
            if let SystemTrayEvent::MenuItemClick { id, .. } = event {
                match id.as_str() {
                    "main" => { let _ = show_named(app, "main"); }
                    "quick" => { let _ = show_named(app, "quick-capture"); }
                    "floating" => { let _ = toggle_window(app, "floating"); }
                    "quit" => app.exit(0),
                    _ => {}
                }
            }
        })
        .on_window_event(|event| {
            if let WindowEvent::CloseRequested { api, .. } = event.event() {
                api.prevent_close();
                remember_restore_target(&event.window().app_handle(), event.window().label());
                let _ = event.window().hide();
            }
        })
        .setup(|app| {
            let handle = app.handle();
            #[cfg(target_os = "macos")]
            install_macos_reopen_handler(&handle);
            if let Err(error) = register_shortcuts(&handle, DesktopSettings {
                quick_capture_shortcut: default_quick_shortcut(),
                floating_shortcut: default_floating_shortcut(),
                main_window_shortcut: default_main_shortcut(),
                click_through_shortcut: default_click_through_shortcut(),
                floating_always_on_top: true,
                floating_click_through: false,
            }) {
                eprintln!("{error}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_app_data,
            save_app_data,
            create_backup,
            export_app_data,
            import_app_data,
            show_window,
            hide_window,
            set_floating_click_through,
            set_floating_always_on_top,
            configure_desktop
        ])
        .build(tauri::generate_context!())
        .expect("启动浮光 Todo 失败");

    app.run(|_handle, _event| {});
}
