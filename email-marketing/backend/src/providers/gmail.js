import { google } from 'googleapis'
import { env, isGmailConfigured } from '../config/env.js'

// ─────────────────────────────────────────────────────────────────────────────
// Fournisseur Gmail (API Gmail + OAuth2 Google).
// Toutes les fonctions reçoivent un `account` (ligne email_accounts déchiffrée :
// { access_token, refresh_token, token_expires_at, ... }) et renvoient, le cas
// échéant, les tokens rafraîchis via le champ `_refreshed`.
// ─────────────────────────────────────────────────────────────────────────────

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
]

function oauthClient() {
  return new google.auth.OAuth2(env.google.clientId, env.google.clientSecret, env.google.redirectUri)
}

export const isConfigured = isGmailConfigured

export function getAuthUrl(state) {
  const client = oauthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  })
}

// Échange le code OAuth contre des tokens + lit l'adresse de la boîte.
export async function exchangeCode(code) {
  const client = oauthClient()
  const { tokens } = client.getToken ? await client.getToken(code) : {}
  client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const { data: profile } = await oauth2.userinfo.get()
  return {
    provider: 'gmail',
    email: profile.email,
    display_name: profile.name || profile.email,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scope: (tokens.scope || SCOPES.join(' ')),
  }
}

// Construit un client authentifié, rafraîchit le token si nécessaire.
async function authedClient(account) {
  const client = oauthClient()
  client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.token_expires_at ? new Date(account.token_expires_at).getTime() : undefined,
  })
  let refreshed = null
  client.on('tokens', (t) => {
    refreshed = {
      access_token: t.access_token || account.access_token,
      token_expires_at: t.expiry_date ? new Date(t.expiry_date) : account.token_expires_at,
      ...(t.refresh_token ? { refresh_token: t.refresh_token } : {}),
    }
  })
  // force un rafraîchissement si expiré
  if (account.token_expires_at && new Date(account.token_expires_at).getTime() < Date.now() + 60_000) {
    const { credentials } = await client.refreshAccessToken()
    refreshed = {
      access_token: credentials.access_token,
      token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      ...(credentials.refresh_token ? { refresh_token: credentials.refresh_token } : {}),
    }
  }
  return { gmail: google.gmail({ version: 'v1', auth: client }), refreshed: () => refreshed }
}

function buildRawMessage({ from, to, subject, html, inReplyTo, references }) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject || '', 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ]
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`)
  if (references) headers.push(`References: ${references}`)
  const message = headers.join('\r\n') + '\r\n\r\n' + (html || '')
  return Buffer.from(message, 'utf8').toString('base64url')
}

export async function sendEmail(account, { to, subject, html, threadId, inReplyTo, references }) {
  const { gmail, refreshed } = await authedClient(account)
  const raw = buildRawMessage({ from: account.email, to, subject, html, inReplyTo, references })
  const { data } = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, ...(threadId ? { threadId } : {}) },
  })
  return {
    providerMessageId: data.id,
    threadId: data.threadId,
    _refreshed: refreshed(),
  }
}

// Récupère les messages reçus depuis le dernier curseur (historyId).
// Renvoie { messages: [...], cursor: newHistoryId }.
export async function fetchInbox(account, { sinceCursor } = {}) {
  const { gmail, refreshed } = await authedClient(account)
  const messages = []
  let newCursor = sinceCursor

  // Profil → historyId courant
  const { data: profile } = await gmail.users.getProfile({ userId: 'me' })
  newCursor = String(profile.historyId)

  let ids = []
  if (sinceCursor) {
    try {
      const { data } = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: sinceCursor,
        historyTypes: ['messageAdded'],
      })
      ids = (data.history || []).flatMap((h) => (h.messagesAdded || []).map((m) => m.message.id))
    } catch {
      // historyId trop ancien → on liste les derniers messages
      const { data } = await gmail.users.messages.list({ userId: 'me', maxResults: 25 })
      ids = (data.messages || []).map((m) => m.id)
    }
  } else {
    const { data } = await gmail.users.messages.list({ userId: 'me', maxResults: 25 })
    ids = (data.messages || []).map((m) => m.id)
  }

  for (const id of [...new Set(ids)]) {
    const { data: full } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
    messages.push(parseGmailMessage(full))
  }
  return { messages, cursor: newCursor, _refreshed: refreshed() }
}

function header(payload, name) {
  const h = (payload?.headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase())
  return h?.value || ''
}

function extractHtml(payload) {
  if (!payload) return ''
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8')
  }
  for (const part of payload.parts || []) {
    const found = extractHtml(part)
    if (found) return found
  }
  if (payload.body?.data) return Buffer.from(payload.body.data, 'base64').toString('utf8')
  return ''
}

function parseGmailMessage(full) {
  const p = full.payload
  const labelIds = full.labelIds || []
  const direction = labelIds.includes('SENT') ? 'outbound' : 'inbound'
  return {
    providerMessageId: full.id,
    threadId: full.threadId,
    direction,
    from: header(p, 'From'),
    to: header(p, 'To'),
    subject: header(p, 'Subject'),
    snippet: full.snippet || '',
    bodyHtml: extractHtml(p),
    messageIdHeader: header(p, 'Message-ID'),
    references: header(p, 'References'),
    hasAttachments: (p?.parts || []).some((pt) => pt.filename),
    receivedAt: new Date(parseInt(full.internalDate || Date.now(), 10)),
    isUnread: labelIds.includes('UNREAD'),
  }
}
