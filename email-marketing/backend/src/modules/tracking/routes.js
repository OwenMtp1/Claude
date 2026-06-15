import { Router } from 'express'
import { query } from '../../db/pool.js'
import { asyncRoute } from '../../lib/http.js'
import { TRACKING_PIXEL } from '../../lib/tracking.js'

// Routes publiques (pas d'auth) : appelées par les clients mail des destinataires.
const router = Router()

async function recordEvent(trackingId, type, { url, req } = {}) {
  const { rows } = await query(`select id, campaign_id, contact_id from emails_sent where tracking_id = $1`, [trackingId])
  const es = rows[0]
  if (!es) return
  await query(
    `insert into events (email_sent_id, campaign_id, contact_id, type, url, user_agent, ip)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [es.id, es.campaign_id, es.contact_id, type, url || null,
     req?.headers['user-agent'] || null, req?.headers['x-forwarded-for'] || req?.ip || null]
  )
}

// Pixel d'ouverture.
router.get('/o/:trackingId.gif', asyncRoute(async (req, res) => {
  await recordEvent(req.params.trackingId, 'open', { req }).catch(() => {})
  res.set('Content-Type', 'image/gif')
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.send(TRACKING_PIXEL)
}))

// Redirecteur de clic.
router.get('/c/:trackingId', asyncRoute(async (req, res) => {
  const target = req.query.u
  await recordEvent(req.params.trackingId, 'click', { url: target, req }).catch(() => {})
  if (target && /^https?:\/\//i.test(target)) return res.redirect(target)
  res.status(400).send('Lien invalide')
}))

export default router
