import React, { useState } from 'react'
import { Inbox, Mail, Check, Trash2, Archive } from 'lucide-react'
import { useStore } from '../store.jsx'
import { Empty, Confirm, toast } from '../ui.jsx'

const fmtTs = (ts) => new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function Requests() {
  const store = useStore()
  const [showArchived, setShowArchived] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  const all = store.db.supportRequests || []
  const list = all.filter(r => showArchived ? r.archived : !r.archived)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const newCount = all.filter(r => !r.archived && r.status === 'new').length

  const markHandled = (r) => { store.updateSupportRequest(r.id, { status: r.status === 'handled' ? 'new' : 'handled' }); }
  const archive = (r) => { store.updateSupportRequest(r.id, { archived: !r.archived }); toast(r.archived ? 'Restaurée' : 'Demande archivée') }
  const remove = (id) => { store.deleteSupportRequest(id); toast('Demande supprimée'); setConfirmDel(null) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-extrabold flex items-center gap-2">
          <Inbox size={20} className="text-brand" /> Nouvelles demandes
          {newCount > 0 && <span className="chip bg-red-100 text-red-700">{newCount} nouvelle{newCount > 1 ? 's' : ''}</span>}
        </h2>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Archivées
        </label>
      </div>
      <p className="text-sm text-muted -mt-2">Chaque formulaire de contact rempli sur le site bdreport arrive directement ici.</p>

      {list.length === 0 ? (
        <Empty text={showArchived ? 'Aucune demande archivée.' : 'Aucune nouvelle demande pour le moment.'} />
      ) : (
        <div className="space-y-2">
          {list.map(r => (
            <div key={r.id} className={`card p-4 fade-in ${r.status === 'new' && !r.archived ? 'border-l-4 border-l-brand' : ''}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-bold flex items-center gap-2">{r.name || 'Sans nom'}
                    {r.status === 'handled' && <span className="chip bg-emerald-100 text-emerald-700">Traitée</span>}
                  </div>
                  <a href={`mailto:${r.email}`} className="text-xs text-brand flex items-center gap-1 hover:underline"><Mail size={12} /> {r.email}</a>
                </div>
                <span className="text-xs text-muted shrink-0">{fmtTs(r.createdAt)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap mt-2 text-ink/90">{r.message}</p>
              <div className="flex gap-1.5 mt-3 justify-end">
                <button className="btn-ghost !py-1 text-xs" onClick={() => markHandled(r)}>
                  <Check size={13} /> {r.status === 'handled' ? 'Rouvrir' : 'Marquer traitée'}
                </button>
                <button className="btn-ghost !py-1 text-xs" onClick={() => archive(r)}>
                  <Archive size={13} /> {r.archived ? 'Désarchiver' : 'Archiver'}
                </button>
                <button className="btn-danger !py-1 text-xs" onClick={() => setConfirmDel(r.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDel && <Confirm message="Supprimer définitivement cette demande ?" onYes={() => remove(confirmDel)} onNo={() => setConfirmDel(null)} />}
    </div>
  )
}
