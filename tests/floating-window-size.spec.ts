import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nativeWindow = vi.hoisted(() => ({
  label: 'floating',
  scaleFactor: vi.fn(),
  innerSize: vi.fn(),
  outerPosition: vi.fn(),
  setSize: vi.fn(),
  setPosition: vi.fn(),
  setResizable: vi.fn(),
}))

vi.mock('@tauri-apps/api/window', () => ({
  appWindow: nativeWindow,
  LogicalSize: class {
    constructor(public width: number, public height: number) {}
  },
}))

describe('native floating window size', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
    vi.stubGlobal('__TAURI__', {})
    nativeWindow.label = 'floating'
    nativeWindow.scaleFactor.mockResolvedValue(2)
    nativeWindow.innerSize.mockResolvedValue({ toLogical: (scale: number) => ({ width: 720 / scale, height: 1000 / scale }) })
    nativeWindow.outerPosition.mockResolvedValue({ x: 200, y: 300 })
    nativeWindow.setSize.mockResolvedValue(undefined)
    nativeWindow.setPosition.mockResolvedValue(undefined)
    nativeWindow.setResizable.mockResolvedValue(undefined)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('shrinks to 55 logical pixels and restores the custom size at the current position', async () => {
    const { setFloatingWindowCollapsed } = await import('@/services/runtime')
    await setFloatingWindowCollapsed(true)
    expect(nativeWindow.setSize).toHaveBeenLastCalledWith(expect.objectContaining({ width: 360, height: 55 }))
    expect(nativeWindow.setResizable).toHaveBeenLastCalledWith(false)
    expect(nativeWindow.setPosition).toHaveBeenLastCalledWith({ x: 200, y: 300 })

    // The collapsed window was dragged to a screen with a different scale factor.
    nativeWindow.scaleFactor.mockResolvedValue(1)
    nativeWindow.innerSize.mockResolvedValue({ toLogical: () => ({ width: 360, height: 55 }) })
    nativeWindow.outerPosition.mockResolvedValue({ x: 1200, y: 600 })
    await setFloatingWindowCollapsed(false)
    expect(nativeWindow.setSize).toHaveBeenLastCalledWith(expect.objectContaining({ width: 360, height: 500 }))
    expect(nativeWindow.setResizable).toHaveBeenLastCalledWith(true)
    expect(nativeWindow.setPosition).toHaveBeenLastCalledWith({ x: 1200, y: 600 })
  })

  it('does not overwrite the expanded size on duplicate collapse requests', async () => {
    const { setFloatingWindowCollapsed } = await import('@/services/runtime')
    await setFloatingWindowCollapsed(true)
    await setFloatingWindowCollapsed(true)
    expect(nativeWindow.setSize).toHaveBeenCalledTimes(1)
    await setFloatingWindowCollapsed(false)
    expect(nativeWindow.setSize).toHaveBeenLastCalledWith(expect.objectContaining({ width: 360, height: 500 }))
  })

  it('rolls back a failed collapse and allows retrying', async () => {
    const { setFloatingWindowCollapsed } = await import('@/services/runtime')
    nativeWindow.setSize.mockRejectedValueOnce(new Error('resize failed'))
    await expect(setFloatingWindowCollapsed(true)).rejects.toThrow('resize failed')
    expect(nativeWindow.setResizable).toHaveBeenLastCalledWith(true)
    expect(nativeWindow.setSize).toHaveBeenLastCalledWith(expect.objectContaining({ width: 360, height: 500 }))
    await setFloatingWindowCollapsed(true)
    expect(nativeWindow.setSize).toHaveBeenLastCalledWith(expect.objectContaining({ width: 360, height: 55 }))
  })

  it('does not resize a browser preview or another application window', async () => {
    const { setFloatingWindowCollapsed } = await import('@/services/runtime')
    nativeWindow.label = 'main'
    await setFloatingWindowCollapsed(true)
    vi.unstubAllGlobals()
    nativeWindow.label = 'floating'
    await setFloatingWindowCollapsed(true)
    expect(nativeWindow.setSize).not.toHaveBeenCalled()
  })
})
