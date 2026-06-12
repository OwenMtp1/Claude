import React, { useEffect, useState } from 'react'
import { Building2, Globe, MapPin, Linkedin, Euro, CalendarDays, Users, StickyNote } from 'lucide-react'
import { useStore, fmtDate, PHASE_COLORS, OPP_COLORS } from '../store.jsx'
import { Modal, Field, Empty } from '../ui.jsx'

// Ouvre la fiche entreprise depuis n'importe quelle page (événement global).
export function openCompany(name) {
  if (!name) return
  window.dispatchEvent(new CustomEvent('open-company', { detail: name }))
}

// Modale "Fiche entreprise" : tous les RDV, contacts et notes de la société + infos société éditables.
export default function CompanyModal() {
  const store = useStore()
  const [name, setName] = useState(null)

  useEffect(() => {
    const h = (e) => setName(e.detail)
    window.addEventListener('open-company', h)
    return () => window.removeEventListener('open-company', h)
  }, [])

  const sub = store.sub
  if (!name || !sub) return null

  const rdvs = sub.rdvs.filter(r => (r.entreprise || '').trim().toLowerCase() === name.trim().toLowerCase())
  const contacts = sub.contacts.filter(c => (c.entreprise || '').trim().toLowerCase() === name.trim().toLowerCase())
  const notes = sub.notes.filter(n => (n.content || '').toLowerCase().includes(name.toLowerCase()) || (n.title || '').toLowerCase().includes(name.toLowerCase()))
  const info = (sub.companies || {})[name] || {}
  const rep = rdvs[rdvs.length - 1]

  const setInfo = (k, v) => store.setSub(d => ({
    ...d,
    companies: { ...(d.companies || {}), [name]: { ...((d.companies || {})[name] || {}), [k]: v } },
  }))

  return (
    <Modal title={<span className="flex items-center gap-2"><Building2 size={18} className="text-brand" /> {name}</span>} onClose={() => setName(null)} wide>
      <div className="space-y-5">
        {/* Infos société (enrichissement manuel) */}
        <div className="rounded-xl bg-surface p-3">
          <p className="label">Infos société</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="flex items-center gap-1.5">
              <Euro size={14} className="text-muted shrink-0" />
              <input className="input !py-1.5 text-xs" placeholder="CA (ex : 5 M€)" value={info.ca || ''} onChange={e => setInfo('ca', e.target.value)} />
            </div>
            <div className="flex items-center gap-1.5">
              <Globe size={14} className="text-muted shrink-0" />
              <input className="input !py-1.5 text-xs" placeholder="Site web" value={info.site || ''} onChange={e => setInfo('site', e.target.value)} />
            </div>
            <div className="flex items-center gap-1.5">
              <Linkedin size={14} className="text-muted shrink-0" />
              <input className="input !py-1.5 text-xs" placeholder="LinkedIn entreprise" value={info.linkedin || ''} onChange={e => setInfo('linkedin', e.target.value)} />
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-muted shrink-0" />
              <input className="input !py-1.5 text-xs" placeholder="Localisation" value={info.localisation || ''} onChange={e => setInfo('localisation', e.target.value)} />
            </div>
          </div>
          {rep && <div className="flex gap-2 mt-2 text-xs text-muted flex-wrap">
            {rep.effectif && <span>Effectif : <b>{rep.effectif}</b></span>}
            {rep.secteur && <span>Secteur : <b>{rep.secteur}</b></span>}
            {rep.source && <span>Source : <b>{rep.source}</b></span>}
            {rep.provenance && <span>Provenance : <b>{rep.provenance}</b></span>}
          </div>}
        </div>

        {/* RDV */}
        <div>
          <p className="label flex items-center gap-1.5"><CalendarDays size={13} /> Rendez-vous ({rdvs.length})</p>
          {rdvs.length === 0 ? <Empty text="Aucun rendez-vous." /> : (
            <div className="space-y-1.5">
              {rdvs.map(r => (
                <div key={r.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-surface flex-wrap">
                  <span className={`chip ${PHASE_COLORS[r.phase] || 'bg-card'}`}>{r.phase}</span>
                  <span className={`chip ${OPP_COLORS[r.opportunite] || 'bg-card'}`}>{r.opportunite}</span>
                  <span className="text-muted text-xs">RDV : {fmtDate(r.dateRdv)} · pris le {fmtDate(r.datePriseRdv)}</span>
                  {r.notes && <span className="text-xs text-muted truncate max-w-[16rem]" title={r.notes}>📝 {r.notes}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contacts */}
        <div>
          <p className="label flex items-center gap-1.5"><Users size={13} /> Contacts ({contacts.length})</p>
          {contacts.length === 0 ? <Empty text="Aucun contact." /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {contacts.map(c => (
                <div key={c.id} className="text-sm p-2 rounded-lg bg-surface">
                  <div className="font-semibold">{c.nom} <span className="text-muted text-xs font-normal">{c.poste}</span></div>
                  <div className="text-xs text-muted">{[c.email, c.tel].filter(Boolean).join(' · ') || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes liées */}
        {notes.length > 0 && (
          <div>
            <p className="label flex items-center gap-1.5"><StickyNote size={13} /> Notes mentionnant l'entreprise ({notes.length})</p>
            <div className="space-y-1.5">
              {notes.map(n => (
                <div key={n.id} className="text-sm p-2 rounded-lg bg-surface">
                  <span className="font-semibold">{n.title}</span> <span className="text-xs text-muted">— {fmtDate(n.createdAt)}</span>
                  <p className="text-xs text-muted line-clamp-2 whitespace-pre-wrap">{n.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
