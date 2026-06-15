import React, { useEffect, useState } from 'react'
import { Mail, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react'
import { api } from '../api/client.js'

// Connexion des boîtes email (OAuth2 Gmail / Outlook) + état des tokens.
export default function Settings() {
  const [providers, setProviders] = useState([])
  const [accounts, setAccounts] = useState([])
  const [notice, setNotice] = useState(null)

  const load = () => api.accounts().then(setAccounts).catch(() => {})
  useEffect(() => {
    api.providers().then(setProviders).catch(() => {})
    load()
    // Retour de redirection OAuth (#/settings?email_connected=... | email_error=...)
    const q = new URLSearchParams(window.location.hash.split('?')[1] || '')
    if (q.get('email_connected')) setNotice({ ok: true, msg: `Boîte ${q.get('email_connected')} connectée ✓` })
    if (q.get('email_error')) setNotice({ ok: false, msg: `Échec de connexion : ${q.get('email_error')}` })
  }, [])

  async function connect(provider) {
    try {
      const { url } = await api.oauthStart(provider)
      window.location.href = url
    } catch (e) { alert('OAuth indisponible : ' + e.message) }
  }

  return (
    <div>
      <div className="page-head"><h2>Paramètres — Boîtes email</h2></div>

      {notice && (
        <div className="card" style={{ marginBottom: 16, borderColor: notice.ok ? 'var(--ok)' : 'var(--bad)' }}>
          {notice.msg}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Connecter une boîte</strong>
        <p className="muted" style={{ fontSize: 13 }}>
          Vos emails seront envoyés et synchronisés depuis votre propre boîte. Les jetons OAuth sont chiffrés au repos.
        </p>
        <div className="row">
          <button className="btn primary" disabled={!providers.includes('gmail')} onClick={() => connect('gmail')}>
            <Plus size={15} /> Connecter Gmail
          </button>
          <button className="btn primary" disabled={!providers.includes('outlook')} onClick={() => connect('outlook')}>
            <Plus size={15} /> Connecter Outlook
          </button>
        </div>
        {!providers.length && (
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Aucun fournisseur OAuth configuré côté serveur (voir variables GOOGLE_* / MS_* dans backend/.env).
          </p>
        )}
      </div>

      <div className="list">
        {accounts.map((a) => (
          <div className="card" key={a.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="row">
                <Mail size={18} className="muted" />
                <div>
                  <strong>{a.email}</strong> <span className="tag">{a.provider}</span>
                  <div className="row" style={{ fontSize: 12, marginTop: 4 }}>
                    {a.status === 'connected'
                      ? <span className="tag ok"><CheckCircle size={12} /> connectée</span>
                      : <span className="tag bad"><AlertCircle size={12} /> {a.status}{a.last_error ? ` — ${a.last_error}` : ''}</span>}
                    <span className="muted">{a.daily_send_count || 0} envois aujourd’hui</span>
                  </div>
                </div>
              </div>
              <button className="btn ghost" onClick={async () => { await api.deleteAccount(a.id); load() }}>
                <Trash2 size={15} /> Déconnecter
              </button>
            </div>
          </div>
        ))}
        {!accounts.length && <div className="muted">Aucune boîte connectée.</div>}
      </div>
    </div>
  )
}
