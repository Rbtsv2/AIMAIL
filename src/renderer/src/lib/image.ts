// src/renderer/src/lib/image.ts
// Redimensionne une image (data URL) pour l'e-mail : 800 px maxi, JPEG 85 % sauf PNG transparent conservé.
export async function shrinkImage(dataUrl: string, maxSize = 800): Promise<string> {
  if (!/^data:image\//.test(dataUrl) || /^data:image\/(svg\+xml|gif)/.test(dataUrl)) return dataUrl
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl })
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
  const isPng = /^data:image\/png/.test(dataUrl)
  if (scale === 1 && dataUrl.length < 300_000) return dataUrl
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  if (isPng) {
    // transparence ? on garde le PNG
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i] < 250) return canvas.toDataURL('image/png')
  }
  return canvas.toDataURL('image/jpeg', 0.85)
}