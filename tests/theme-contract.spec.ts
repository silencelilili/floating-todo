import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/styles/base.css'), 'utf8')
const floatingView = readFileSync(resolve(process.cwd(), 'src/views/FloatingView.vue'), 'utf8')

describe('transparent window theme contract', () => {
  it('defines light and dark glass tokens', () => {
    expect(css).toContain('--glass-rgb: 247, 247, 250')
    expect(css).toContain('--glass-rgb: 31, 31, 38')
    expect(css).toContain('--capture-surface: rgba(248, 248, 250, .96)')
    expect(css).toContain('--capture-surface: rgba(31, 31, 38, .96)')
  })

  it('uses theme tokens instead of fixed light backgrounds', () => {
    expect(css).toContain('background: rgba(var(--glass-rgb), var(--floating-opacity, .82))')
    expect(css).toContain('background: var(--capture-surface)')
    expect(css).toContain('color: var(--capture-text)')
    expect(floatingView).toContain("'--floating-opacity': store.settings.floatingOpacity")
    expect(floatingView).not.toContain('rgba(247, 247, 250')
  })

  it('keeps the expanded floating surface on one stable paint layer', () => {
    expect(css).toContain('.floating-shell { width: 100%; height: 100%')
    expect(css).toContain('isolation: isolate; contain: paint; transform: translateZ(0)')
    expect(css).toContain('.floating-list { min-height: 0; flex: 1 1 auto')
  })
})
