import React, { useEffect, useRef, useState } from 'react'
import { Megaphone, Inbox as InboxIcon, BarChart3, Settings as Cog } from 'lucide-react'
import Campaigns from './pages/Campaigns.jsx'
import Messaging from './pages/Messaging.jsx'
import Analytics from './pages/Analytics.jsx'
import Settings from './pages/Settings.jsx'

const TABS = [
  { id: 'campaigns', label: 'Campagnes', icon: Megaphone, el: <Campaigns /> },
  { id: 'messaging', label: 'Messagerie', icon: InboxIcon, el: <Messaging /> },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, el: <Analytics /> },
  { id: 'settings', label: 'Paramètres', icon: Cog, el: <Settings /> },
]

export default function App() {
  const initial = (window.location.hash.replace('#/', '').split('?')[0]) || 'campaigns'
  const [tab, setTab] = useState(TABS.find((t) => t.id === initial)?.id || 'campaigns')
  const mainRef = useRef(null)

  // Au changement d'onglet : remonte en haut de la page de l'onglet.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    window.scrollTo({ top: 0 })
  }, [tab])

  const go = (id) => { setTab(id); window.location.hash = `#/${id}` }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>📧 Marketing Email</h1>
        <nav className="nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
              <t.icon size={17} /> {t.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main" ref={mainRef}>
        {TABS.find((t) => t.id === tab)?.el}
      </main>
    </div>
  )
}
