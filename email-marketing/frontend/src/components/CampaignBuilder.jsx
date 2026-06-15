import React, { useState } from 'react'
import { Plus, Trash2, Clock } from 'lucide-react'
import EmailEditor from './EmailEditor.jsx'

// Construit la séquence multi-emails d'une campagne : étapes ordonnées avec délai.
// `value` = [{ subject, body_html, delay_days, delay_hours }]
export default function CampaignBuilder({ value = [], onChange }) {
  const [open, setOpen] = useState(0)
  const steps = value.length ? value : [{ subject: '', body_html: '', delay_days: 0, delay_hours: 0 }]

  const update = (i, patch) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const add = () => onChange([...steps, { subject: '', body_html: '', delay_days: 2, delay_hours: 0 }])
  const remove = (i) => onChange(steps.filter((_, j) => j !== i))

  return (
    <div>
      {steps.map((s, i) => (
        <div className="step" key={i}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong onClick={() => setOpen(open === i ? -1 : i)} style={{ cursor: 'pointer' }}>
              Étape {i + 1} {s.subject ? `— ${s.subject}` : ''}
            </strong>
            <div className="row">
              {i > 0 && (
                <span className="tag"><Clock size={12} /> J+{s.delay_days || 0}
                  {s.delay_hours ? ` ${s.delay_hours}h` : ''} après l’étape {i}</span>
              )}
              {steps.length > 1 && (
                <button className="btn ghost" onClick={() => remove(i)}><Trash2 size={15} /></button>
              )}
            </div>
          </div>
          {open === i && (
            <div style={{ marginTop: 12 }}>
              {i > 0 && (
                <div className="row" style={{ marginBottom: 10 }}>
                  <div>
                    <label className="label">Délai (jours)</label>
                    <input className="input" type="number" min="0" value={s.delay_days || 0}
                      onChange={(e) => update(i, { delay_days: parseInt(e.target.value || '0', 10) })} />
                  </div>
                  <div>
                    <label className="label">Délai (heures)</label>
                    <input className="input" type="number" min="0" max="23" value={s.delay_hours || 0}
                      onChange={(e) => update(i, { delay_hours: parseInt(e.target.value || '0', 10) })} />
                  </div>
                </div>
              )}
              <EmailEditor value={s} onChange={(v) => update(i, v)} />
            </div>
          )}
        </div>
      ))}
      <button className="btn" onClick={add}><Plus size={15} /> Ajouter une étape de relance</button>
    </div>
  )
}
