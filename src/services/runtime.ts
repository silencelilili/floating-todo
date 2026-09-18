import type { AppData, AppSettings, Task } from '@/domain/task'

export const isTauri = (): boolean => '__TAURI__' in window

async function invoke<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/tauri')
  return tauriInvoke<T>(command, payload)
}

export async function loadAppData(): Promise<AppData | null> {
  if (!isTauri()) return null
  return invoke<AppData>('load_app_data')
}

export async function saveAppData(data: AppData): Promise<void> {
  if (!isTauri()) return
  await invoke('save_app_data', { data })
}

export async function exportAppData(data: AppData): Promise<string | null> {
  if (!isTauri()) {
    const filename = `浮光Todo-${new Date().toISOString().slice(0, 10)}.json`
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(anchor.href)
    return filename
  }
  const { save } = await import('@tauri-apps/api/dialog')
  const path = await save({
    defaultPath: `浮光Todo-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (!path) return null
  return invoke<string>('export_app_data', { data, path })
}

export async function importAppData(): Promise<AppData | null> {
  if (!isTauri()) return null
  const { open } = await import('@tauri-apps/api/dialog')
  const path = await open({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (typeof path !== 'string') return null
  return invoke<AppData>('import_app_data', { path })
}

export async function createBackup(data: AppData): Promise<string | null> {
  if (!isTauri()) return null
  return invoke<string>('create_backup', { data })
}

export async function configureDesktop(settings: AppSettings): Promise<void> {
  if (!isTauri()) return
  await invoke('configure_desktop', { settings })
}

export async function showWindow(label: 'main' | 'quick-capture' | 'floating'): Promise<void> {
  if (!isTauri()) return
  await invoke('show_window', { label })
}

export async function hideCurrentWindow(): Promise<void> {
  if (!isTauri()) return
  const { appWindow } = await import('@tauri-apps/api/window')
  await invoke('hide_window', { label: appWindow.label })
}

export async function startCurrentWindowDragging(): Promise<void> {
  if (!isTauri()) return
  const { appWindow } = await import('@tauri-apps/api/window')
  await appWindow.startDragging()
}

let expandedFloatingSize: { width: number; height: number } | null = null

export async function setFloatingWindowCollapsed(collapsed: boolean): Promise<void> {
  if (!isTauri()) return
  const { appWindow, LogicalSize } = await import('@tauri-apps/api/window')
  if (appWindow.label !== 'floating') return
  if (collapsed === (expandedFloatingSize !== null)) return

  const scale = await appWindow.scaleFactor()
  const size = (await appWindow.innerSize()).toLogical(scale)
  const position = await appWindow.outerPosition()
  const target = collapsed ? { width: size.width, height: 55 } : expandedFloatingSize!

  try {
    await appWindow.setResizable(!collapsed)
    await appWindow.setSize(new LogicalSize(target.width, target.height))
    // Preserve the current top-left corner, including after dragging while collapsed.
    await appWindow.setPosition(position)
  } catch (error) {
    await appWindow.setResizable(collapsed).catch(() => undefined)
    await appWindow.setSize(size).catch(() => undefined)
    await appWindow.setPosition(position).catch(() => undefined)
    throw error
  }
  expandedFloatingSize = collapsed ? { width: size.width, height: size.height } : null
}

export async function closeCurrentWindow(): Promise<void> {
  if (!isTauri()) return
  const { appWindow } = await import('@tauri-apps/api/window')
  await appWindow.close()
}

export async function setFloatingClickThrough(enabled: boolean): Promise<void> {
  if (!isTauri()) return
  await invoke('set_floating_click_through', { enabled })
}

export async function setFloatingAlwaysOnTop(enabled: boolean): Promise<void> {
  if (!isTauri()) return
  await invoke('set_floating_always_on_top', { enabled })
}

export async function emitTaskChanged(tasks: Task[]): Promise<void> {
  if (!isTauri()) return
  const { emit } = await import('@tauri-apps/api/event')
  await emit('tasks://changed', { revision: Date.now(), count: tasks.length })
}

export async function listenTaskChanged(callback: () => void): Promise<() => void> {
  if (!isTauri()) return () => undefined
  const { listen } = await import('@tauri-apps/api/event')
  return listen('tasks://changed', callback)
}

export async function listenCurrentWindowFocus(callback: (focused: boolean) => void): Promise<() => void> {
  if (!isTauri()) return () => undefined
  const { appWindow } = await import('@tauri-apps/api/window')
  return appWindow.onFocusChanged(({ payload }) => callback(payload))
}

export async function currentWindowLabel(): Promise<string> {
  if (!isTauri()) return new URLSearchParams(location.search).get('window') ?? 'main'
  const { appWindow } = await import('@tauri-apps/api/window')
  return appWindow.label
}
