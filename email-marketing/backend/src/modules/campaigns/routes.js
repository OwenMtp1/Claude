import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncRoute, ok, created, HttpError } from '../../lib/http.js'
import { query, tx } from '../../db/pool.js'
import { getDecryptedAccount } from '../accounts/repo.js'
import { sendCampaignEmail } from '../sending/service.js'
import { computeNextSendAt } from '../../workers/schedule.js'

const router = Router()
router.use(authRequired)

// ── Campagnes ─────────────────────────────────────────────────────────────
router.get('/', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `select c.*,
            (select count(*) from campaign_contacts cc where cc.campaign_id=c.id)::int as contacts,
            (select count(*) from emails_sent e where e.campaign_id=c.id and e.status='sent')::int as sent
       from campaigns c where c.user_id=$1 order by c.created_at desc`,
    [req.user.id]
  )
  ok(res, rows)
}))

router.get('/:id', asyncRoute(async (req, res) => {
  const { rows } = await query(`select * from campaigns where id=$1 and user_id=$2`, [req.params.id, req.user.id])
  if (!rows[0]) throw new HttpError(404, 'Campagne introuvable')
  const seqs = await query(`select * from sequences where campaign_id=$1 order by step_order`, [req.params.id])
  ok(res, { ...rows[0], sequences: seqs.rows })
}))

router.post('/', asyncRoute(async (req, res) => {
  const { name, email_account_id, daily_limit, send_window, stop_on_reply, track_opens, track_clicks, timezone } = req.body
  const { rows } = await query(
    `insert into campaigns (user_id, name, email_account_id, daily_limit, send_window, stop_on_reply, track_opens, track_clicks, timezone)
     values ($1,$2,$3,coalesce($4,50),coalesce($5,'{"days":[1,2,3,4,5],"start":"09:00","end":"18:00"}'::jsonb),
             coalesce($6,true),coalesce($7,true),coalesce($8,true),coalesce($9,'Europe/Paris'))
     returning *`,
    [req.user.id, name || 'Nouvelle campagne', email_account_id || null, daily_limit || null,
     send_window ? JSON.stringify(send_window) : null, stop_on_reply, track_opens, track_clicks, timezone || null]
  )
  created(res, rows[0])
}))

router.patch('/:id', asyncRoute(async (req, res) => {
  const allowed = ['name', 'email_account_id', 'status', 'daily_limit', 'send_window', 'stop_on_reply', 'track_opens', 'track_clicks', 'timezone']
  const sets = []
  const params = [req.params.id, req.user.id]
  for (const f of allowed) {
    if (req.body[f] !== undefined) {
      params.push(f === 'send_window' ? JSON.stringify(req.body[f]) : req.body[f])
      sets.push(`${f} = $${params.length}`)
    }
  }
  if (!sets.length) return ok(res, null)
  sets.push('updated_at = now()')
  const { rows } = await query(
    `update campaigns set ${sets.join(', ')} where id=$1 and user_id=$2 returning *`, params
  )
  ok(res, rows[0])
}))

router.delete('/:id', asyncRoute(async (req, res) => {
  await query(`delete from campaigns where id=$1 and user_id=$2`, [req.params.id, req.user.id])
  ok(res, { deleted: true })
}))

// ── Séquences (étapes) ────────────────────────────────────────────────────
router.put('/:id/sequences', asyncRoute(async (req, res) => {
  // Remplace l'ensemble des étapes (pratique pour le builder front).
  const steps = req.body.sequences || []
  await tx(async (client) => {
    await client.query(`delete from sequences where campaign_id=$1`, [req.params.id])
    let i = 1
    for (const s of steps) {
      await client.query(
        `insert into sequences (campaign_id, step_order, subject, body_html, delay_days, delay_hours)
         values ($1,$2,$3,$4,$5,$6)`,
        [req.params.id, i++, s.subject || '', s.body_html || '', s.delay_days || 0, s.delay_hours || 0]
      )
    }
  })
  const seqs = await query(`select * from sequences where campaign_id=$1 order by step_order`, [req.params.id])
  ok(res, seqs.rows)
}))

// ── Enrôlement de contacts ────────────────────────────────────────────────
router.post('/:id/contacts', asyncRoute(async (req, res) => {
  // Accepte contact_ids[] et/ou list_ids[].
  const { contact_ids = [], list_ids = [] } = req.body
  const campaign = (await query(`select * from campaigns where id=$1 and user_id=$2`, [req.params.id, req.user.id])).rows[0]
  if (!campaign) throw new HttpError(404, 'Campagne introuvable')

  const ids = new Set(contact_ids)
  if (list_ids.length) {
    const { rows } = await query(
      `select contact_id from list_contacts where list_id = any($1::uuid[])`, [list_ids]
    )
    rows.forEach((r) => ids.add(r.contact_id))
  }

  const firstStep = (await query(
    `select * from sequences where campaign_id=$1 order by step_order limit 1`, [req.params.id]
  )).rows[0]

  const enrolled = await tx(async (client) => {
    let n = 0
    for (const cid of ids) {
      const nextAt = firstStep ? computeNextSendAt(new Date(), firstStep, campaign) : new Date()
      const r = await client.query(
        `insert into campaign_contacts (campaign_id, contact_id, next_send_at)
           values ($1,$2,$3) on conflict (campaign_id, contact_id) do nothing returning id`,
        [req.params.id, cid, nextAt]
      )
      if (r.rowCount) n++
    }
    return n
  })
  ok(res, { enrolled })
}))

router.get('/:id/contacts', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `select cc.*, c.email, c.first_name, c.last_name, c.company
       from campaign_contacts cc join contacts c on c.id=cc.contact_id
      where cc.campaign_id=$1 order by cc.added_at desc`,
    [req.params.id]
  )
  ok(res, rows)
}))

// ── Test d'envoi immédiat (1 contact, 1ʳᵉ étape) ──────────────────────────
router.post('/:id/test', asyncRoute(async (req, res) => {
  const campaign = (await query(`select * from campaigns where id=$1 and user_id=$2`, [req.params.id, req.user.id])).rows[0]
  if (!campaign) throw new HttpError(404, 'Campagne introuvable')
  if (!campaign.email_account_id) throw new HttpError(400, 'Aucune boîte email associée à la campagne')
  const sequence = (await query(`select * from sequences where campaign_id=$1 order by step_order limit 1`, [req.params.id])).rows[0]
  if (!sequence) throw new HttpError(400, 'Aucune étape définie')
  const account = await getDecryptedAccount(campaign.email_account_id, req.user.id)
  const contact = { email: req.body.to || req.user.email, first_name: 'Test', company: 'BD Report' }

  const result = await sendCampaignEmail({ userId: req.user.id, campaign, sequence, contact, account })
  ok(res, result)
}))

export default router
