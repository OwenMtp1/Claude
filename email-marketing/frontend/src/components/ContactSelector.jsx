import React, { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../api/client.js'

// Sélection de contacts (individuellement) et/ou de listes pour enrôler dans une campagne.
export default function ContactSelector({ onChange }) {
  const [contacts, setContacts] = useState([])
  const [lists, setLists] = useState([])
  const [search, setSearch] = useState('')
  const [selContacts, setSelContacts] = useState(new Set())
  const [selLists, setSelLists] = useState(new Set())

  useEffect(() => { api.lists().then(setLists).catch(() => {}) }, [])
  useEffect(() => {
    const t = setTimeout(() => api.contacts({ search }).then(setContacts).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    onChange?.({ contact_ids: [...selContacts], list_ids: [...selLists] })
  }, [selContacts, selLists])

  const toggle = (set, setFn, id) => {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setFn(next)
  }

  return (
    <div className="grid cols-2">
      <div>
        <div className="label">Listes</div>
        <div className="list">
          {lists.map((l) => (
            <div key={l.id} className={`item ${selLists.has(l.id) ? 'sel' : ''}`}
              onClick={() => toggle(selLists, setSelLists, l.id)}>
              <strong>{l.name}</strong> <span className="tag">{l.contact_count} contacts</span>
            </div>
          ))}
          {!lists.length && <div className="muted">Aucune liste.</div>}
        </div>
      </div>
      <div>
        <div className="label">Contacts</div>
        <div className="row" style={{ marginBottom: 8 }}>
          <Search size={16} className="muted" />
          <input className="input" placeholder="Rechercher un contact…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="list" style={{ maxHeight: 280, overflow: 'auto' }}>
          {contacts.map((c) => (
            <div key={c.id} className={`item ${selContacts.has(c.id) ? 'sel' : ''}`}
              onClick={() => toggle(selContacts, setSelContacts, c.id)}>
              <strong>{c.first_name} {c.last_name}</strong> <span className="muted">{c.email}</span>
              {c.company && <div className="muted" style={{ fontSize: 12 }}>{c.company}</div>}
            </div>
          ))}
          {!contacts.length && <div className="muted">Aucun contact.</div>}
        </div>
      </div>
    </div>
  )
}
