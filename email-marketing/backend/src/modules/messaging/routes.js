import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncRoute, ok, HttpError } from '../../lib/http.js'
import { query } from '../../db/pool.js'
import { getDecryptedAccount, persistRefreshed } from '../accounts/repo.js'
import { getProvider } from '../../providers/index.js'

const router = Router()
router.use(authRequired)

// Liste des threads (dernier message de chaque conversation) pour les boîtes de l'utilisateur.
router.get('/threads', asyncRoute(async (req, res) => {
  const { account_id } = req.query
  const params = [req.user.id]
  let filter = ''
  if (account_id) { params.push(account_id); filter = `and m.email_account_id = $${params.length}` }
  const { rows } = await query(
    `select distinct on (m.thread_id)
            m.thread_id, m.email_account_id, m.subject, m.snippet, m.from_email, m.to_email,
            m.direction, m.is_read, m.received_at, m.contact_id,
            (select count(*) from messages mm where mm.thread_id=m.thread_id and mm.email_account_id=m.email_account_id)::int as count
       from messages m
       join email_accounts ea on ea.id = m.email_account_id and ea.user_id = $1
      where true ${filter}
      order by m.thread_id, m.received_at desc`,
    params
  )
  rows.sort((a, b) => new Date(b.received_at) - new Date(a.received_at))
  ok(res, rows)
}))

// Messages d'un thread (ordre chronologique).
router.get('/threads/:threadId', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `select m.* from messages m
       join email_accounts ea on ea.id = m.email_account_id and ea.user_id = $1
      where m.thread_id = $2 order by m.received_at asc`,
    [req.user.id, req.params.threadId]
  )
  // marque comme lu
  await query(
    `update messages set is_read = true where thread_id = $1 and direction = 'inbound'
       and email_account_id in (select id from email_accounts where user_id = $2)`,
    [req.params.threadId, req.user.id]
  )
  ok(res, rows)
}))

// Répondre dans un thread depuis le CRM.
router.post('/threads/:threadId/reply', asyncRoute(async (req, res) => {
  const { account_id, body_html } = req.body
  const account = await getDecryptedAccount(account_id, req.user.id)
  if (!account) throw new HttpError(404, 'Boîte introuvable')

  // Dernier message inbound du thread → destinataire + référence.
  const last = (await query(
    `select * from messages where thread_id=$1 and email_account_id=$2 order by received_at desc limit 1`,
    [req.params.threadId, account_id]
  )).rows[0]
  if (!last) throw new HttpError(404, 'Thread introuvable')

  const provider = getProvider(account.provider)
  const to = last.direction === 'inbound' ? last.from_email : last.to_email
  const result = await provider.sendEmail(account, {
    to,
    subject: last.subject?.startsWith('Re:') ? last.subject : `Re: ${last.subject || ''}`,
    html: body_html,
    threadId: req.params.threadId,
    inReplyTo: last.provider_message_id,
  })
  if (result._refreshed) await persistRefreshed(account.id, result._refreshed)

  const { rows } = await query(
    `insert into messages (email_account_id, thread_id, provider_message_id, direction, from_email, to_email, subject, snippet, body_html, is_read)
     values ($1,$2,$3,'outbound',$4,$5,$6,$7,$8,true)
     on conflict (email_account_id, provider_message_id) do nothing
     returning *`,
    [account.id, req.params.threadId, result.providerMessageId || `local-${Date.now()}`, account.email, to,
     last.subject || '', (body_html || '').replace(/<[^>]+>/g, '').slice(0, 200), body_html]
  )
  ok(res, rows[0] || { sent: true })
}))

export default router
