import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncRoute, ok } from '../../lib/http.js'
import { query } from '../../db/pool.js'

const router = Router()
router.use(authRequired)

// Filtres communs : campaign_id, from, to (dates ISO).
function buildFilter(req, alias = 'e') {
  const params = [req.user.id]
  let sql = ` and ${alias}.user_id = $1`
  if (req.query.campaign_id) { params.push(req.query.campaign_id); sql += ` and ${alias}.campaign_id = $${params.length}` }
  if (req.query.from) { params.push(req.query.from); sql += ` and ${alias}.created_at >= $${params.length}` }
  if (req.query.to) { params.push(req.query.to); sql += ` and ${alias}.created_at <= $${params.length}` }
  return { sql, params }
}

// KPIs globaux : envoyés, ouvertures (uniques), clics, réponses, bounces + taux.
router.get('/summary', asyncRoute(async (req, res) => {
  const { sql, params } = buildFilter(req)
  const sent = await query(`select count(*)::int n from emails_sent e where e.status='sent' ${sql}`, params)

  // Événements rattachés aux emails de l'utilisateur (jointure pour le scoping).
  const evParams = [...params]
  const ev = await query(
    `select ev.type, count(distinct ev.email_sent_id)::int as uniq, count(*)::int as total
       from events ev join emails_sent e on e.id = ev.email_sent_id
      where e.status='sent' ${sql.replace(/e\.user_id = \$1/, 'e.user_id = $1')}
      group by ev.type`,
    evParams
  )
  const byType = Object.fromEntries(ev.rows.map((r) => [r.type, r]))
  const sentN = sent.rows[0].n || 0
  const opens = byType.open?.uniq || 0
  const clicks = byType.click?.uniq || 0
  const replies = byType.reply?.uniq || 0
  const bounces = byType.bounce?.uniq || 0
  const pct = (a) => (sentN ? Math.round((a / sentN) * 1000) / 10 : 0)

  ok(res, {
    sent: sentN,
    opens, clicks, replies, bounces,
    openRate: pct(opens), clickRate: pct(clicks), replyRate: pct(replies), bounceRate: pct(bounces),
  })
}))

// Série temporelle (par jour) des envois et ouvertures.
router.get('/timeseries', asyncRoute(async (req, res) => {
  const { sql, params } = buildFilter(req)
  const { rows } = await query(
    `select to_char(date_trunc('day', e.created_at), 'YYYY-MM-DD') as day,
            count(*) filter (where e.status='sent')::int as sent,
            count(distinct ev.email_sent_id) filter (where ev.type='open')::int as opens,
            count(distinct ev.email_sent_id) filter (where ev.type='click')::int as clicks
       from emails_sent e left join events ev on ev.email_sent_id = e.id
      where true ${sql}
      group by 1 order by 1`,
    params
  )
  ok(res, rows)
}))

// Performance par campagne (pour tableau comparatif).
router.get('/by-campaign', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `select c.id, c.name,
            count(distinct e.id) filter (where e.status='sent')::int as sent,
            count(distinct ev.email_sent_id) filter (where ev.type='open')::int as opens,
            count(distinct ev.email_sent_id) filter (where ev.type='click')::int as clicks,
            count(distinct ev.email_sent_id) filter (where ev.type='reply')::int as replies
       from campaigns c
       left join emails_sent e on e.campaign_id = c.id
       left join events ev on ev.email_sent_id = e.id
      where c.user_id = $1
      group by c.id, c.name order by sent desc`,
    [req.user.id]
  )
  ok(res, rows)
}))

export default router
