import React, { useMemo, useState } from 'react'
import { Plus, MoreVertical, ChevronRight, ChevronDown, Settings2, CornerDownRight, AlertTriangle, CalendarDays, Table as TableIcon, ChevronLeft } from 'lucide-react'
import { useStore, uid, todayISO, fmtDate, parseISO, applyRdvAutomations, rdvNeedsSqlDate, syncContacts, SOURCES, PHASE_COLORS, OPP_COLORS, RDV_FIELDS, inTimeline } from '../store.jsx'
import { Modal, Confirm, Field, Select, EditableSelect, Empty } from '../ui.jsx'
import { openCompany } from './Company.jsx'

const emptyContact = () => ({ id: uid(), nom: '', poste: '', email: '', tel: '' })

function emptyForm() {
  return {
    source: '', phase: '', opportunite: 'En cours', entreprise: '', effectif: '', secteur: '',
    linkedin: '', provenance: '', contacts: [emptyContact()], dateRdv: '', datePriseRdv: todayISO(),
    datePassageSQL: '', notes: '',
  }
}

// ---------------------------------------------------------------- Formulaire RDV
function RdvForm({ initial, title, onSave, onClose, sub, setSubList, isCreate }) {
  const [f, setF] = useState(initial)
  const [err, setErr] = useState('')
  const visible = (k) => sub.fieldsConfig.find(c => c.key === k)?.visible !== false
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const setContact = (i, k, v) => setF(x => ({ ...x, contacts: x.contacts.map((c, j) => j === i ? { ...c, [k]: v } : c) }))

  // Détection de doublons : entreprise déjà suivie / email déjà connu
  const dupRdvs = isCreate && f.entreprise.trim().length > 1
    ? sub.rdvs.filter(r => (r.entreprise || '').trim().toLowerCase() === f.entreprise.trim().toLowerCase())
    : []
  const dupEmails = f.contacts.map(c => c.email.trim().toLowerCase()).filter(e =>
    e && sub.contacts.some(c => (c.email || '').toLowerCase() === e))

  const submit = () => {
    if (!f.phase || !f.entreprise || !f.provenance) {
      setErr('Champs obligatoires : Phase de transaction, Nom d\'entreprise, Provenance du lead.')
      return
    }
    onSave(f)
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible('phase') && <Field label="Phase de transaction" required>
          <EditableSelect value={f.phase} onChange={v => set('phase', v)} options={sub.phases}
            onOptionsChange={o => setSubList('phases', o)} label="phases" />
        </Field>}
        {visible('opportunite') && <Field label="Opportunité">
          <EditableSelect value={f.opportunite} onChange={v => set('opportunite', v)} options={sub.opportunites}
            onOptionsChange={o => setSubList('opportunites', o)} label="statuts d'opportunité" />
        </Field>}
        {visible('entreprise') && <Field label="Nom de l'entreprise" required>
          <input className="input" value={f.entreprise} onChange={e => set('entreprise', e.target.value)} />
        </Field>}
        {visible('effectif') && <Field label="Nombre de collaborateurs">
          <input type="number" className="input" value={f.effectif} onChange={e => set('effectif', e.target.value)} />
        </Field>}
        {visible('secteur') && <Field label="Secteur d'activité">
          <input className="input" value={f.secteur} onChange={e => set('secteur', e.target.value)} />
        </Field>}
        {visible('source') && <Field label="Source">
          <Select value={f.source} onChange={v => set('source', v)} options={SOURCES} />
        </Field>}
        {visible('provenance') && <Field label="Provenance du lead" required>
          <EditableSelect value={f.provenance} onChange={v => set('provenance', v)} options={sub.provenances}
            onOptionsChange={o => setSubList('provenances', o)} label="provenances" />
        </Field>}
        {visible('linkedin') && <Field label="Profil LinkedIn">
          <input className="input" placeholder="https://linkedin.com/in/..." value={f.linkedin} onChange={e => set('linkedin', e.target.value)} />
        </Field>}
        {visible('datePriseRdv') && <Field label="Date de prise de rendez-vous">
          <input type="date" className="input" value={f.datePriseRdv} onChange={e => set('datePriseRdv', e.target.value)} />
        </Field>}
        {visible('dateRdv') && <Field label="Date du RDV">
          <input type="date" className="input" value={f.dateRdv} onChange={e => set('dateRdv', e.target.value)} />
        </Field>}
        <Field label="Date de passage en SQL">
          <input type="date" className="input" value={f.datePassageSQL} onChange={e => set('datePassageSQL', e.target.value)} />
        </Field>
      </div>

      {(visible('contact') || visible('poste') || visible('email') || visible('tel')) && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="label !mb-0">Contacts</span>
            <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => setF(x => ({ ...x, contacts: [...x.contacts, emptyContact()] }))}>
              <Plus size={13} /> Rajouter un contact
            </button>
          </div>
          {f.contacts.map((c, i) => (
            <div key={c.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2 p-3 rounded-xl bg-surface relative">
              {visible('contact') && <input className="input" placeholder="Nom & Prénom" value={c.nom} onChange={e => setContact(i, 'nom', e.target.value)} />}
              {visible('poste') && <input className="input" placeholder="Poste" value={c.poste} onChange={e => setContact(i, 'poste', e.target.value)} />}
              {visible('email') && <input className="input" placeholder="Email" value={c.email} onChange={e => setContact(i, 'email', e.target.value)} />}
              {visible('tel') && <input className="input" placeholder="Téléphone" value={c.tel} onChange={e => setContact(i, 'tel', e.target.value)} />}
              {f.contacts.length > 1 && (
                <button type="button" className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                  onClick={() => setF(x => ({ ...x, contacts: x.contacts.filter((_, j) => j !== i) }))}>×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {visible('notes') && (
        <div className="mt-3">
          <Field label="Notes">
            <textarea className="input min-h-[110px]" value={f.notes} onChange={e => set('notes', e.target.value)} />
          </Field>
        </div>
      )}

      {dupRdvs.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-800 flex gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span><b>Doublon possible :</b> « {f.entreprise} » a déjà {dupRdvs.length} rendez-vous ({dupRdvs.map(r => r.phase).join(', ')}).
            Si c'est une suite, préférez « Créer le rendez-vous suivant » depuis le menu ⋯ du RDV existant.</span>
        </div>
      )}
      {dupEmails.length > 0 && (
        <div className="mt-2 rounded-xl bg-sky-50 border border-sky-300 p-3 text-xs text-sky-800 flex gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>Contact déjà connu ({dupEmails.join(', ')}) : il ne sera pas dupliqué dans Mes contacts.</span>
        </div>
      )}
      {err && <p className="text-red-500 text-sm mt-3">{err}</p>}
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn-primary" onClick={submit}>Enregistrer le rendez-vous</button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- Vue calendrier
function CalendarView({ rdvs, onOpen }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const first = new Date(month)
  const startOffset = (first.getDay() + 6) % 7 // lundi = 0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const iso = (d) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const today = todayISO()
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <button className="p-1.5 rounded-lg hover:bg-surface" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={17} /></button>
        <span className="font-bold capitalize">{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
        <button className="p-1.5 rounded-lg hover:bg-surface" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={17} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-muted mb-1">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <div key={'e' + i} />
          const dayRdvs = rdvs.filter(r => r.dateRdv === iso(d))
          return (
            <div key={d} className={`min-h-[4.5rem] rounded-lg border p-1 text-left ${iso(d) === today ? 'border-brand bg-brand/5' : 'border-line bg-surface/50'}`}>
              <div className={`text-[11px] font-bold ${iso(d) === today ? 'text-brand' : 'text-muted'}`}>{d}</div>
              {dayRdvs.map(r => (
                <button key={r.id} onClick={() => onOpen(r)} title={`${r.entreprise} — ${r.phase}`}
                  className={`block w-full truncate text-left text-[10px] font-semibold rounded px-1 py-0.5 mt-0.5 ${PHASE_COLORS[r.phase] || 'bg-card text-ink'}`}>
                  {r.entreprise}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Page
export default function Rdv({ pendingNote, onPendingNoteUsed }) {
  const store = useStore()
  const sub = store.sub
  const [form, setForm] = useState(pendingNote ? { mode: 'create', data: { ...emptyForm(), notes: pendingNote } } : null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [sqlAsk, setSqlAsk] = useState(null) // {rdvId, patch, date}
  const [openGroups, setOpenGroups] = useState({})
  const [menuFor, setMenuFor] = useState(null)
  const [fieldsModal, setFieldsModal] = useState(false)
  // Filtres
  const [fPhase, setFPhase] = useState('')
  const [fSource, setFSource] = useState('')
  const [fOpp, setFOpp] = useState('')
  const [fPoste, setFPoste] = useState('')
  const [fProv, setFProv] = useState('')
  const [sort, setSort] = useState('date-desc')
  const [dateCustom, setDateCustom] = useState({ start: '', end: '' })
  const [view, setView] = useState('table') // 'table' | 'calendar'

  React.useEffect(() => {
    if (pendingNote) {
      setForm({ mode: 'create', data: { ...emptyForm(), notes: pendingNote } })
      onPendingNoteUsed?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNote])

  const setSubList = (key, list) => store.setSub(d => ({ ...d, [key]: list }))
  const visible = (k) => sub.fieldsConfig.find(c => c.key === k)?.visible !== false

  const saveRdv = (data, mode, id) => {
    store.setSub(d => {
      if (mode === 'create' || mode === 'sub') {
        const rdv = {
          ...data, id: uid(), parentId: mode === 'sub' ? id : null,
          opportunite: data.opportunite || 'En cours', createdAt: todayISO(),
          history: [{ type: 'phase', value: data.phase, date: data.datePriseRdv || todayISO() }],
        }
        d.rdvs.push(rdv)
        syncContacts(d, rdv)
      } else {
        const r = d.rdvs.find(x => x.id === id)
        Object.assign(r, applyRdvAutomations(r, data))
        syncContacts(d, r)
      }
      return d
    })
    setForm(null)
  }

  const patchRdv = (rdv, patch) => {
    if (rdvNeedsSqlDate(rdv, patch)) {
      setSqlAsk({ rdvId: rdv.id, patch, date: todayISO() })
      return
    }
    store.setSub(d => {
      const r = d.rdvs.find(x => x.id === rdv.id)
      Object.assign(r, applyRdvAutomations(r, patch))
      return d
    })
  }

  const confirmSqlDate = () => {
    const { rdvId, patch, date } = sqlAsk
    store.setSub(d => {
      const r = d.rdvs.find(x => x.id === rdvId)
      Object.assign(r, applyRdvAutomations(r, { ...patch, datePassageSQL: date }))
      return d
    })
    setSqlAsk(null)
  }

  const deleteRdv = (id) => {
    store.setSub(d => ({ ...d, rdvs: d.rdvs.filter(r => r.id !== id && r.parentId !== id) }))
    setConfirmDel(null)
  }

  // ---- filtrage / tri
  const roots = useMemo(() => {
    let list = sub.rdvs.filter(r => !r.parentId)
    const matches = (r) => {
      const fam = [r, ...sub.rdvs.filter(x => x.parentId === r.id)]
      return fam.some(x =>
        (!fPhase || x.phase === fPhase) &&
        (!fSource || x.source === fSource) &&
        (!fOpp || x.opportunite === fOpp) &&
        (!fPoste || (x.contacts || []).some(c => c.poste === fPoste)) &&
        (!fProv || x.provenance === fProv) &&
        (sort !== 'date-custom' || inTimeline(x.dateRdv, 'custom', dateCustom))
      )
    }
    list = list.filter(matches)
    const cmp = {
      'date-desc': (a, b) => (b.dateRdv || '').localeCompare(a.dateRdv || ''),
      'date-asc': (a, b) => (a.dateRdv || '').localeCompare(b.dateRdv || ''),
      'date-custom': (a, b) => (b.dateRdv || '').localeCompare(a.dateRdv || ''),
      'eff-asc': (a, b) => (Number(a.effectif) || 0) - (Number(b.effectif) || 0),
      'eff-desc': (a, b) => (Number(b.effectif) || 0) - (Number(a.effectif) || 0),
      'contact-az': (a, b) => (a.contacts?.[0]?.nom || '').localeCompare(b.contacts?.[0]?.nom || ''),
      'contact-za': (a, b) => (b.contacts?.[0]?.nom || '').localeCompare(a.contacts?.[0]?.nom || ''),
    }[sort]
    return [...list].sort(cmp)
  }, [sub.rdvs, fPhase, fSource, fOpp, fPoste, fProv, sort, dateCustom])

  const allPostes = [...new Set(sub.rdvs.flatMap(r => (r.contacts || []).map(c => c.poste)).filter(Boolean))]

  const colCount = ['source', 'phase', 'opportunite', 'effectif', 'contact', 'poste', 'email', 'tel', 'dateRdv', 'datePriseRdv', 'provenance', 'notes'].filter(visible).length + 2

  const Row = ({ r, isChild, childCount }) => (
    <tr className={`border-t border-line hover:bg-surface/60 ${isChild ? 'bg-surface/40' : ''}`}>
      <td className="py-2 pl-3">
        {!isChild && childCount > 0 && (
          <button onClick={() => setOpenGroups(g => ({ ...g, [r.id]: !g[r.id] }))} className="flex items-center gap-1 font-bold text-brand">
            {openGroups[r.id] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            <span className="text-xs">{childCount + 1}</span>
          </button>
        )}
        {isChild && <CornerDownRight size={14} className="text-muted ml-3" />}
      </td>
      {visible('source') && <td className="py-2">
        <Select value={r.source} onChange={v => patchRdv(r, { source: v })} options={SOURCES} className="!w-auto !py-1 text-xs" />
      </td>}
      {visible('phase') && <td>
        <select className={`chip border-0 cursor-pointer ${PHASE_COLORS[r.phase] || 'bg-surface text-ink'}`} value={r.phase}
          onChange={e => patchRdv(r, { phase: e.target.value })}>
          {sub.phases.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </td>}
      {visible('opportunite') && <td>
        <select className={`chip border-0 cursor-pointer ${OPP_COLORS[r.opportunite] || 'bg-surface text-ink'}`} value={r.opportunite}
          onChange={e => patchRdv(r, { opportunite: e.target.value })}>
          {sub.opportunites.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </td>}
      <td><button className="font-semibold hover:text-brand hover:underline text-left" title="Ouvrir la fiche entreprise" onClick={() => openCompany(r.entreprise)}>{r.entreprise}</button></td>
      {visible('effectif') && <td className="text-center">{r.effectif || '—'}</td>}
      {visible('contact') && <td>{(r.contacts || []).map(c => c.nom).filter(Boolean).join(', ') || '—'}</td>}
      {visible('poste') && <td className="text-muted">{(r.contacts || []).map(c => c.poste).filter(Boolean).join(', ') || '—'}</td>}
      {visible('email') && <td className="text-muted text-xs">{r.contacts?.[0]?.email || '—'}</td>}
      {visible('tel') && <td className="text-muted text-xs">{r.contacts?.[0]?.tel || '—'}</td>}
      {visible('dateRdv') && <td>{fmtDate(r.dateRdv)}</td>}
      {visible('datePriseRdv') && <td className="text-muted">{fmtDate(r.datePriseRdv)}</td>}
      {visible('provenance') && <td>{r.provenance}</td>}
      {visible('notes') && <td className="max-w-[10rem] truncate text-muted text-xs" title={r.notes}>{r.notes || '—'}</td>}
      <td className="relative pr-2">
        <button className="p-1.5 rounded-lg hover:bg-surface" onClick={() => setMenuFor(menuFor === r.id ? null : r.id)}>
          <MoreVertical size={16} />
        </button>
        {menuFor === r.id && (
          <div className="absolute right-2 top-9 z-30 card shadow-lg p-1 w-52 text-sm">
            <button className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface" onClick={() => { setMenuFor(null); setForm({ mode: 'edit', id: r.id, data: { ...r } }) }}>Modifier</button>
            {!isChild && <button className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface"
              onClick={() => { setMenuFor(null); setForm({ mode: 'sub', id: r.id, data: { ...r, id: undefined, phase: '', datePassageSQL: '', opportunite: 'En cours', datePriseRdv: todayISO(), dateRdv: '', contacts: r.contacts.map(c => ({ ...c, id: uid() })) } }) }}>
              Créer le rendez-vous suivant</button>}
            <button className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface text-red-500" onClick={() => { setMenuFor(null); setConfirmDel(r.id) }}>Supprimer</button>
          </div>
        )}
      </td>
    </tr>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-extrabold">Mes Rendez-vous</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line overflow-hidden">
            <button className={`px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 ${view === 'table' ? 'bg-brand text-white' : 'bg-card text-muted'}`}
              onClick={() => setView('table')} title="Vue tableau"><TableIcon size={13} /> Tableau</button>
            <button className={`px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 ${view === 'calendar' ? 'bg-brand text-white' : 'bg-card text-muted'}`}
              onClick={() => setView('calendar')} title="Vue calendrier"><CalendarDays size={13} /> Calendrier</button>
          </div>
          <button className="btn-ghost text-xs" title="Modifier les champs" onClick={() => setFieldsModal(true)}><Settings2 size={15} /> Modifier les champs</button>
          <button className="btn-primary" onClick={() => setForm({ mode: 'create', data: emptyForm() })}><Plus size={16} /> Créer un RDV</button>
        </div>
      </div>

      {view === 'calendar' && (
        <CalendarView rdvs={sub.rdvs} onOpen={(r) => setForm({ mode: 'edit', id: r.id, data: { ...r } })} />
      )}

      {view === 'table' && <>
      <div className="card p-3 flex items-center gap-2 flex-wrap text-xs">
        <Select value={fSource} onChange={setFSource} options={SOURCES} placeholder="Source : toutes" className="!w-auto !py-1.5" />
        <Select value={fPhase} onChange={setFPhase} options={sub.phases} placeholder="Phase : toutes" className="!w-auto !py-1.5" />
        <Select value={fOpp} onChange={setFOpp} options={sub.opportunites} placeholder="Opportunité : toutes" className="!w-auto !py-1.5" />
        <Select value={fPoste} onChange={setFPoste} options={allPostes} placeholder="Poste : tous" className="!w-auto !py-1.5" />
        <Select value={fProv} onChange={setFProv} options={sub.provenances} placeholder="Provenance : toutes" className="!w-auto !py-1.5" />
        <select className="input !w-auto !py-1.5" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="date-desc">Date RDV : la plus récente</option>
          <option value="date-asc">Date RDV : la plus ancienne</option>
          <option value="date-custom">Date RDV : période personnalisée</option>
          <option value="eff-asc">Effectif : croissant</option>
          <option value="eff-desc">Effectif : décroissant</option>
          <option value="contact-az">Contact : A → Z</option>
          <option value="contact-za">Contact : Z → A</option>
        </select>
        {sort === 'date-custom' && <>
          <input type="date" className="input !w-auto !py-1" value={dateCustom.start} onChange={e => setDateCustom(c => ({ ...c, start: e.target.value }))} />
          <span>→</span>
          <input type="date" className="input !w-auto !py-1" value={dateCustom.end} onChange={e => setDateCustom(c => ({ ...c, end: e.target.value }))} />
        </>}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wide">
              <th className="py-2.5 pl-3 w-12"></th>
              {visible('source') && <th>Source</th>}
              {visible('phase') && <th>Phase</th>}
              {visible('opportunite') && <th>Opportunité</th>}
              <th>Entreprise</th>
              {visible('effectif') && <th className="text-center">Effectif</th>}
              {visible('contact') && <th>Contact</th>}
              {visible('poste') && <th>Poste</th>}
              {visible('email') && <th>Email</th>}
              {visible('tel') && <th>Téléphone</th>}
              {visible('dateRdv') && <th>Date RDV</th>}
              {visible('datePriseRdv') && <th>Prise de RDV</th>}
              {visible('provenance') && <th>Provenance</th>}
              {visible('notes') && <th>Notes</th>}
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {roots.length === 0 && <tr><td colSpan={colCount}><Empty text="Aucun rendez-vous. Cliquez sur « Créer un RDV »." /></td></tr>}
            {roots.map(r => {
              const children = sub.rdvs.filter(x => x.parentId === r.id)
              return (
                <React.Fragment key={r.id}>
                  <Row r={r} childCount={children.length} />
                  {openGroups[r.id] && children.map(c => <Row key={c.id} r={c} isChild />)}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      </>}

      {form && (
        <RdvForm
          title={form.mode === 'create' ? 'Créer un RDV' : form.mode === 'sub' ? 'Créer le rendez-vous suivant' : 'Modifier le RDV'}
          initial={form.data} sub={sub} setSubList={setSubList} isCreate={form.mode === 'create'}
          onSave={(data) => saveRdv(data, form.mode, form.id)}
          onClose={() => setForm(null)}
        />
      )}

      {confirmDel && (
        <Confirm message="Êtes-vous sûr de vouloir supprimer ce Rendez-vous ? Les rendez-vous suivants liés seront aussi supprimés."
          onYes={() => deleteRdv(confirmDel)} onNo={() => setConfirmDel(null)} />
      )}

      {sqlAsk && (
        <Modal title="Date de passage en SQL" onClose={() => setSqlAsk(null)}>
          <p className="text-sm text-muted mb-3">Ce rendez-vous passe en SQL. Renseignez la date de passage en SQL — c'est elle qui déclenche la prime.</p>
          <input type="date" className="input" value={sqlAsk.date} onChange={e => setSqlAsk(s => ({ ...s, date: e.target.value }))} />
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn-ghost" onClick={() => setSqlAsk(null)}>Annuler</button>
            <button className="btn-primary" onClick={confirmSqlDate}>Valider</button>
          </div>
        </Modal>
      )}

      {fieldsModal && (
        <Modal title="Modifier les champs du formulaire" onClose={() => setFieldsModal(false)}>
          <p className="text-xs text-muted mb-3">Les champs décochés n'apparaissent plus dans le tableau ni dans le formulaire de création.</p>
          <div className="space-y-1.5">
            {RDV_FIELDS.map(f => {
              const cfg = sub.fieldsConfig.find(c => c.key === f.key) || { visible: true }
              const locked = ['phase', 'entreprise', 'provenance'].includes(f.key)
              return (
                <label key={f.key} className={`flex items-center gap-2 text-sm p-1.5 rounded-lg hover:bg-surface ${locked ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input type="checkbox" checked={cfg.visible !== false} disabled={locked}
                    onChange={e => store.setSub(d => ({
                      ...d,
                      fieldsConfig: RDV_FIELDS.map(x => {
                        const cur = d.fieldsConfig.find(c => c.key === x.key)
                        return { key: x.key, visible: x.key === f.key ? e.target.checked : (cur ? cur.visible : true) }
                      }),
                    }))} />
                  {f.label}{locked && <span className="text-xs text-muted">(obligatoire)</span>}
                </label>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}
