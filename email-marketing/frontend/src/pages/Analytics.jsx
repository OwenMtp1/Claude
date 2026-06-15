import React, { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../api/client.js'

export default function Analytics() {
  const [campaigns, setCampaigns] = useState([])
  const [filter, setFilter] = useState({ campaign_id: '', from: '', to: '' })
  const [summary, setSummary] = useState(null)
  const [series, setSeries] = useState([])
  const [byCampaign, setByCampaign] = useState([])

  useEffect(() => { api.campaigns().then(setCampaigns).catch(() => {}) }, [])
  useEffect(() => {
    const p = { ...filter }
    api.summary(p).then(setSummary).catch(() => {})
    api.timeseries(p).then(setSeries).catch(() => {})
    api.byCampaign().then(setByCampaign).catch(() => {})
  }, [filter])

  const kpis = [
    { l: 'Emails envoyés', v: summary?.sent ?? '—' },
    { l: 'Taux d’ouverture', v: summary ? `${summary.openRate}%` : '—' },
    { l: 'Taux de clic', v: summary ? `${summary.clickRate}%` : '—' },
    { l: 'Taux de réponse', v: summary ? `${summary.replyRate}%` : '—' },
  ]

  return (
    <div>
      <div className="page-head"><h2>Analytics</h2></div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <div>
            <label className="label">Campagne</label>
            <select className="select" value={filter.campaign_id}
              onChange={(e) => setFilter({ ...filter, campaign_id: e.target.value })}>
              <option value="">Toutes</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Du</label>
            <input className="input" type="date" value={filter.from}
              onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
          </div>
          <div>
            <label className="label">Au</label>
            <input className="input" type="date" value={filter.to}
              onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <div className="card kpi" key={k.l}>
            <div className="v">{k.v}</div>
            <div className="l">{k.l}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Évolution (envois / ouvertures / clics)</strong>
        <div style={{ height: 280, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="sent" name="Envoyés" stroke="#4f46e5" strokeWidth={2} />
              <Line type="monotone" dataKey="opens" name="Ouvertures" stroke="#16a34a" strokeWidth={2} />
              <Line type="monotone" dataKey="clicks" name="Clics" stroke="#d97706" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <strong>Performance par campagne</strong>
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr><th>Campagne</th><th>Envoyés</th><th>Ouvertures</th><th>Clics</th><th>Réponses</th></tr>
          </thead>
          <tbody>
            {byCampaign.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.sent}</td><td>{c.opens}</td><td>{c.clicks}</td><td>{c.replies}</td>
              </tr>
            ))}
            {!byCampaign.length && <tr><td colSpan={5} className="muted">Aucune donnée.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
