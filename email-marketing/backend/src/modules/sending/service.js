import { query } from '../../db/pool.js'
import { getProvider } from '../../providers/index.js'
import { instrumentHtml, renderTemplate } from '../../lib/tracking.js'
import {
  getDecryptedAccount, persistRefreshed, setAccountStatus,
  bumpDailyCount, getTodayCount,
} from '../accounts/repo.js'

// ─────────────────────────────────────────────────────────────────────────────
// Service d'envoi unifié. Rend le template, instrumente le HTML (pixel + clics),
// envoie via le bon provider, enregistre `emails_sent` + l'événement `sent`,
// persiste les tokens rafraîchis et incrémente le compteur quotidien.
// Renvoie { emailSentId, providerMessageId, threadId }.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendCampaignEmail({
  userId, campaign, sequence, contact, account, threadId, inReplyTo, references,
}) {
  const subject = renderTemplate(sequence.subject, contact)
  const renderedBody = renderTemplate(sequence.body_html, contact)

  // 1) Pré-insertion (statut queued) pour disposer du tracking_id avant l'envoi.
  const { rows: insRows } = await query(
    `insert into emails_sent
       (user_id, campaign_id, contact_id, sequence_id, email_account_id, thread_id, to_email, subject, body_html, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'queued')
     returning id, tracking_id`,
    [userId, campaign.id, contact.id, sequence.id, account.id, threadId || null, contact.email, subject, renderedBody]
  )
  const emailSent = insRows[0]

  const html = instrumentHtml(renderedBody, emailSent.tracking_id, {
    trackOpens: campaign.track_opens,
    trackClicks: campaign.track_clicks,
  })

  // 2) Envoi via provider.
  const provider = getProvider(account.provider)
  try {
    const result = await provider.sendEmail(account, {
      to: contact.email, subject, html, threadId, inReplyTo, references,
    })
    if (result._refreshed) await persistRefreshed(account.id, result._refreshed)
    await bumpDailyCount(account.id)

    await query(
      `update emails_sent set status='sent', provider_message_id=$2, thread_id=coalesce($3, thread_id), sent_at=now()
         where id=$1`,
      [emailSent.id, result.providerMessageId || null, result.threadId || threadId || null]
    )
    await query(
      `insert into events (email_sent_id, campaign_id, contact_id, type) values ($1,$2,$3,'sent')`,
      [emailSent.id, campaign.id, contact.id]
    )
    await setAccountStatus(account.id, 'connected', null)
    return {
      emailSentId: emailSent.id,
      providerMessageId: result.providerMessageId,
      threadId: result.threadId || threadId,
    }
  } catch (e) {
    await query(`update emails_sent set status='failed', error=$2 where id=$1`, [emailSent.id, e.message])
    await setAccountStatus(account.id, 'error', e.message)
    throw e
  }
}

// Vérifie le quota quotidien d'une boîte vis-à-vis de la limite de campagne.
export async function withinDailyLimit(accountId, dailyLimit) {
  const count = await getTodayCount(accountId)
  return count < dailyLimit
}

export { getDecryptedAccount }
