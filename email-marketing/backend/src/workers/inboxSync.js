import { query } from '../db/pool.js'
import { getProvider } from '../providers/index.js'
import {
  getDecryptedAccount, persistRefreshed, updateSyncCursor, setAccountStatus,
} from '../modules/accounts/repo.js'

// ─────────────────────────────────────────────────────────────────────────────
// Synchronise les boîtes connectées (polling) :
//   - récupère les nouveaux messages depuis le curseur de sync
//   - les enregistre dans `messages` (inbox + threads)
//   - détecte les RÉPONSES de prospects → événement 'reply' + stop séquence
// ─────────────────────────────────────────────────────────────────────────────

export async function syncAllInboxes() {
  const { rows: accounts } = await query(
    `select id, user_id from email_accounts where status = 'connected'`
  )
  let total = 0
  for (const a of accounts) {
    try {
      total += await syncAccount(a.id, a.user_id)
    } catch (e) {
      console.error('[inboxSync] échec boîte', a.id, e.message)
      await setAccountStatus(a.id, 'error', e.message).catch(() => {})
    }
  }
  if (total) console.log(`[inboxSync] ${total} message(s) synchronisé(s)`)
  return total
}

async function syncAccount(accountId, userId) {
  const account = await getDecryptedAccount(accountId)
  const provider = getProvider(account.provider)
  const { messages, cursor, _refreshed } = await provider.fetchInbox(account, { sinceCursor: account.sync_cursor })
  if (_refreshed) await persistRefreshed(accountId, _refreshed)

  let n = 0
  for (const m of messages) {
    // Rattache le message à un contact connu (par adresse).
    const fromAddr = extractEmail(m.from)
    const contact = (await query(
      `select id from contacts where user_id=$1 and lower(email)=lower($2) limit 1`, [userId, fromAddr]
    )).rows[0]

    const ins = await query(
      `insert into messages
         (email_account_id, thread_id, provider_message_id, direction, from_email, to_email, subject, snippet, body_html, contact_id, is_read, has_attachments, received_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (email_account_id, provider_message_id) do nothing
       returning id`,
      [accountId, m.threadId, m.providerMessageId, m.direction, m.from, m.to, m.subject,
       m.snippet, m.bodyHtml, contact?.id || null, !m.isUnread, !!m.hasAttachments, m.receivedAt]
    )
    if (ins.rowCount) n++

    // Détection de réponse : message inbound dont le thread correspond à une campagne.
    if (ins.rowCount && m.direction === 'inbound') {
      await handleReply(m.threadId, userId)
    }
  }

  await updateSyncCursor(accountId, cursor)
  await setAccountStatus(accountId, 'connected', null)
  return n
}

// Si le thread appartient à un envoi de campagne avec stop_on_reply, on arrête.
async function handleReply(threadId, userId) {
  const { rows } = await query(
    `select cc.id as cc_id, cc.contact_id, cc.campaign_id, c.stop_on_reply
       from campaign_contacts cc
       join campaigns c on c.id = cc.campaign_id
      where cc.thread_id = $1 and c.user_id = $2 and cc.status = 'active'`,
    [threadId, userId]
  )
  for (const r of rows) {
    // événement reply (rattaché au dernier email envoyé du thread)
    const es = (await query(
      `select id from emails_sent where campaign_id=$1 and contact_id=$2 order by created_at desc limit 1`,
      [r.campaign_id, r.contact_id]
    )).rows[0]
    await query(
      `insert into events (email_sent_id, campaign_id, contact_id, type) values ($1,$2,$3,'reply')`,
      [es?.id || null, r.campaign_id, r.contact_id]
    )
    if (r.stop_on_reply) {
      await query(
        `update campaign_contacts set status='replied', next_send_at=null where id=$1`, [r.cc_id]
      )
    }
  }
}

function extractEmail(s) {
  const m = String(s || '').match(/<([^>]+)>/)
  return (m ? m[1] : s || '').trim().toLowerCase()
}
