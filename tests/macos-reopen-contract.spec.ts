import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('macOS reopen contract', () => {
  it('restores the last closed main or floating window from the Dock', () => {
    const source = readFileSync(resolve(process.cwd(), 'src-tauri/src/main.rs'), 'utf8')

    expect(source).toContain('applicationShouldHandleReopen:hasVisibleWindows:')
    expect(source).toContain('remember_restore_target(&event.window().app_handle(), event.window().label())')
    expect(source).toContain('let _ = show_named(app, &target)')
    expect(source).toContain('fn hide_window(app: tauri::AppHandle, label: String)')
    expect(source).toContain('install_macos_reopen_handler(&handle)')
  })
})
