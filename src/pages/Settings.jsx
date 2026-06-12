import React, { useRef, useState } from 'react'
import { Palette, Globe, LayoutGrid, Plug, User, Trash2, Check } from 'lucide-react'
import { useStore } from '../store.jsx'
import { THEMES, applyTheme } from '../themes.js'
import { Modal, Field, Confirm } from '../ui.jsx'

function ImageInput({ value, onChange, label }) {
  const ref = useRef(null)
  return (
    <div className="flex items-center gap-3">
      {value ? <img src={value} alt="" className="w-12 h-12 rounded-xl object-cover border border-line" />
        : <div className="w-12 h-12 rounded-xl bg-surface border border-line" />}
      <input type="file" accept="image/*" ref={ref} className="hidden" onChange={e => {
        const f = e.target.files[0]
        if (!f) return
        const r = new FileReader()
        r.onload = () => onChange(String(r.result))
        r.readAsDataURL(f)
      }} />
      <button className="btn-ghost text-xs" onClick={() => ref.current.click()}>{label}</button>
      {value && <button className="text-xs text-red-500 underline" onClick={() => onChange('')}>Retirer</button>}
    </div>
  )
}

export default function Settings({ onEditWidgets, currentTheme, onThemeSaved }) {
  const store = useStore()
  const [tab, setTab] = useState('ux')
  const [pendingTheme, setPendingTheme] = useState(currentTheme)
  const [confirmDelEnv, setConfirmDelEnv] = useState(null)
  const me = store.account
  const session = store.session
  const env = store.db.environments.find(e => e.id === session.envId)
  const mySubs = store.db.subenvs.filter(s => s.envId === session.envId)
  const curSub = store.db.subenvs.find(s => s.id === session.subEnvId)
  const hubspot = store.sub?.integrations?.hubspot || {}
  const linkedin = store.sub?.integrations?.linkedin || {}
  const setIntegration = (key, patch) => store.setSub(d => ({ ...d, integrations: { ...(d.integrations || {}), [key]: { ...((d.integrations || {})[key] || {}), ...patch } } }))

  const tabs = [
    ['ux', 'UX & Thèmes', Palette],
    ['widgets', 'Widgets dashboard', LayoutGrid],
    ['envs', 'Gérer mes environnements', Globe],
    ['integrations', 'Intégrations', Plug],
    ['profile', 'Mon profil', User],
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold">Paramètres</h2>
      <div className="flex gap-2 flex-wrap">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} className={`btn text-xs ${tab === id ? 'bg-brand text-white' : 'bg-card border border-line'}`} onClick={() => setTab(id)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'ux' && (
        <div className="card p-4 space-y-4">
          <h3 className="font-bold">Thèmes de design</h3>
          {['static', 'animated'].map(type => (
            <div key={type}>
              <p className="label">{type === 'static' ? 'Thèmes classiques' : 'Ambiances animées'}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {THEMES.filter(t => t.type === type).map(t => (
                  <button key={t.id} onClick={() => setPendingTheme(t.id)}
                    className={`rounded-xl border-2 p-2 text-left transition ${pendingTheme === t.id ? 'border-brand' : 'border-line hover:border-muted'}`}>
                    <div className="h-10 rounded-lg mb-1.5" style={{
                      background: t.type === 'animated' ? t.bg : `linear-gradient(120deg, rgb(${t.vars.brand}), rgb(${t.vars.brand2}))`,
                    }} />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{t.name}</span>
                      {pendingTheme === t.id && <Check size={13} className="text-brand" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="btn-primary" onClick={() => { applyTheme(pendingTheme); onThemeSaved(pendingTheme) }}>Sauvegarder le thème</button>
        </div>
      )}

      {tab === 'widgets' && (
        <div className="card p-4 space-y-3">
          <h3 className="font-bold">Modifier les widgets dashboard</h3>
          <p className="text-sm text-muted">Réorganisez, masquez ou redimensionnez les briques du Dashboard, façon écran d'accueil iOS : chaque brique a un petit crayon avec un menu pour la masquer ou changer sa taille.</p>
          <button className="btn-primary" onClick={onEditWidgets}>Ouvrir le mode édition des widgets</button>
        </div>
      )}

      {tab === 'envs' && (
        <div className="space-y-3">
          {env && (
            <div className="card p-4 space-y-3">
              <h3 className="font-bold">Environnement : {env.name}</h3>
              <Field label="Nom"><input className="input !w-72" value={env.name} onChange={e => store.updateEnv(env.id, { name: e.target.value })} /></Field>
              <Field label="Logo de l'entreprise"><ImageInput value={env.logo} onChange={v => store.updateEnv(env.id, { logo: v })} label="Télécharger un logo" /></Field>
              <Field label="Code d'accès (4 chiffres, vide = aucun)">
                <input className="input !w-32" maxLength={4} value={env.pin || ''} onChange={e => store.updateEnv(env.id, { pin: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <button className="btn-danger !py-1.5 text-xs" onClick={() => setConfirmDelEnv(env.id)}><Trash2 size={13} /> Supprimer l'environnement</button>
            </div>
          )}
          <div className="card p-4 space-y-3">
            <h3 className="font-bold">Sous-environnements de {env?.name}</h3>
            {mySubs.map(s => (
              <div key={s.id} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end border-b border-line pb-3">
                <Field label="Prénom"><input className="input" value={s.prenom} onChange={e => store.updateSubEnv(s.id, { prenom: e.target.value })} /></Field>
                <Field label="Nom"><input className="input" value={s.nom} onChange={e => store.updateSubEnv(s.id, { nom: e.target.value })} /></Field>
                <Field label="Poste"><input className="input" value={s.poste} onChange={e => store.updateSubEnv(s.id, { poste: e.target.value })} /></Field>
                <Field label="Service"><input className="input" value={s.service} onChange={e => store.updateSubEnv(s.id, { service: e.target.value })} /></Field>
                <Field label="Code (4 chiffres)"><input className="input" maxLength={4} value={s.pin} onChange={e => store.updateSubEnv(s.id, { pin: e.target.value.replace(/\D/g, '') })} /></Field>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'integrations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">HubSpot CRM</h3>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input type="checkbox" checked={!!hubspot.enabled} onChange={e => setIntegration('hubspot', { enabled: e.target.checked })} /> Activée
              </label>
            </div>
            <Field label="Clé API privée (Private App Token)">
              <input className="input" type="password" placeholder="pat-eu1-..." value={hubspot.token || ''} onChange={e => setIntegration('hubspot', { token: e.target.value })} />
            </Field>
            <Field label="Options de synchronisation">
              <div className="space-y-1 text-sm">
                {[['contacts', 'Synchroniser les contacts'], ['deals', 'Synchroniser les transactions (deals)'], ['notes', 'Synchroniser les notes']].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!hubspot[k]} onChange={e => setIntegration('hubspot', { [k]: e.target.checked })} /> {l}
                  </label>
                ))}
              </div>
            </Field>
            <p className="text-xs text-muted">La synchronisation s'exécutera dès qu'une clé API valide est renseignée et que l'application a accès au réseau HubSpot.</p>
          </div>
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">LinkedIn</h3>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input type="checkbox" checked={!!linkedin.enabled} onChange={e => setIntegration('linkedin', { enabled: e.target.checked })} /> Activée
              </label>
            </div>
            <Field label="URL de votre profil">
              <input className="input" placeholder="https://linkedin.com/in/..." value={linkedin.profile || ''} onChange={e => setIntegration('linkedin', { profile: e.target.value })} />
            </Field>
            <Field label="Options">
              <div className="space-y-1 text-sm">
                {[['enrich', 'Enrichir les contacts depuis LinkedIn'], ['openProfiles', 'Ouvrir les profils en un clic depuis les RDV']].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!linkedin[k]} onChange={e => setIntegration('linkedin', { [k]: e.target.checked })} /> {l}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </div>
      )}

      {tab === 'profile' && (
        <div className="card p-4 space-y-3 max-w-md">
          <h3 className="font-bold">Mon profil</h3>
          <Field label="Photo de profil"><ImageInput value={me.photo} onChange={v => store.updateAccount(me.id, { photo: v })} label="Changer ma photo" /></Field>
          <Field label="Pseudo"><input className="input" value={me.pseudo} onChange={e => store.updateAccount(me.id, { pseudo: e.target.value })} /></Field>
          <Field label="Mot de passe"><input className="input" value={me.password} onChange={e => store.updateAccount(me.id, { password: e.target.value })} /></Field>
          {curSub && <Field label="Photo du sous-environnement (organigramme)">
            <ImageInput value={curSub.photo} onChange={v => store.updateSubEnv(curSub.id, { photo: v })} label="Changer la photo" />
          </Field>}
        </div>
      )}

      {confirmDelEnv && (
        <Confirm message="Supprimer cet environnement et toutes ses données ?"
          onYes={() => { store.deleteEnv(confirmDelEnv); setConfirmDelEnv(null); store.setSession(s => ({ ...s, envId: null, subEnvId: null })) }}
          onNo={() => setConfirmDelEnv(null)} />
      )}
    </div>
  )
}
