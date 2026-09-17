import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppData } from '@/domain/task'
import { exportAppData, importAppData } from '@/services/runtime'

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  open: vi.fn(),
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/dialog', () => ({ save: mocks.save, open: mocks.open }))
vi.mock('@tauri-apps/api/tauri', () => ({ invoke: mocks.invoke }))

const data = {
  version: 1,
  tasks: [],
  lists: [],
  settings: {},
  updatedAt: '2026-09-17T00:00:00.000Z',
} as unknown as AppData

describe('desktop data transfer', () => {
  beforeEach(() => {
    Object.defineProperty(window, '__TAURI__', { value: {}, configurable: true })
  })

  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI__')
  })

  it('does not invoke the exporter when the save dialog is cancelled', async () => {
    mocks.save.mockResolvedValueOnce(null)

    await expect(exportAppData(data)).resolves.toBeNull()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('selects a path asynchronously before invoking the exporter', async () => {
    mocks.save.mockResolvedValueOnce('/tmp/tasks.json')
    mocks.invoke.mockResolvedValueOnce('/tmp/tasks.json')

    await expect(exportAppData(data)).resolves.toBe('/tmp/tasks.json')
    expect(mocks.invoke).toHaveBeenCalledWith('export_app_data', { data, path: '/tmp/tasks.json' })
  })

  it('selects a file asynchronously before invoking the importer', async () => {
    mocks.open.mockResolvedValueOnce('/tmp/tasks.json')
    mocks.invoke.mockResolvedValueOnce(data)

    await expect(importAppData()).resolves.toBe(data)
    expect(mocks.invoke).toHaveBeenCalledWith('import_app_data', { path: '/tmp/tasks.json' })
  })
})
