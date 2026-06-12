import React, { useState } from 'react'
import { Clock } from 'lucide-react'
import { useStore, parseISO, fmtDate, applyRdvAutomations, OPP_COLORS, todayISO } from '../store.jsx'
import { Modal, Empty } from '../ui.jsx'

function lifeDays(rdv) {
  // Durée de vie : de la création jusqu'à gagné/perdu (sinon aujourd'hui)
  const start = parseISO(rdv.datePriseRdv || rdv.createdAt)
  if (!start) return 0
  const closed = ['Gagnée', 'Perdue', 'Signée'].includes(rdv.opportunite)
  let end = new Date()
  if (closed && rdv.history?.length) {
    const last = rdv.history[rdv.history.length - 1]
    end = parseISO(last.date) || end
  }
  return Math.max(0, Math.round((end - start) / 86400000))
}

function TimelineDetail({ rdv, onClose }) {
  const events = [{ type: 'création', value: 'Créé', date: rdv.datePriseRdv || rdv.createdAt }, ...(rdv.history || [])]
  const rows = events.map((e, i) => {
    const next = events[i + 1]
    const d1 = parseISO(e.date)
    const d2 = next ? parseISO(next.date) : new Date()
    const days = d1 && d2 ? Math.max(0, Math.round((d2 - d1) / 86400000)) : 0
    return { ...e, days, last: !next }
  })
  return (
    <Modal title={`Timeline — ${rdv.entreprise}`} onClose={onClose}>
      <div className="space-y-0">
        {rows.map((e, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-brand mt-1" />
              {!e.last && <div className="w-0.5 flex-1 bg-line" />}
            </div>
            <div className="pb-5">
              <div className="font-bold text-sm">{e.value}</div>
              <div className="text-xs text-muted">
                {fmtDate(e.date)} — {e.last ? (['Gagnée', 'Perdue', 'Signée'].includes(rdv.opportunite) ? 'étape finale' : `depuis ${e.days} jour(s)`) : `pendant ${e.days} jour(s)`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export default function Leads() {
  const store = useStore()
  const sub = store.sub
  const [detail, setDetail] = useState(null)
  const [dragId, setDragId] = useState(null)

  const cols = sub.opportunites // le kanban se met à jour avec chaque nouveau statut créé

  const drop = (opp) => {
    if (!dragId) return
    store.setSub(d => {
      const r = d.rdvs.find(x => x.id === dragId)
      if (r && r.opportunite !== opp) Object.assign(r, applyRdvAutomations(r, { opportunite: opp }))
      return d
    })
    setDragId(null)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold">Leads — Pipeline</h2>
      <p className="text-xs text-muted -mt-2">Glissez-déposez une carte pour changer son statut d'opportunité (la phase de transaction se met à jour automatiquement).</p>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {cols.map(opp => {
          const cards = sub.rdvs.filter(r => r.opportunite === opp)
          return (
            <div key={opp} className="kanban-col flex-1 rounded-2xl bg-surface/80 border border-line p-2.5"
              onDragOver={e => e.preventDefault()} onDrop={() => drop(opp)}>
              <div className="flex items-center justify-between px-1 mb-2">
                <span className={`chip ${OPP_COLORS[opp] || 'bg-card text-ink'}`}>{opp}</span>
                <span className="text-xs font-bold text-muted">{cards.length}</span>
              </div>
              <div className="space-y-2 min-h-[6rem]">
                {cards.length === 0 && <div className="text-xs text-muted text-center py-4">—</div>}
                {cards.map(r => (
                  <div key={r.id} draggable onDragStart={() => setDragId(r.id)} onDragEnd={() => setDragId(null)}
                    className={`card !rounded-xl p-3 cursor-grab active:cursor-grabbing ${dragId === r.id ? 'dragging' : ''}`}>
                    <div className="font-bold text-sm">{r.entreprise}</div>
                    <div className="text-xs text-muted">{r.contacts?.[0]?.nom || '—'} · {r.phase}</div>
                    <button className="flex items-center gap-1 text-xs text-brand font-semibold mt-2 hover:underline" onClick={() => setDetail(r)}>
                      <Clock size={12} /> Actif depuis {lifeDays(r)} j
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {detail && <TimelineDetail rdv={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
