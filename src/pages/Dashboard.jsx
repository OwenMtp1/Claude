import React, { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Trophy, Pencil, EyeOff, Eye, GripVertical } from 'lucide-react'
import { useStore, inTimeline, computePrimes, fmtDate, monthKey, startOfWeek, parseISO } from '../store.jsx'
import { StatBubble, TimelinePicker, Gauge, Modal, Empty, Select } from '../ui.jsx'

const DEFAULT_WIDGETS = [
  { id: 'rdv-realises', label: 'RDV réalisés', size: 'lg' },
  { id: 'rdv-pris', label: 'RDV pris', size: 'lg' },
  { id: 'bubbles', label: 'Indicateurs clés (MQL / SQL / Primes)', size: 'lg' },
  { id: 'performance', label: 'Performance', size: 'md' },
  { id: 'provenance', label: 'Provenance des RDV', size: 'md' },
  { id: 'postes', label: 'Postes des contacts', size: 'md' },
  { id: 'signatures', label: 'Signatures & Opportunités', size: 'lg' },
  { id: 'conversion', label: 'Taux de conversion croisés', size: 'lg' },
]

function buildSeries(rdvs, dateKey, timeline, custom) {
  const filtered = rdvs.filter(r => inTimeline(r[dateKey], timeline, custom))
  const byMonth = timeline === 'year' || timeline === 'total'
  const map = {}
  filtered.forEach(r => {
    const d = parseISO(r[dateKey])
    if (!d) return
    const k = byMonth ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    const sk = byMonth ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : r[dateKey]
    map[sk] = map[sk] || { label: k, n: 0, sk }
    map[sk].n++
  })
  return { points: Object.values(map).sort((a, b) => a.sk.localeCompare(b.sk)), total: filtered.length, list: filtered }
}

