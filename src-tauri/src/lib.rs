mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::inspect_project,
            commands::save_request_packet
        ])
        .run(tauri::generate_context!())
        .expect("Darkflow desktop runtime failed");
}
