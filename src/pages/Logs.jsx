import React, { useState } from 'react'
import { ScrollText, Trash2 } from 'lucide-react'
import { useStore } from '../store.jsx'
import { Empty, Confirm } from '../ui.jsx'

const TYPE_COLORS = {
  RDV: 'bg-blue-100 text-blue-700', Note: 'bg-amber-100 text-amber-700',
  Contact: 'bg-emerald-100 text-emerald-700', Prime: 'bg-yellow-100 text-yellow-700',
  Lead: 'bg-purple-100 text-purple-700', 'Paramètres': 'bg-gray-200 text-gray-600',
  Connexion: 'bg-sky-100 text-sky-700', 'Données': 'bg-rose-100 text-rose-700',
}

export default function Logs() {
  const store = useStore()
  const logs = store.sub.logs || []
  const [fType, setFType] = useState('')
  const [fStart, setFStart] = useState('')
  const [fEnd, setFEnd] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  const types = [...new Set(logs.map(l => l.type))]
  const filtered = logs.filter(l => {
    if (fType && l.type !== fType) return false
    const day = l.ts.slice(0, 10)
    if (fStart && day < fStart) return false
    if (fEnd && day > fEnd) return false
    return true
  })

  const fmtTs = (ts) => new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-extrabold flex items-center gap-2"><ScrollText size={20} className="text-brand" /> Logs <span className="text-sm text-muted font-semibold">({filtered.length})</span></h2>
        {logs.length > 0 && <button className="btn-ghost text-xs text-red-500" onClick={() => setConfirmClear(true)}><Trash2 size={13} /> Vider le journal</button>}
      </div>
      <p className="text-xs text-muted -mt-2">Traçabilité de toutes les actions effectuées dans votre espace.</p>

      <div className="card p-3 flex items-center gap-2 flex-wrap text-xs">
        <select className="input !w-auto !py-1.5" value={fType} onChange={e => setFType(e.target.value)}>
          <option value="">Tâche : toutes</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-muted">Du</span>
        <input type="date" className="input !w-auto !py-1.5" value={fStart} onChange={e => setFStart(e.target.value)} />
        <span className="text-muted">au</span>
        <input type="date" className="input !w-auto !py-1.5" value={fEnd} onChange={e => setFEnd(e.target.value)} />
        {(fType || fStart || fEnd) && <button className="text-brand underline" onClick={() => { setFType(''); setFStart(''); setFEnd('') }}>Réinitialiser</button>}
      </div>

      {filtered.length === 0 ? <Empty text="Aucune action enregistrée sur ces critères." /> : (
        <div className="card divide-y divide-line">
          {filtered.slice(0, 200).map(l => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="text-xs text-muted font-mono w-28 shrink-0">{fmtTs(l.ts)}</span>
              <span className={`chip shrink-0 ${TYPE_COLORS[l.type] || 'bg-surface text-ink'}`}>{l.type}</span>
              <span className="font-semibold">{l.action}</span>
              {l.details && <span className="text-xs text-muted truncate">— {l.details}</span>}
            </div>
          ))}
          {filtered.length > 200 && <p className="text-xs text-muted text-center py-2">… {filtered.length - 200} entrées plus anciennes (affinez les filtres)</p>}
        </div>
      )}

      {confirmClear && (
        <Confirm message="Vider tout le journal d'audit ?"
          onYes={() => { store.setSub(d => ({ ...d, logs: [] })); setConfirmClear(false) }}
          onNo={() => setConfirmClear(false)} />
      )}
    </div>
  )
}
