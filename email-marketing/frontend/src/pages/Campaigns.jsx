import React, { useEffect, useState } from 'react'
import { Plus, Play, Pause, Send, Users, Trash2 } from 'lucide-react'
import { api } from '../api/client.js'
import CampaignBuilder from '../components/CampaignBuilder.jsx'
import ContactSelector from '../components/ContactSelector.jsx'

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [accounts, setAccounts] = useState([])
  const [editing, setEditing] = useState(null) // campagne ouverte dans le builder
  const [enrolling, setEnrolling] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = () => api.campaigns().then(setCampaigns).catch(() => {})
  useEffect(() => { load(); api.accounts().then(setAccounts).catch(() => {}) }, [])

  async function create(name) {
    const c = await api.createCampaign({ name, email_account_id: accounts[0]?.id || null })
    setCreating(false)
    await load()
    openBuilder(c.id)
  }

  async function openBuilder(id) {
    const full = await api.campaign(id)
    setEditing(full)
  }

  async function toggleStatus(c) {
    await api.updateCampaign(c.id, { status: c.status === 'active' ? 'paused' : 'active' })
    load()
  }

  return (
    <div>
      <div className="page-head">
        <h2>Campagnes</h2>
        <button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} /> Nouvelle campagne</button>
      </div>

      <div className="list">
        {campaigns.map((c) => (
          <div className="card" key={c.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: 16 }}>{c.name}</strong>{' '}
                <span className={`tag ${c.status === 'active' ? 'ok' : c.status === 'paused' ? 'warn' : ''}`}>{c.status}</span>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {c.contacts} contacts · {c.sent} emails envoyés
                </div>
              </div>
              <div className="row">
                <button className="btn" onClick={() => setEnrolling(c)}><Users size={15} /> Contacts</button>
                <button className="btn" onClick={() => openBuilder(c.id)}>Séquence</button>
                <button className="btn" onClick={() => toggleStatus(c)}>
                  {c.status === 'active' ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Activer</>}
                </button>
                <button className="btn ghost" onClick={async () => { await api.deleteCampaign(c.id); load() }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {!campaigns.length && <div className="muted">Aucune campagne. Créez-en une pour démarrer.</div>}
      </div>

      {creating && <CreateModal accounts={accounts} onClose={() => setCreating(false)} onCreate={create} />}
      {editing && <BuilderModal campaign={editing} accounts={accounts} onClose={() => { setEditing(null); load() }} />}
      {enrolling && <EnrollModal campaign={enrolling} onClose={() => { setEnrolling(null); load() }} />}
    </div>
  )
}

function CreateModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Nouvelle campagne</h3>
        <label className="label">Nom</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus
          placeholder="Ex. Prospection Q3 — DSI" />
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!name.trim()} onClick={() => onCreate(name.trim())}>Créer</button>
        </div>
      </div>
    </div>
  )
}

function BuilderModal({ campaign, accounts, onClose }) {
  const [steps, setSteps] = useState(campaign.sequences || [])
  const [accountId, setAccountId] = useState(campaign.email_account_id || accounts[0]?.id || '')
  const [dailyLimit, setDailyLimit] = useState(campaign.daily_limit || 50)
  const [stopOnReply, setStopOnReply] = useState(campaign.stop_on_reply)
  const [saving, setSaving] = useState(false)
  const [testTo, setTestTo] = useState('')

  async function save() {
    setSaving(true)
    try {
      await api.updateCampaign(campaign.id, { email_account_id: accountId, daily_limit: dailyLimit, stop_on_reply: stopOnReply })
      await api.setSequences(campaign.id, steps)
      onClose()
    } catch (e) { alert('Erreur : ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 760 }} onClick={(e) => e.stopPropagation()}>
        <h3>Séquence — {campaign.name}</h3>
        <div className="grid cols-2">
          <div>
            <label className="label">Boîte d’envoi</label>
            <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— Aucune —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.email} ({a.provider})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Limite quotidienne</label>
            <input className="input" type="number" value={dailyLimit}
              onChange={(e) => setDailyLimit(parseInt(e.target.value || '50', 10))} />
          </div>
        </div>
        <label className="row" style={{ marginTop: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={stopOnReply} onChange={(e) => setStopOnReply(e.target.checked)} />
          Arrêter la séquence si le prospect répond
        </label>

        <div style={{ marginTop: 16 }}>
          <CampaignBuilder value={steps} onChange={setSteps} />
        </div>

        <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
          <div className="row">
            <input className="input" placeholder="email de test" value={testTo}
              onChange={(e) => setTestTo(e.target.value)} style={{ width: 220 }} />
            <button className="btn" onClick={async () => {
              try { await api.setSequences(campaign.id, steps); await api.testSend(campaign.id, testTo); alert('Email de test envoyé ✓') }
              catch (e) { alert('Échec : ' + e.message) }
            }}><Send size={15} /> Tester</button>
          </div>
          <div className="row">
            <button className="btn" onClick={onClose}>Fermer</button>
            <button className="btn primary" onClick={save} disabled={saving}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EnrollModal({ campaign, onClose }) {
  const [sel, setSel] = useState({ contact_ids: [], list_ids: [] })
  const [saving, setSaving] = useState(false)
  async function enroll() {
    setSaving(true)
    try {
      const r = await api.enroll(campaign.id, sel)
      alert(`${r.enrolled} contact(s) ajouté(s) à la campagne ✓`)
      onClose()
    } catch (e) { alert('Erreur : ' + e.message) }
    finally { setSaving(false) }
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 760 }} onClick={(e) => e.stopPropagation()}>
        <h3>Ajouter des contacts — {campaign.name}</h3>
        <ContactSelector onChange={setSel} />
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" onClick={enroll}
            disabled={saving || (!sel.contact_ids.length && !sel.list_ids.length)}>Enrôler</button>
        </div>
      </div>
    </div>
  )
}
