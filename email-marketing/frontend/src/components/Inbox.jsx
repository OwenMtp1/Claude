import React, { useEffect, useState } from 'react'
import { Send, Paperclip, RefreshCw } from 'lucide-react'
import { api } from '../api/client.js'

// Boîte de réception type Gmail : liste de threads + conversation + réponse.
export default function Inbox({ accountId }) {
  const [threads, setThreads] = useState([])
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  async function loadThreads() {
    setLoading(true)
    try { setThreads(await api.threads({ account_id: accountId })) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadThreads() }, [accountId])

  async function openThread(t) {
    setActive(t)
    setMessages(await api.thread(t.thread_id))
  }

  async function sendReply() {
    if (!reply.trim() || !active) return
    setSending(true)
    try {
      await api.reply(active.thread_id, { account_id: active.email_account_id, body_html: `<p>${reply.replace(/\n/g, '<br/>')}</p>` })
      setReply('')
      setMessages(await api.thread(active.thread_id))
    } catch (e) { alert('Envoi impossible : ' + e.message) }
    finally { setSending(false) }
  }

  return (
    <div className="thread-pane">
      <div className="thread-list">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <strong>Conversations</strong>
          <button className="btn ghost" onClick={loadThreads}><RefreshCw size={15} /></button>
        </div>
        {loading && <div className="spinner">Chargement…</div>}
        <div className="list">
          {threads.map((t) => (
            <div key={t.thread_id} className={`item ${active?.thread_id === t.thread_id ? 'sel' : ''}`}
              onClick={() => openThread(t)}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 14 }}>{t.from_email || t.to_email}</strong>
                {!t.is_read && t.direction === 'inbound' && <span className="tag bad">non lu</span>}
              </div>
              <div style={{ fontSize: 13 }}>{t.subject || '(sans objet)'}</div>
              <div className="muted" style={{ fontSize: 12 }}>{t.snippet?.slice(0, 60)}</div>
            </div>
          ))}
          {!threads.length && !loading && <div className="muted">Aucune conversation. Connectez une boîte et synchronisez.</div>}
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
        {!active && <div className="muted">Sélectionnez une conversation.</div>}
        {active && (
          <>
            <h3 style={{ marginTop: 0 }}>{active.subject || '(sans objet)'}</h3>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {messages.map((m) => (
                <div key={m.id} className={`msg ${m.direction}`}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: 13 }}>{m.from_email}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {new Date(m.received_at).toLocaleString('fr-FR')}
                      {m.has_attachments && <Paperclip size={12} style={{ marginLeft: 6 }} />}
                    </span>
                  </div>
                  <div style={{ marginTop: 6 }} dangerouslySetInnerHTML={{ __html: m.body_html || m.snippet }} />
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <textarea rows={3} placeholder="Votre réponse…" value={reply}
                onChange={(e) => setReply(e.target.value)} />
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn primary" onClick={sendReply} disabled={sending}>
                  <Send size={15} /> {sending ? 'Envoi…' : 'Répondre'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
