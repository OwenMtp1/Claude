import React, { useState } from 'react'
import { LifeBuoy, ArrowLeft, MessageSquare, CheckCircle2, Trash2, Building2 } from 'lucide-react'
import { useStore, fmtDate } from '../store.jsx'
import { Empty, Confirm, toast } from '../ui.jsx'
import TicketChat from './TicketChat.jsx'

const STATUS_LABEL = { open: 'Ouvert', in_progress: 'En cours', closed: 'Clôturé' }
const STATUS_CLASS = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-200 text-gray-600',
}

export default function Tickets() {
  const store = useStore()
  const [openId, setOpenId] = useState('')
  const [filter, setFilter] = useState('') // '' | open | in_progress | closed
  const [confirmDel, setConfirmDel] = useState(null)

  const envName = (id) => store.db.environments.find(e => e.id === id)?.name || '—'

  let tickets = (store.db.tickets || [])
    .sort((a, b) => (b.messages.at(-1)?.ts || b.createdAt).localeCompare(a.messages.at(-1)?.ts || a.createdAt))
  if (filter) tickets = tickets.filter(t => t.status === filter)

  const openTicket = openId ? (store.db.tickets || []).find(t => t.id === openId) : null
  const counts = (store.db.tickets || []).reduce((m, t) => { m[t.status] = (m[t.status] || 0) + 1; return m }, {})

  const remove = (id) => { store.deleteTicket(id); setConfirmDel(null); setOpenId(''); toast('Ticket supprimé') }

  if (openTicket) {
    return (
      <div className="space-y-3">
        <button className="btn-ghost text-xs" onClick={() => setOpenId('')}><ArrowLeft size={14} /> Retour aux tickets</button>
        <div className="card p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <div className="font-bold flex items-center gap-2"><LifeBuoy size={16} className="text-brand" /> {openTicket.category}</div>
            <div className="text-xs text-muted flex items-center gap-2 flex-wrap">
              <span>{openTicket.userName}</span>
              <span className="flex items-center gap-1"><Building2 size={11} /> {envName(openTicket.envId)}</span>
              <span>· Ouvert le {fmtDate(openTicket.createdAt.slice(0, 10))}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`chip ${STATUS_CLASS[openTicket.status]}`}>{STATUS_LABEL[openTicket.status]}</span>
            {openTicket.status !== 'closed'
              ? <button className="btn-ghost !py-1 text-xs" onClick={() => store.setTicketStatus(openTicket.id, 'closed')}><CheckCircle2 size={13} /> Clôturer</button>
              : <button className="btn-ghost !py-1 text-xs" onClick={() => store.setTicketStatus(openTicket.id, 'in_progress')}>Rouvrir</button>}
            <button className="btn-danger !py-1 text-xs" onClick={() => setConfirmDel(openTicket.id)}><Trash2 size={13} /></button>
          </div>
        </div>
        <div className="card p-3 h-[62vh]"><TicketChat ticket={openTicket} role="support" /></div>
        {confirmDel && <Confirm message="Supprimer définitivement ce ticket ?" onYes={() => remove(confirmDel)} onNo={() => setConfirmDel(null)} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold flex items-center gap-2"><LifeBuoy size={20} className="text-brand" /> Tickets Techniques</h2>
      <p className="text-sm text-muted -mt-2">Tous les tickets ouverts par les utilisateurs de BD Report, toutes offres confondues.</p>

      <div className="card p-3 flex items-center gap-2 flex-wrap text-xs">
        {[['', 'Tous'], ['open', 'Ouverts'], ['in_progress', 'En cours'], ['closed', 'Clôturés']].map(([id, lbl]) => (
          <button key={id} className={`btn text-xs ${filter === id ? 'bg-brand text-white' : 'bg-card border border-line'}`} onClick={() => setFilter(id)}>
            {lbl}{id && counts[id] ? ` (${counts[id]})` : ''}
          </button>
        ))}
      </div>

      {tickets.length === 0 ? (
        <Empty text="Aucun ticket." />
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const last = t.messages.at(-1)
            const waiting = last?.from === 'user' // dernier message côté utilisateur = en attente de réponse
            return (
              <button key={t.id} className="card p-3 w-full text-left hover:bg-surface transition flex items-center gap-3" onClick={() => setOpenId(t.id)}>
                <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0 relative">
                  <MessageSquare size={17} />
                  {waiting && t.status !== 'closed' && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm flex items-center gap-2">{t.category} <span className="text-xs text-muted font-normal">· {t.userName}</span></div>
                  <div className="text-xs text-muted truncate">{last?.from === 'bot' ? 'BD Report : ' : last?.from === 'support' ? `${last.authorName} : ` : `${t.userName} : `}{last?.photo && !last?.text ? '📷 Photo' : last?.text}</div>
                </div>
                <span className={`chip ${STATUS_CLASS[t.status]} shrink-0`}>{STATUS_LABEL[t.status]}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
