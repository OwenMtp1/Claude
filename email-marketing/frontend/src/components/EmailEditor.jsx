import React, { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { api } from '../api/client.js'

// Éditeur d'email : sujet + corps HTML, avec génération IA puis édition manuelle.
// Variables disponibles : {{first_name}}, {{last_name}}, {{company}}, {{title}}.
export default function EmailEditor({ value, onChange }) {
  const [gen, setGen] = useState(false)
  const [goal, setGoal] = useState('prise de contact')
  const subject = value?.subject || ''
  const body = value?.body_html || ''

  async function generate() {
    setGen(true)
    try {
      const out = await api.generate({ goal, tone: 'professionnel', language: 'fr' })
      onChange({ subject: out.subject, body_html: out.body_html })
    } catch (e) {
      alert('Génération IA indisponible : ' + e.message)
    } finally {
      setGen(false)
    }
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <input className="input" placeholder="Objectif IA (ex. relance après salon)"
          value={goal} onChange={(e) => setGoal(e.target.value)} />
        <button className="btn" onClick={generate} disabled={gen}>
          <Sparkles size={15} /> {gen ? 'Génération…' : 'Générer avec l’IA'}
        </button>
      </div>
      <label className="label">Objet</label>
      <input className="input" value={subject}
        onChange={(e) => onChange({ ...value, subject: e.target.value })} placeholder="Objet de l'email" />
      <label className="label">Corps (HTML — variables {'{{first_name}}'}, {'{{company}}'}…)</label>
      <textarea rows={9} value={body}
        onChange={(e) => onChange({ ...value, body_html: e.target.value })}
        placeholder="<p>Bonjour {{first_name}},</p>" />
      <div className="card" style={{ marginTop: 8, background: '#fafafa' }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Aperçu</div>
        <div dangerouslySetInnerHTML={{ __html: body }} />
      </div>
    </div>
  )
}
