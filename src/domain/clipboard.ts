export interface ClipboardContent {
  text: string
  html: string
  images: string[]
}

export interface ClipboardEntry extends ClipboardContent {
  id: string
  createdAt: string
}

const allowedTags = new Set('p div span br hr b strong i em u s strike del sub sup h1 h2 h3 h4 h5 h6 ul ol li blockquote pre code table caption thead tbody tfoot tr th td a img figure figcaption'.split(' '))
const discardedTags = new Set('script style iframe object embed link meta base form input button textarea select svg math template noscript'.split(' '))
const allowedStyles = new Set('color background-color font-family font-size font-weight font-style text-decoration text-align vertical-align white-space line-height letter-spacing word-spacing border border-top border-right border-bottom border-left border-color border-width border-style border-collapse border-spacing padding padding-top padding-right padding-bottom padding-left margin margin-top margin-right margin-bottom margin-left list-style-type width max-width'.split(' '))

export function isClipboardImage(value: string): boolean {
  return /^data:image\/(png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(value)
}

/** Rebuild clipboard HTML using inert DOM nodes: keep document layout, never scripts or remote resources. */
export function sanitizeClipboardHtml(source: string): string {
  const parsed = document.createElement('template')
  parsed.innerHTML = source
  const output = document.createElement('div')

  function append(node: Node, parent: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent ?? ''))
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const original = node as HTMLElement
    const tag = original.tagName.toLowerCase()
    if (discardedTags.has(tag)) return
    if (!allowedTags.has(tag)) {
      Array.from(original.childNodes).forEach((child) => append(child, parent))
      return
    }
    if (tag === 'img' && !isClipboardImage(original.getAttribute('src') ?? '')) {
      parent.appendChild(document.createTextNode(original.getAttribute('alt') || '［外部图片未保存］'))
      return
    }
    const clean = document.createElement(tag)
    for (const property of Array.from(original.style)) {
      const value = original.style.getPropertyValue(property)
      if (allowedStyles.has(property) && !/url\s*\(|expression|@|var\s*\(|\\/i.test(value)) {
        clean.style.setProperty(property, value)
      }
    }
    for (const attribute of ['colspan', 'rowspan', 'start']) {
      const value = original.getAttribute(attribute)
      if (value && /^\d{1,3}$/.test(value)) clean.setAttribute(attribute, value)
    }
    const href = original.getAttribute('href')
    if (tag === 'a' && href && /^(https?:\/\/|mailto:)/i.test(href)) clean.setAttribute('href', href)
    if (tag === 'img') {
      clean.setAttribute('src', original.getAttribute('src')!)
      clean.setAttribute('alt', original.getAttribute('alt') ?? '粘贴的图片')
      const width = original.getAttribute('width')
      if (width && /^\d{1,5}$/.test(width)) clean.setAttribute('width', width)
    }
    Array.from(original.childNodes).forEach((child) => append(child, clean))
    parent.appendChild(clean)
  }

  Array.from(parsed.content.childNodes).forEach((node) => append(node, output))
  return output.innerHTML
}

export function normalizeClipboardContent(content: ClipboardContent): ClipboardContent {
  const html = sanitizeClipboardHtml(content.html)
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  // Plain-text fallback must retain the boundaries of paragraphs and table rows.
  parsed.querySelectorAll('br').forEach((node) => node.replaceWith('\n'))
  parsed.querySelectorAll('p,div,li,tr,blockquote,pre,h1,h2,h3,h4,h5,h6').forEach((node) => node.append('\n'))
  parsed.querySelectorAll('td,th').forEach((node) => node.append('\t'))
  return {
    text: content.text || (parsed.body.textContent ?? ''),
    html,
    images: content.images.filter(isClipboardImage),
  }
}

export function hasClipboardContent(content: ClipboardContent): boolean {
  return Boolean(content.text.trim() || content.images.length || /<img\b/i.test(content.html))
}
