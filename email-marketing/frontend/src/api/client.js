// ─────────────────────────────────────────────────────────────────────────────
// Client API du module Marketing Email.
// L'identité de l'utilisateur CRM est transmise via un token Bearer signé par le
// CRM (HMAC du secret partagé). En dev/standalone, on lit un token de démo.
// Pour intégrer au CRM existant : appeler `setAuthToken(token)` avec le token
// renvoyé par votre backend / une petite route de signature.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_EMAIL_API_URL || 'http://localhost:4000'

let authToken = localStorage.getItem('email_api_token') || ''
export function setAuthToken(token) {
  authToken = token || ''
  localStorage.setItem('email_api_token', authToken)
}
export function getBaseUrl() { return BASE }

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(BASE + path)
  if (params) Object.entries(params).forEach(([k, v]) => v != null && v !== '' && url.searchParams.set(k, v))
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`)
  return json.data
}

export const api = {
  // Boîtes email
  providers: () => request('/api/accounts/providers'),
  accounts: () => request('/api/accounts'),
  oauthStart: (provider) => request(`/api/accounts/oauth/${provider}/start`),
  deleteAccount: (id) => request(`/api/accounts/${id}`, { method: 'DELETE' }),

  // Contacts & listes
  contacts: (params) => request('/api/contacts', { params }),
  createContact: (body) => request('/api/contacts', { method: 'POST', body }),
  importContacts: (body) => request('/api/contacts/import', { method: 'POST', body }),
  lists: () => request('/api/contacts/lists/all'),
  createList: (name) => request('/api/contacts/lists', { method: 'POST', body: { name } }),
  addToList: (listId, contactIds) => request(`/api/contacts/lists/${listId}/contacts`, { method: 'POST', body: { contact_ids: contactIds } }),

  // Campagnes & séquences
  campaigns: () => request('/api/campaigns'),
  campaign: (id) => request(`/api/campaigns/${id}`),
  createCampaign: (body) => request('/api/campaigns', { method: 'POST', body }),
  updateCampaign: (id, body) => request(`/api/campaigns/${id}`, { method: 'PATCH', body }),
  deleteCampaign: (id) => request(`/api/campaigns/${id}`, { method: 'DELETE' }),
  setSequences: (id, sequences) => request(`/api/campaigns/${id}/sequences`, { method: 'PUT', body: { sequences } }),
  enroll: (id, body) => request(`/api/campaigns/${id}/contacts`, { method: 'POST', body }),
  campaignContacts: (id) => request(`/api/campaigns/${id}/contacts`),
  testSend: (id, to) => request(`/api/campaigns/${id}/test`, { method: 'POST', body: { to } }),

  // Messagerie
  threads: (params) => request('/api/messaging/threads', { params }),
  thread: (threadId) => request(`/api/messaging/threads/${threadId}`),
  reply: (threadId, body) => request(`/api/messaging/threads/${threadId}/reply`, { method: 'POST', body }),

  // Analytics
  summary: (params) => request('/api/analytics/summary', { params }),
  timeseries: (params) => request('/api/analytics/timeseries', { params }),
  byCampaign: () => request('/api/analytics/by-campaign'),

  // IA
  generate: (body) => request('/api/ai/generate', { method: 'POST', body }),
}
