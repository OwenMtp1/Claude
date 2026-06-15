import React, { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Inbox from '../components/Inbox.jsx'

export default function Messaging() {
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  useEffect(() => {
    api.accounts().then((a) => { setAccounts(a); setAccountId(a[0]?.id || '') }).catch(() => {})
  }, [])

  return (
    <div>
      <div className="page-head">
        <h2>Messagerie</h2>
        <select className="select" style={{ width: 280 }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Toutes les boîtes</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
        </select>
      </div>
      {accounts.length ? <Inbox accountId={accountId} />
        : <div className="card muted">Connectez une boîte email dans Paramètres pour voir vos conversations.</div>}
    </div>
  )
}
