import { Router } from 'express'
import { env } from '../../config/env.js'
import { authRequired, signIdentity, verifyIdentity } from '../../middleware/auth.js'
import { asyncRoute, ok, HttpError } from '../../lib/http.js'
import { getProvider, availableProviders } from '../../providers/index.js'
import { listAccounts, upsertAccount, deleteAccount } from './repo.js'
import { query } from '../../db/pool.js'

const router = Router()

// Liste des fournisseurs configurés côté serveur (Gmail/Outlook).
router.get('/providers', (req, res) => ok(res, availableProviders()))

// Boîtes connectées de l'utilisateur.
router.get('/', authRequired, asyncRoute(async (req, res) => {
  ok(res, await listAccounts(req.user.id))
}))

// Démarre le flux OAuth. On signe l'identité CRM dans le `state` pour la
// retrouver dans le callback (où il n'y a pas d'en-tête Authorization).
router.get('/oauth/:provider/start', authRequired, asyncRoute(async (req, res) => {
  const provider = getProvider(req.params.provider)
  if (!provider.isConfigured()) throw new HttpError(400, `${req.params.provider} non configuré côté serveur`)
  const state = signIdentity({ crmUserId: req.user.crm_user_id, email: req.user.email, name: req.user.name })
  res.json({ ok: true, data: { url: provider.getAuthUrl(state) } })
}))

// Callback OAuth : échange le code, persiste la boîte, redirige vers le front.
router.get('/oauth/:provider/callback', asyncRoute(async (req, res) => {
  const { code, state, error } = req.query
  if (error) return res.redirect(`${env.frontendUrl}/#/settings?email_error=${encodeURIComponent(error)}`)
  const identity = verifyIdentity(state)
  if (!identity?.crmUserId) throw new HttpError(401, 'state invalide')

  // Retrouve/crée l'utilisateur
  const { rows } = await query(
    `insert into users (crm_user_id, email, name) values ($1,$2,$3)
     on conflict (crm_user_id) do update set email = coalesce(excluded.email, users.email)
     returning *`,
    [identity.crmUserId, identity.email || null, identity.name || null]
  )
  const user = rows[0]

  const provider = getProvider(req.params.provider)
  const tok = await provider.exchangeCode(code)
  await upsertAccount(user.id, tok)
  res.redirect(`${env.frontendUrl}/#/settings?email_connected=${encodeURIComponent(tok.email)}`)
}))

// Déconnecte une boîte.
router.delete('/:id', authRequired, asyncRoute(async (req, res) => {
  await deleteAccount(req.params.id, req.user.id)
  ok(res, { deleted: true })
}))

export default router
