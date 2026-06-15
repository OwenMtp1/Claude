import { env } from '../config/env.js'

// Pixel transparent 1x1 GIF (servi sur l'ouverture d'un email).
export const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

const pixelUrl = (trackingId) =>
  `${env.publicBaseUrl}/t/o/${trackingId}.gif`

const clickUrl = (trackingId, target) =>
  `${env.publicBaseUrl}/t/c/${trackingId}?u=${encodeURIComponent(target)}`

// Réécrit les liens <a href> pour passer par le redirecteur de tracking,
// et injecte le pixel d'ouverture juste avant </body> (ou en fin de contenu).
export function instrumentHtml(html, trackingId, { trackOpens = true, trackClicks = true } = {}) {
  let out = html || ''

  if (trackClicks) {
    out = out.replace(/href\s*=\s*"(https?:\/\/[^"]+)"/gi, (m, url) => {
      // ne pas réécrire les liens de désinscription explicites
      if (/unsubscribe|mailto:/i.test(url)) return m
      return `href="${clickUrl(trackingId, url)}"`
    })
  }

  if (trackOpens) {
    const img = `<img src="${pixelUrl(trackingId)}" width="1" height="1" alt="" style="display:none" />`
    out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${img}</body>`) : out + img
  }

  return out
}

// Remplit les variables {{first_name}}, {{company}}, etc. depuis un contact.
export function renderTemplate(text, contact = {}) {
  const vars = {
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    company: contact.company || '',
    title: contact.title || '',
    email: contact.email || '',
    ...(contact.custom || {}),
  }
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) =>
    vars[k] != null ? String(vars[k]) : ''
  )
}
