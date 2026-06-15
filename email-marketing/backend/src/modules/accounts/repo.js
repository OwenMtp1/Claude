import { query } from '../../db/pool.js'
import { encrypt, decrypt } from '../../lib/crypto.js'

// Couche d'accès aux boîtes email : (dé)chiffrement transparent des tokens.

export async function listAccounts(userId) {
  const { rows } = await query(
    `select id, provider, email, display_name, status, last_error,
            daily_send_count, daily_count_date, token_expires_at, created_at
       from email_accounts where user_id = $1 order by created_at`,
    [userId]
  )
  return rows
}

// Renvoie le compte avec tokens DÉCHIFFRÉS (usage interne providers).
export async function getDecryptedAccount(accountId, userId) {
  const { rows } = await query(
    `select * from email_accounts where id = $1 ${userId ? 'and user_id = $2' : ''}`,
    userId ? [accountId, userId] : [accountId]
  )
  const a = rows[0]
  if (!a) return null
  return {
    ...a,
    access_token: decrypt(a.access_token_enc),
    refresh_token: decrypt(a.refresh_token_enc),
  }
}

// Crée ou met à jour une boîte après OAuth (tokens en clair → chiffrés).
export async function upsertAccount(userId, tok) {
  const { rows } = await query(
    `insert into email_accounts
       (user_id, provider, email, display_name, access_token_enc, refresh_token_enc, token_expires_at, scope, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'connected')
     on conflict (user_id, email) do update set
       provider          = excluded.provider,
       display_name      = excluded.display_name,
       access_token_enc  = excluded.access_token_enc,
       refresh_token_enc = coalesce(excluded.refresh_token_enc, email_accounts.refresh_token_enc),
       token_expires_at  = excluded.token_expires_at,
       scope             = excluded.scope,
       status            = 'connected',
       last_error        = null,
       updated_at        = now()
     returning id, provider, email, display_name, status`,
    [
      userId, tok.provider, tok.email, tok.display_name,
      encrypt(tok.access_token), encrypt(tok.refresh_token),
      tok.token_expires_at, tok.scope,
    ]
  )
  return rows[0]
}

// Persiste les tokens rafraîchis renvoyés par un provider (champ _refreshed).
export async function persistRefreshed(accountId, refreshed) {
  if (!refreshed) return
  await query(
    `update email_accounts set
       access_token_enc = coalesce($2, access_token_enc),
       refresh_token_enc = coalesce($3, refresh_token_enc),
       token_expires_at = coalesce($4, token_expires_at),
       updated_at = now()
     where id = $1`,
    [
      accountId,
      refreshed.access_token ? encrypt(refreshed.access_token) : null,
      refreshed.refresh_token ? encrypt(refreshed.refresh_token) : null,
      refreshed.token_expires_at || null,
    ]
  )
}

export async function setAccountStatus(accountId, status, error = null) {
  await query(
    `update email_accounts set status = $2, last_error = $3, updated_at = now() where id = $1`,
    [accountId, status, error]
  )
}

export async function updateSyncCursor(accountId, cursor) {
  await query(`update email_accounts set sync_cursor = $2, updated_at = now() where id = $1`, [accountId, cursor])
}

// Compteur d'envois quotidien (rate limiting). Renvoie le compteur courant.
export async function bumpDailyCount(accountId) {
  const { rows } = await query(
    `update email_accounts set
       daily_send_count = case when daily_count_date = current_date then daily_send_count + 1 else 1 end,
       daily_count_date = current_date
     where id = $1
     returning daily_send_count`,
    [accountId]
  )
  return rows[0]?.daily_send_count || 0
}

export async function getTodayCount(accountId) {
  const { rows } = await query(
    `select case when daily_count_date = current_date then daily_send_count else 0 end as c
       from email_accounts where id = $1`,
    [accountId]
  )
  return rows[0]?.c || 0
}

export async function deleteAccount(accountId, userId) {
  await query(`delete from email_accounts where id = $1 and user_id = $2`, [accountId, userId])
}
