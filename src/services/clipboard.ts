import type { ClipboardContent } from '@/domain/clipboard'

const supportedImages = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

function imageDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败，请重新粘贴。'))
    reader.readAsDataURL(blob)
  })
}

export async function contentFromPaste(data: DataTransfer): Promise<ClipboardContent> {
  // Read event data synchronously before the browser releases its clipboard event.
  const text = data.getData('text/plain')
  const html = data.getData('text/html')
  const files = Array.from(data.files)
  const images = await Promise.all(files.filter((file) => supportedImages.has(file.type)).map(imageDataUrl))
  return { text, html, images }
}

export async function readClipboardContent(): Promise<ClipboardContent> {
  if (navigator.clipboard?.read) {
    const items = await navigator.clipboard.read()
    const content: ClipboardContent = { text: '', html: '', images: [] }
    for (const item of items) {
      if (item.types.includes('text/plain')) content.text += await (await item.getType('text/plain')).text()
      if (item.types.includes('text/html')) content.html += await (await item.getType('text/html')).text()
      const imageType = item.types.find((type) => supportedImages.has(type))
      if (imageType) content.images.push(await imageDataUrl(await item.getType(imageType)))
    }
    return content
  }
  // Do not silently flatten rich content when the webview only exposes readText.
  throw new Error('请点击粘贴区域，然后按 ⌘V / Ctrl+V 保存内容。')
}

function contentHtml(content: ClipboardContent): string {
  const target = document.createElement('div')
  target.innerHTML = content.html
  if (!content.html && content.text) {
    const text = document.createElement('div')
    text.style.whiteSpace = 'pre-wrap'
    text.textContent = content.text
    target.append(text)
  }
  for (const image of content.images) {
    const img = document.createElement('img')
    img.src = image
    target.append(img)
  }
  return target.innerHTML
}

function legacyCopy(content: ClipboardContent): boolean {
  const active = document.activeElement as HTMLElement | null
  const selection = window.getSelection()
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : []
  const target = document.createElement('div')
  target.contentEditable = 'true'
  target.style.cssText = 'position:fixed;left:-10000px;top:0;white-space:pre-wrap'
  if (content.html || content.images.length) {
    target.innerHTML = contentHtml(content)
  } else target.textContent = content.text
  document.body.append(target)
  const copy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return
    event.clipboardData.setData('text/plain', content.text)
    if (content.html || content.images.length) event.clipboardData.setData('text/html', target.innerHTML)
    event.preventDefault()
  }
  try {
    target.focus()
    const range = document.createRange()
    range.selectNodeContents(target)
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.addEventListener('copy', copy)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.removeEventListener('copy', copy)
    target.remove()
    active?.focus({ preventScroll: true })
    selection?.removeAllRanges()
    ranges.forEach((range) => selection?.addRange(range))
  }
}

export async function copyClipboardContent(content: ClipboardContent): Promise<void> {
  // Native webviews support the user-initiated copy event without a Tauri allowlist change.
  // Prefer the image API for a standalone PNG so it also pastes into image editors.
  const singlePng = !content.text && !content.html && content.images.length === 1 && content.images[0].startsWith('data:image/png;')
  if (singlePng && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      const bytes = Uint8Array.from(atob(content.images[0].split(',')[1]), (char) => char.charCodeAt(0))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })])
      return
    } catch { /* The webview may still permit an HTML image copy below. */ }
  }
  if (legacyCopy(content)) return
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const html = content.html || content.images.length ? contentHtml(content) : ''
    const data: Record<string, Blob> = { 'text/plain': new Blob([content.text], { type: 'text/plain' }) }
    if (html) data['text/html'] = new Blob([html], { type: 'text/html' })
    await navigator.clipboard.write([new ClipboardItem(data)])
    return
  }
  if (!content.html && !content.images.length && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content.text)
    return
  }
  throw new Error('复制失败，请重试，或选中内容后按 ⌘C / Ctrl+C。')
}
