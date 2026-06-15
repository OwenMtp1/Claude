import crypto from 'node:crypto'
import { env } from '../config/env.js'
import { query } from '../db/pool.js'
import { HttpError } from '../lib/http.js'

// ─────────────────────────────────────────────────────────────────────────────
// Authentification légère CRM → backend email.
// Le CRM (front SPA) signe l'identité de l'utilisateur courant avec le secret
// partagé et l'envoie dans l'en-tête `Authorization: Bearer <token>`.
// Le token est un JWT-like minimal : base64url(payload).base64url(hmacSHA256).
// payload = { crmUserId, email, name, iat }. Pas de dépendance externe.
// ─────────────────────────────────────────────────────────────────────────────

const b64url = (buf) => Buffer.from(buf).toString('base64url')

export function signIdentity(payload) {
  const body = b64url(JSON.stringify({ ...payload, iat: Date.now() }))
  const sig = crypto.createHmac('sha256', env.appSharedSecret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyIdentity(token) {
  const [body, sig] = String(token || '').split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', env.appSharedSecret).update(body).digest('base64url')
  // comparaison à temps constant
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

// Récupère (ou crée) la ligne `users` correspondant à l'identité CRM et
// l'attache à req.user. À utiliser sur toutes les routes /api protégées.
export async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    const identity = verifyIdentity(token)
    if (!identity?.crmUserId) throw new HttpError(401, 'Non authentifié')

    const { rows } = await query(
      `insert into users (crm_user_id, email, name)
         values ($1, $2, $3)
       on conflict (crm_user_id) do update
         set email = coalesce(excluded.email, users.email),
             name  = coalesce(excluded.name, users.name)
       returning *`,
      [identity.crmUserId, identity.email || null, identity.name || null]
    )
    req.user = rows[0]
    next()
  } catch (e) {
    next(e)
  }
}
