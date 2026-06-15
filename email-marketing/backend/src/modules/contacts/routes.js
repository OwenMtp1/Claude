import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncRoute, ok, created } from '../../lib/http.js'
import { query, tx } from '../../db/pool.js'

const router = Router()
router.use(authRequired)

// ── Contacts ────────────────────────────────────────────────────────────────
router.get('/', asyncRoute(async (req, res) => {
  const { search, list_id } = req.query
  const params = [req.user.id]
  let sql = `select c.* from contacts c`
  if (list_id) {
    params.push(list_id)
    sql += ` join list_contacts lc on lc.contact_id = c.id and lc.list_id = $${params.length}`
  }
  sql += ` where c.user_id = $1`
  if (search) {
    params.push(`%${search}%`)
    sql += ` and (c.email ilike $${params.length} or c.first_name ilike $${params.length} or c.last_name ilike $${params.length} or c.company ilike $${params.length})`
  }
  sql += ` order by c.created_at desc limit 500`
  ok(res, (await query(sql, params)).rows)
}))

router.post('/', asyncRoute(async (req, res) => {
  const { email, first_name, last_name, company, title, custom } = req.body
  const { rows } = await query(
    `insert into contacts (user_id, email, first_name, last_name, company, title, custom)
       values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (user_id, email) do update set
       first_name = coalesce(excluded.first_name, contacts.first_name),
       last_name  = coalesce(excluded.last_name, contacts.last_name),
       company    = coalesce(excluded.company, contacts.company),
       title      = coalesce(excluded.title, contacts.title),
       custom     = contacts.custom || excluded.custom
     returning *`,
    [req.user.id, email, first_name || null, last_name || null, company || null, title || null, custom || {}]
  )
  created(res, rows[0])
}))

// Import en masse : [{email, first_name, ...}], optionnellement vers une liste.
router.post('/import', asyncRoute(async (req, res) => {
  const { contacts = [], list_id } = req.body
  const inserted = await tx(async (client) => {
    const out = []
    for (const c of contacts) {
      if (!c.email) continue
      const { rows } = await client.query(
        `insert into contacts (user_id, email, first_name, last_name, company, title, custom)
           values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (user_id, email) do update set
           first_name = coalesce(excluded.first_name, contacts.first_name),
           company    = coalesce(excluded.company, contacts.company)
         returning id`,
        [req.user.id, c.email, c.first_name || null, c.last_name || null, c.company || null, c.title || null, c.custom || {}]
      )
      out.push(rows[0].id)
      if (list_id) {
        await client.query(
          `insert into list_contacts (list_id, contact_id) values ($1,$2) on conflict do nothing`,
          [list_id, rows[0].id]
        )
      }
    }
    return out
  })
  ok(res, { imported: inserted.length })
}))

router.patch('/:id', asyncRoute(async (req, res) => {
  const fields = ['first_name', 'last_name', 'company', 'title', 'unsubscribed']
  const sets = []
  const params = [req.params.id, req.user.id]
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      params.push(req.body[f])
      sets.push(`${f} = $${params.length}`)
    }
  }
  if (!sets.length) return ok(res, null)
  const { rows } = await query(
    `update contacts set ${sets.join(', ')} where id = $1 and user_id = $2 returning *`,
    params
  )
  ok(res, rows[0])
}))

router.delete('/:id', asyncRoute(async (req, res) => {
  await query(`delete from contacts where id = $1 and user_id = $2`, [req.params.id, req.user.id])
  ok(res, { deleted: true })
}))

// ── Listes ──────────────────────────────────────────────────────────────────
router.get('/lists/all', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `select l.*, count(lc.contact_id)::int as contact_count
       from lists l left join list_contacts lc on lc.list_id = l.id
      where l.user_id = $1 group by l.id order by l.created_at desc`,
    [req.user.id]
  )
  ok(res, rows)
}))

router.post('/lists', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `insert into lists (user_id, name) values ($1,$2) returning *`,
    [req.user.id, req.body.name || 'Nouvelle liste']
  )
  created(res, rows[0])
}))

router.post('/lists/:id/contacts', asyncRoute(async (req, res) => {
  const ids = req.body.contact_ids || []
  await tx(async (client) => {
    for (const cid of ids) {
      await client.query(
        `insert into list_contacts (list_id, contact_id) values ($1,$2) on conflict do nothing`,
        [req.params.id, cid]
      )
    }
  })
  ok(res, { added: ids.length })
}))

router.delete('/lists/:id', asyncRoute(async (req, res) => {
  await query(`delete from lists where id = $1 and user_id = $2`, [req.params.id, req.user.id])
  ok(res, { deleted: true })
}))

export default router
