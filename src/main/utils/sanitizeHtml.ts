// src/main/utils/sanitizeHtml.ts
import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'

const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window as any)

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function sanitizeEmailHtml(html: string, opts: { loadRemoteImages: boolean; cidMap?: Record<string, string> }): string {
  let out = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'meta', 'link', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'srcset'],
    ALLOW_DATA_ATTR: false
  })
  if (opts.cidMap) {
    out = out.replace(/src=["']cid:([^"']+)["']/gi, (m, cid) => { const k = decodeURIComponent(cid).replace(/[<>]/g, ''); return opts.cidMap?.[k] ? `src="${opts.cidMap[k]}"` : m })
  }
  if (!opts.loadRemoteImages) {
    out = out.replace(/(<img[^>]+)src=["'](https?:\/\/[^"']+)["']/gi, '$1data-blocked-src="$2" src=""')
    out = out.replace(/url\((['"]?)https?:\/\/[^)]+\1\)/gi, 'none')
  }
  return out
}