function RdvChart({ title, rdvs, dateKey, onDetails }) {
  const [tl, setTl] = useState('year')
  const [custom, setCustom] = useState({})
  const { points, total, list } = useMemo(() => buildSeries(rdvs, dateKey, tl, custom), [rdvs, dateKey, tl, custom])
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div>
          <h3 className="font-bold">{title}</h3>
          <button className="text-3xl font-extrabold text-brand hover:underline" title="Voir le détail" onClick={() => onDetails(list, `${title} — détail`)}>{total}</button>
        </div>
        <TimelinePicker value={tl} onChange={setTl} custom={custom} onCustomChange={setCustom} />
      </div>
      <div className="h-44">
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 5, right: 10, bottom: 0, left: -25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" />
            <XAxis dataKey="label" fontSize={11} stroke="rgb(var(--muted))" />
            <YAxis allowDecimals={false} fontSize={11} stroke="rgb(var(--muted))" />
            <Tooltip />
            <Line type="monotone" dataKey="n" name="RDV" stroke="rgb(var(--brand))" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function perfScore(rdvs, dateKey, mode, custom) {
  // Note /10 : période courante vs moyenne des périodes de l'année (5 = dans la moyenne)
  const now = new Date()
  const year = now.getFullYear()
  const dates = rdvs.map(r => parseISO(r[dateKey])).filter(d => d && d.getFullYear() === year)
  if (mode === 'month' || (mode === 'custom' && custom.start && custom.end && custom.start.slice(0, 7) === custom.end.slice(0, 7))) {
    const byMonth = {}
    dates.forEach(d => { byMonth[d.getMonth()] = (byMonth[d.getMonth()] || 0) + 1 })
    const months = Object.values(byMonth)
    const avg = months.length ? months.reduce((a, b) => a + b, 0) / months.length : 0
    const refMonth = mode === 'custom' ? parseISO(custom.start).getMonth() : now.getMonth()
    const cur = byMonth[refMonth] || 0
    return { score: avg ? Math.min(10, (cur / avg) * 5) : (cur ? 10 : 0), cur, avg, unit: 'mensuelle' }
  }
  const byWeek = {}
  dates.forEach(d => { const k = monthKey(startOfWeek(d)) + '-' + startOfWeek(d).getDate(); byWeek[k] = (byWeek[k] || 0) + 1 })
  const weeks = Object.values(byWeek)
  const avg = weeks.length ? weeks.reduce((a, b) => a + b, 0) / weeks.length : 0
  let cur
  if (mode === 'custom' && (custom.start || custom.end)) {
    cur = rdvs.filter(r => inTimeline(r[dateKey], 'custom', custom)).length
  } else {
    cur = rdvs.filter(r => inTimeline(r[dateKey], 'week')).length
  }
  return { score: avg ? Math.min(10, (cur / avg) * 5) : (cur ? 10 : 0), cur, avg, unit: 'hebdo' }
}

function RdvDetailTable({ list }) {
  if (!list.length) return <Empty text="Aucun rendez-vous sur cette période." />
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs text-muted uppercase">
        <th className="py-1.5">Entreprise</th><th>Phase</th><th>Opportunité</th><th>Date RDV</th><th>Prise de RDV</th><th>Provenance</th>
      </tr></thead>
      <tbody>
        {list.map(r => (
          <tr key={r.id} className="border-t border-line">
            <td className="py-1.5 font-semibold">{r.entreprise || '—'}</td>
            <td>{r.phase}</td><td>{r.opportunite}</td>
            <td>{fmtDate(r.dateRdv)}</td><td>{fmtDate(r.datePriseRdv)}</td><td>{r.provenance}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Dashboard() {
  const store = useStore()
  const sub = store.sub
  const rdvs = sub.rdvs
  const [detail, setDetail] = useState(null) // {list, title}
  const [editMode, setEditMode] = useState(false)
  const [bubbleTl, setBubbleTl] = useState('year')
  const [bubbleCustom, setBubbleCustom] = useState({})
  const [provTl, setProvTl] = useState('total')
  const [provCustom, setProvCustom] = useState({})
  const [perfMode, setPerfMode] = useState('week')
  const [perfCustom, setPerfCustom] = useState({})
  const [posteFilter, setPosteFilter] = useState('')

  const widgets = sub.widgets || DEFAULT_WIDGETS.map(w => ({ id: w.id, visible: true, size: w.size }))
  const setWidgets = (w) => store.setSub(d => ({ ...d, widgets: w }))

  const showDetails = (list, title) => setDetail({ list, title })

  // ---- Indicateurs clés (filtrés sur la timeline des bulles, par date de RDV)
  const inTl = (r) => inTimeline(r.dateRdv || r.datePriseRdv, bubbleTl, bubbleCustom)
  const filtered = rdvs.filter(inTl)
  const mql = filtered.filter(r => ['MQL', 'SQL', 'Signée'].includes(r.phase))
  const sql = filtered.filter(r => r.phase === 'SQL' || r.phase === 'Signée')
  const signatures = filtered.filter(r => r.phase === 'Signée')
  const oppEnCours = filtered.filter(r => r.opportunite === 'En cours')
  const oppPerdues = filtered.filter(r => r.opportunite === 'Perdue')

  const primes = computePrimes(rdvs, sub.bareme)
  const now = new Date()
  const curKey = monthKey(new Date(now.getFullYear(), now.getMonth(), 1))
  const nextKey = monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1))
  const primesCeMois = primes.filter(p => p.payMonthKey === curKey).reduce((a, p) => a + p.montant, 0)
  const primesMoisSuivant = primes.filter(p => p.payMonthKey === nextKey).reduce((a, p) => a + p.montant, 0)
  const primesTotal = primes.reduce((a, p) => a + p.montant, 0)

  // ---- Provenance (timeline dédiée, défaut Total)
  const provRdvs = rdvs.filter(r => inTimeline(r.dateRdv || r.datePriseRdv, provTl, provCustom))
  const provCounts = {}
  provRdvs.forEach(r => { if (r.provenance) provCounts[r.provenance] = (provCounts[r.provenance] || 0) + 1 })
  const provTop = Object.entries(provCounts).sort((a, b) => b[1] - a[1])

  // ---- Postes
  const posteRdvs = posteFilter ? rdvs.filter(r => r.phase === posteFilter) : rdvs
  const posteCounts = {}
  posteRdvs.forEach(r => (r.contacts || []).forEach(c => { if (c.poste) posteCounts[c.poste] = (posteCounts[c.poste] || 0) + 1 }))
  const posteTotal = Object.values(posteCounts).reduce((a, b) => a + b, 0)
  const posteTop = Object.entries(posteCounts).sort((a, b) => b[1] - a[1])

  // ---- Performance
  const perfPris = perfScore(rdvs, 'datePriseRdv', perfMode, perfCustom)
  const perfReal = perfScore(rdvs, 'dateRdv', perfMode, perfCustom)

  // ---- Conversion croisée
  const convBase = filtered.length || 1
  const taux = (n) => `${Math.round((n / convBase) * 100)}%`

  const widgetVisible = (id) => widgets.find(w => w.id === id)?.visible !== false

  const renderWidget = (id) => {
    switch (id) {
      case 'rdv-realises':
        return <RdvChart title="RDV réalisés" rdvs={rdvs} dateKey="dateRdv" onDetails={showDetails} />
      case 'rdv-pris':
        return <RdvChart title="RDV pris" rdvs={rdvs} dateKey="datePriseRdv" onDetails={showDetails} />
      case 'bubbles':
        return (
          <div className="card p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="font-bold">Indicateurs clés</h3>
              <TimelinePicker value={bubbleTl} onChange={setBubbleTl} custom={bubbleCustom} onCustomChange={setBubbleCustom} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatBubble title="MQL générés" value={mql.length} tone="blue" onDetails={() => showDetails(mql, 'MQL — détail')} />
              <StatBubble title="SQL générés" value={sql.length} tone="red" onDetails={() => showDetails(sql, 'SQL — détail')} />
              <StatBubble title="Primes du mois" value={`${primesCeMois} €`} tone="green" sub={`Mois suivant : ${primesMoisSuivant} €`} />
              <StatBubble title="Revenu primes total" value={`${primesTotal} €`} tone="yellow" />
            </div>
          </div>
        )
      case 'signatures':
        return (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3"><Trophy className="text-amber-500" size={20} /><h3 className="font-bold">Nombre de signatures SQL</h3></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatBubble title="🏆 Signatures SQL" value={signatures.length} tone="green" onDetails={() => showDetails(signatures, 'Signatures — détail')} />
              <StatBubble title="Opportunités en cours" value={oppEnCours.length} tone="amber" onDetails={() => showDetails(oppEnCours, 'Opportunités en cours — détail')} />
              <StatBubble title="Opportunités perdues" value={oppPerdues.length} tone="gray" onDetails={() => showDetails(oppPerdues, 'Opportunités perdues — détail')} />
            </div>
          </div>
        )
      case 'performance':
        return (
          <div className="card p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h3 className="font-bold">Performance</h3>
              <div className="flex items-center gap-1">
                <select className="input !w-auto !py-1 text-xs" value={perfMode} onChange={e => setPerfMode(e.target.value)}>
                  <option value="week">Cette semaine</option>
                  <option value="month">Ce mois-ci</option>
                  <option value="custom">Période personnalisée</option>
                </select>
                {perfMode === 'custom' && <>
                  <input type="date" className="input !w-auto !py-1 text-xs" value={perfCustom.start || ''} onChange={e => setPerfCustom(c => ({ ...c, start: e.target.value }))} />
                  <input type="date" className="input !w-auto !py-1 text-xs" value={perfCustom.end || ''} onChange={e => setPerfCustom(c => ({ ...c, end: e.target.value }))} />
                </>}
              </div>
            </div>
            <div className="flex justify-around">
              <Gauge score={perfPris.score} label={`RDV pris vs moyenne ${perfPris.unit} (${perfPris.cur} / moy. ${perfPris.avg.toFixed(1)})`} />
              <Gauge score={perfReal.score} color="#f472b6" label={`RDV réalisés vs moyenne ${perfReal.unit} (${perfReal.cur} / moy. ${perfReal.avg.toFixed(1)})`} />
            </div>
          </div>
        )
      case 'provenance':
        return (
          <div className="card p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h3 className="font-bold">Provenance des RDV</h3>
              <TimelinePicker value={provTl} onChange={setProvTl} custom={provCustom} onCustomChange={setProvCustom} include={['today', 'week', 'month', 'total', 'custom']} />
            </div>
            {provTop.length === 0 ? <Empty text="Aucune donnée." /> : (
              <div className="space-y-2">
                {provTop.map(([p, n]) => (
                  <div key={p} className="flex items-center gap-2">
                    <span className="text-sm font-semibold w-32 truncate">{p}</span>
                    <div className="flex-1 h-2.5 bg-surface rounded-full overflow-hidden">
                      <div className="h-full bg-brand rounded-full" style={{ width: `${(n / provRdvs.length) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted w-16 text-right">{n} ({Math.round((n / provRdvs.length) * 100)}%)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      case 'postes':
        return (
          <div className="card p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h3 className="font-bold">Postes des contacts</h3>
              <Select value={posteFilter} onChange={setPosteFilter} options={sub.phases} placeholder="Toutes les phases" className="!w-auto !py-1 text-xs" />
            </div>
            {posteTop.length === 0 ? <Empty text="Aucune donnée." /> : (
              <div className="space-y-1.5">
                {posteTop.map(([p, n]) => (
                  <div key={p} className="flex items-center justify-between text-sm border-b border-line pb-1">
                    <span className="font-semibold">{p}</span>
                    <span className="text-muted text-xs">{n} fois — {Math.round((n / posteTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      case 'conversion':
        return (
          <div className="card p-4">
            <h3 className="font-bold mb-3">Taux de conversion (période des indicateurs clés)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {[['RDV → MQL', mql.length], ['MQL → SQL', sql.length], ['SQL → Signature', signatures.length], ['RDV → KO', filtered.filter(r => r.phase === 'KO').length]].map(([l, n]) => (
                <div key={l} className="rounded-xl bg-surface p-3">
                  <div className="text-2xl font-extrabold text-brand">{taux(n)}</div>
                  <div className="text-xs text-muted font-semibold mt-1">{l}</div>
                  <div className="text-xs text-muted">{n} / {filtered.length}</div>
                </div>
              ))}
            </div>
          </div>
        )
      default: return null
    }
  }

  const sizeClass = (id) => {
    const s = widgets.find(w => w.id === id)?.size || DEFAULT_WIDGETS.find(w => w.id === id)?.size
    return s === 'lg' ? 'lg:col-span-2' : s === 'sm' ? 'lg:col-span-1' : 'lg:col-span-1'
  }

  const move = (idx, dir) => {
    const w = [...widgets]
    const j = idx + dir
    if (j < 0 || j >= w.length) return
    ;[w[idx], w[j]] = [w[j], w[idx]]
    setWidgets(w)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Dashboard</h2>
        <button className="btn-ghost text-xs" onClick={() => setEditMode(e => !e)}>
          <Pencil size={14} /> {editMode ? 'Terminer' : 'Modifier les widgets'}
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {widgets.map((w, i) => {
          if (!w.visible && !editMode) return null
          const def = DEFAULT_WIDGETS.find(d => d.id === w.id)
          if (!def) return null
          return (
            <div key={w.id} className={`relative ${sizeClass(w.id)} ${!w.visible ? 'opacity-40' : ''}`}>
              {editMode && (
                <div className="absolute -top-2 right-2 z-20 flex gap-1 card !rounded-lg px-1.5 py-1 shadow">
                  <button title="Monter" className="p-1 hover:bg-surface rounded" onClick={() => move(i, -1)}>↑</button>
                  <button title="Descendre" className="p-1 hover:bg-surface rounded" onClick={() => move(i, 1)}>↓</button>
                  <button title="Taille" className="p-1 hover:bg-surface rounded text-xs font-bold"
                    onClick={() => setWidgets(widgets.map(x => x.id === w.id ? { ...x, size: x.size === 'lg' ? 'md' : 'lg' } : x))}>
                    {w.size === 'lg' ? '½' : '1'}
                  </button>
                  <button title={w.visible ? 'Masquer' : 'Afficher'} className="p-1 hover:bg-surface rounded"
                    onClick={() => setWidgets(widgets.map(x => x.id === w.id ? { ...x, visible: !x.visible } : x))}>
                    {w.visible ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              )}
              {renderWidget(w.id)}
            </div>
          )
        })}
      </div>
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)} wide>
          <RdvDetailTable list={detail.list} />
        </Modal>
      )}
    </div>
  )
}

export { DEFAULT_WIDGETS }
