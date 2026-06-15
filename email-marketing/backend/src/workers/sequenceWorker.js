import { query } from '../db/pool.js'
import { env } from '../config/env.js'
import { computeNextSendAt, inWindow } from './schedule.js'
import { getDecryptedAccount } from '../modules/accounts/repo.js'
import { sendCampaignEmail, withinDailyLimit } from '../modules/sending/service.js'

// ─────────────────────────────────────────────────────────────────────────────
// Traite les étapes de séquence dues. À appeler périodiquement (cron).
// Pour chaque campaign_contact 'active' dont next_send_at <= now :
//   - vérifie campagne active, fenêtre d'envoi, quota quotidien, stop_on_reply
//   - envoie l'étape courante+1, met à jour current_step / next_send_at / status
// ─────────────────────────────────────────────────────────────────────────────

export async function processDueSequences({ limit = env.sendBatchSize } = {}) {
  const { rows: due } = await query(
    `select cc.*, c.user_id, c.email_account_id, c.daily_limit, c.send_window, c.stop_on_reply,
            c.status as campaign_status, c.track_opens, c.track_clicks, c.timezone, c.id as campaign_id
       from campaign_contacts cc
       join campaigns c on c.id = cc.campaign_id
      where cc.status = 'active'
        and cc.next_send_at is not null
        and cc.next_send_at <= now()
        and c.status = 'active'
      order by cc.next_send_at asc
      limit $1`,
    [limit]
  )

  let sent = 0
  for (const row of due) {
    try {
      const campaign = {
        id: row.campaign_id, user_id: row.user_id, email_account_id: row.email_account_id,
        daily_limit: row.daily_limit, send_window: row.send_window, stop_on_reply: row.stop_on_reply,
        track_opens: row.track_opens, track_clicks: row.track_clicks, timezone: row.timezone,
      }

      if (!campaign.email_account_id) { await skip(row.id); continue }
      if (!inWindow(new Date(), campaign.send_window || {})) {
        // hors fenêtre → repousse au prochain créneau
        await query(`update campaign_contacts set next_send_at=$2 where id=$1`,
          [row.id, computeNextSendAt(new Date(), { delay_days: 0, delay_hours: 0 }, campaign)])
        continue
      }
      if (!(await withinDailyLimit(campaign.email_account_id, campaign.daily_limit))) continue

      // Étape suivante.
      const nextStepOrder = (row.current_step || 0) + 1
      const step = (await query(
        `select * from sequences where campaign_id=$1 and step_order=$2`, [campaign.id, nextStepOrder]
      )).rows[0]
      if (!step) { await complete(row.id); continue }

      const contact = (await query(`select * from contacts where id=$1`, [row.contact_id])).rows[0]
      if (!contact || contact.unsubscribed) { await unsub(row.id); continue }

      const account = await getDecryptedAccount(campaign.email_account_id)
      const result = await sendCampaignEmail({
        userId: campaign.user_id, campaign, sequence: step, contact, account,
        threadId: row.thread_id, inReplyTo: null,
      })
      sent++

      // Programme l'étape d'après (s'il y en a une).
      const after = (await query(
        `select * from sequences where campaign_id=$1 and step_order=$2`, [campaign.id, nextStepOrder + 1]
      )).rows[0]
      const nextSendAt = after ? computeNextSendAt(new Date(), after, campaign) : null
      await query(
        `update campaign_contacts set
           current_step=$2, thread_id=coalesce($3, thread_id),
           next_send_at=$4, status=case when $4 is null then 'completed' else 'active' end
         where id=$1`,
        [row.id, nextStepOrder, result.threadId || null, nextSendAt]
      )
    } catch (e) {
      console.error('[sequenceWorker] échec contact', row.id, e.message)
      await query(`update campaign_contacts set status='failed' where id=$1`, [row.id]).catch(() => {})
    }
  }
  if (sent) console.log(`[sequenceWorker] ${sent} email(s) envoyé(s)`)
  return sent
}

const skip = (id) => query(`update campaign_contacts set next_send_at=now()+interval '1 hour' where id=$1`, [id])
const complete = (id) => query(`update campaign_contacts set status='completed', next_send_at=null where id=$1`, [id])
const unsub = (id) => query(`update campaign_contacts set status='unsubscribed', next_send_at=null where id=$1`, [id])
