import { describe, expect, it, vi, afterEach } from 'vitest'
import { hasClipboardContent, normalizeClipboardContent, sanitizeClipboardHtml } from '@/domain/clipboard'
import { contentFromPaste, copyClipboardContent } from '@/services/clipboard'

afterEach(() => vi.restoreAllMocks())

describe('clipboard content', () => {
  it('preserves the entire text, indentation and blank lines', () => {
    const text = '  标题\n\n\t缩进\n' + '完整内容'.repeat(2000)
    expect(normalizeClipboardContent({ text, html: '', images: [] }).text).toBe(text)
  })

  it('preserves table structure and safe inline formatting', () => {
    const html = sanitizeClipboardHtml('<table style="border-collapse:collapse"><tr><td colspan="2" style="color:rgb(255, 0, 0);text-align:center"><strong>标题</strong></td></tr><tr><td>A</td><td>B</td></tr></table>')
    const node = document.createElement('div')
    node.innerHTML = html
    expect(node.querySelectorAll('tr')).toHaveLength(2)
    expect(node.querySelector('td')?.getAttribute('colspan')).toBe('2')
    expect(node.querySelector('td')?.style.textAlign).toBe('center')
    expect(node.querySelector('strong')?.textContent).toBe('标题')
  })

  it('removes scripts, event handlers, app overlays and remote resources', () => {
    const html = sanitizeClipboardHtml('<script>alert(1)</script><style>body{display:none}</style><iframe src="https://example.com"></iframe><p onclick="attack()" style="position:fixed;z-index:99999;background-image:url(https://example.com);color:red">安全</p><a href="javascript:alert(1)">链接</a><img src="https://example.com/tracker" onerror="attack()" alt="图片说明"><svg onload="attack()"></svg>')
    expect(html).toContain('安全')
    expect(html).toContain('图片说明')
    expect(html).not.toMatch(/script|onclick|onerror|iframe|url\(|position|z-index|https:|svg|<style/)
  })

  it('keeps raster data images but rejects SVG data', () => {
    const content = normalizeClipboardContent({ text: '', html: '<img src="data:image/png;base64,YQ==">', images: ['data:image/png;base64,YQ==', 'data:image/svg+xml;base64,YQ=='] })
    expect(content.images).toEqual(['data:image/png;base64,YQ=='])
    expect(hasClipboardContent(content)).toBe(true)
  })

  it('rejects empty and unsupported content; creates a multiline text fallback', () => {
    expect(hasClipboardContent(normalizeClipboardContent({ text: '   ', html: '<script>bad()</script>', images: [] }))).toBe(false)
    expect(normalizeClipboardContent({ text: '', html: '<p>第一行</p><p>第二行<br>第三行</p>', images: [] }).text).toBe('第一行\n第二行\n第三行\n')
  })

  it('reads HTML, text and image files from a native paste', async () => {
    const data = new DataTransfer()
    data.setData('text/plain', 'hello\nworld')
    data.setData('text/html', '<b>hello</b><br>world')
    data.items.add(new File(['image'], 'sample.png', { type: 'image/png' }))
    const result = await contentFromPaste(data)
    expect(result.text).toBe('hello\nworld')
    expect(result.html).toBe('<b>hello</b><br>world')
    expect(result.images[0]).toMatch(/^data:image\/png;base64,/)
  })

  it('copies HTML and images together through the webview copy event and cleans up', async () => {
    const data = new DataTransfer()
    const exec = vi.fn(() => {
      document.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, cancelable: true }))
      return true
    })
    Object.defineProperty(document, 'execCommand', { configurable: true, writable: true, value: () => false })
    vi.spyOn(document, 'execCommand').mockImplementation(exec)
    await copyClipboardContent({ text: '完整文字', html: '<b>完整文字</b>', images: ['data:image/png;base64,YQ=='] })
    expect(exec).toHaveBeenCalledWith('copy')
    expect(data.getData('text/plain')).toBe('完整文字')
    expect(data.getData('text/html')).toContain('<b>完整文字</b>')
    expect(data.getData('text/html')).toContain('<img')
    expect(document.querySelector('[contenteditable]')).toBeNull()
  })
})
