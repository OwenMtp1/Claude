import { env, isOutlookConfigured } from '../config/env.js'

// ─────────────────────────────────────────────────────────────────────────────
// Fournisseur Outlook (Microsoft Graph + OAuth2 Azure AD).
// Implémenté sur `fetch` natif (Node ≥ 20), sans SDK lourd.
// ─────────────────────────────────────────────────────────────────────────────

const SCOPES = [
  'offline_access',
  'openid',
  'email',
  'profile',
  'Mail.Read',
  'Mail.Send',
]

const authBase = (tenant) => `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`
const GRAPH = 'https://graph.microsoft.com/v1.0'

export const isConfigured = isOutlookConfigured

export function getAuthUrl(state) {
  const p = new URLSearchParams({
    client_id: env.microsoft.clientId,
    response_type: 'code',
    redirect_uri: env.microsoft.redirectUri,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    state,
  })
  return `${authBase(env.microsoft.tenant)}/authorize?${p.toString()}`
}

async function tokenRequest(params) {
  const res = await fetch(`${authBase(env.microsoft.tenant)}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.microsoft.clientId,
      client_secret: env.microsoft.clientSecret,
      redirect_uri: env.microsoft.redirectUri,
      ...params,
    }),
  })
  if (!res.ok) throw new Error(`OAuth Microsoft: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function exchangeCode(code) {
  const tok = await tokenRequest({ grant_type: 'authorization_code', code, scope: SCOPES.join(' ') })
  const me = await graphGet(tok.access_token, '/me')
  return {
    provider: 'outlook',
    email: me.mail || me.userPrincipalName,
    display_name: me.displayName,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    token_expires_at: new Date(Date.now() + (tok.expires_in || 3600) * 1000),
    scope: tok.scope || SCOPES.join(' '),
  }
}

async function ensureToken(account) {
  if (account.token_expires_at && new Date(account.token_expires_at).getTime() > Date.now() + 60_000) {
    return { accessToken: account.access_token, refreshed: null }
  }
  const tok = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: account.refresh_token,
    scope: SCOPES.join(' '),
  })
  const refreshed = {
    access_token: tok.access_token,
    token_expires_at: new Date(Date.now() + (tok.expires_in || 3600) * 1000),
    ...(tok.refresh_token ? { refresh_token: tok.refresh_token } : {}),
  }
  return { accessToken: tok.access_token, refreshed }
}

async function graphGet(token, path) {
  const res = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Graph GET ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function sendEmail(account, { to, subject, html, threadId, inReplyTo }) {
  const { accessToken, refreshed } = await ensureToken(account)

  // Réponse dans un thread existant → /messages/{id}/reply ; sinon /sendMail.
  if (inReplyTo) {
    const res = await fetch(`${GRAPH}/me/messages/${inReplyTo}/reply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { body: { contentType: 'HTML', content: html } } }),
    })
    if (!res.ok) throw new Error(`Graph reply: ${res.status} ${await res.text()}`)
    return { providerMessageId: null, threadId: threadId || null, _refreshed: refreshed }
  }

  const res = await fetch(`${GRAPH}/me/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  })
  if (!res.ok) throw new Error(`Graph sendMail: ${res.status} ${await res.text()}`)
  return { providerMessageId: null, threadId: null, _refreshed: refreshed }
}

export async function fetchInbox(account, { sinceCursor } = {}) {
  const { accessToken, refreshed } = await ensureToken(account)
  // Delta sync : sinceCursor = deltaLink complet ; sinon on démarre la collection.
  const url = sinceCursor || `${GRAPH}/me/mailFolders/inbox/messages/delta?$top=25&$select=id,conversationId,subject,from,toRecipients,bodyPreview,body,isRead,hasAttachments,receivedDateTime`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Graph delta: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const messages = (data.value || []).filter((m) => m.id).map((m) => ({
    providerMessageId: m.id,
    threadId: m.conversationId,
    direction: 'inbound',
    from: m.from?.emailAddress?.address || '',
    to: (m.toRecipients || []).map((r) => r.emailAddress?.address).join(', '),
    subject: m.subject || '',
    snippet: m.bodyPreview || '',
    bodyHtml: m.body?.content || '',
    hasAttachments: !!m.hasAttachments,
    receivedAt: m.receivedDateTime ? new Date(m.receivedDateTime) : new Date(),
    isUnread: m.isRead === false,
  }))
  return { messages, cursor: data['@odata.deltaLink'] || data['@odata.nextLink'] || sinceCursor, _refreshed: refreshed }
}
