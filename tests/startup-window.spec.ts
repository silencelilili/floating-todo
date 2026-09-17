import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface WindowConfig {
  label: string
  visible?: boolean
}

describe('startup window contract', () => {
  it('starts with only the floating window visible', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'src-tauri/tauri.conf.json'), 'utf8'))
    const windows = config.tauri.windows as WindowConfig[]

    expect(windows.find((window) => window.label === 'main')?.visible).toBe(false)
    expect(windows.find((window) => window.label === 'quick-capture')?.visible).toBe(false)
    expect(windows.find((window) => window.label === 'floating')?.visible).toBe(true)
  })
})
