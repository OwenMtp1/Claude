import React, { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Users } from 'lucide-react'
import { useStore, ROLES, BRICKS, uid } from '../store.jsx'
import { Modal, Field, Confirm, Empty } from '../ui.jsx'

// canManage(actor, target) : règles de hiérarchie des permissions
function canManage(actor, target) {
  if (actor.role === 'Fondateur') return true
  if (actor.role === 'Administrateur') return target.role !== 'Fondateur'
  if (actor.role === 'Manager') return target.teamOf === actor.id && !['Fondateur', 'Administrateur'].includes(target.role)
  return false
}

function rolesAssignable(actor) {
  if (actor.role === 'Fondateur') return ROLES
  if (actor.role === 'Administrateur') return ROLES.filter(r => r !== 'Fondateur')
  if (actor.role === 'Manager') return ['Membre']
  return []
}

function UserRow({ u, actor, store, onDelete }) {
  const editable = canManage(actor, u)
  const idEditable = actor.role === 'Fondateur'
  const patch = (k, v) => store.updateAccount(u.id, { [k]: v })
  return (
    <div className="card p-3 space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Field label="Mail"><input className="input" disabled={!editable} value={u.email} onChange={e => patch('email', e.target.value)} /></Field>
        <Field label="Pseudo"><input className="input" disabled={!editable} value={u.pseudo} onChange={e => patch('pseudo', e.target.value)} /></Field>
        <Field label="Mot de passe"><input className="input" disabled={!editable} value={u.password} onChange={e => patch('password', e.target.value)} /></Field>
        <Field label="Id"><input className="input" disabled={!idEditable} value={u.id} onChange={e => {
          const newId = e.target.value
          store.setDb(d => { d.accounts.find(a => a.id === u.id).id = newId; return d })
        }} /></Field>
        <Field label="Permissions">
          <select className="input" disabled={!editable} value={u.role} onChange={e => patch('role', e.target.value)}>
            {ROLES.map(r => <option key={r} value={r} disabled={!rolesAssignable(actor).includes(r)}>{r}</option>)}
          </select>
        </Field>
      </div>
      {u.role === 'Membre' && actor.role !== 'Manager' && (
        <Field label="Équipe (manager)">
          <select className="input !w-auto" disabled={!editable} value={u.teamOf || ''} onChange={e => patch('teamOf', e.target.value || null)}>
            <option value="">— Aucune équipe —</option>
            {store.db.accounts.filter(a => a.role === 'Manager').map(m => <option key={m.id} value={m.id}>Équipe de {m.pseudo}</option>)}
          </select>
        </Field>
      )}
      <div>
        <span className="label">Briques accessibles</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {BRICKS.map(b => (
            <label key={b} className={`flex items-center gap-1.5 text-xs ${editable ? 'cursor-pointer' : 'opacity-50'}`}>
              <input type="checkbox" disabled={!editable} checked={(u.bricks || []).includes(b)}
                onChange={e => patch('bricks', e.target.checked ? [...(u.bricks || []), b] : (u.bricks || []).filter(x => x !== b))} />
              {b}
            </label>
          ))}
        </div>
      </div>
      {editable && (
        <div className="flex justify-end">
          <button className="btn-danger !py-1 text-xs" onClick={() => onDelete(u.id)}><Trash2 size={13} /> Supprimer le compte</button>
        </div>
      )}
    </div>
  )
}

export default function Admin({ mode }) {
  // mode: 'admin' (Gestion Administration) ou 'teams' (Gérez mes équipes)
  const store = useStore()
  const actor = store.account
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ email: '', pseudo: '', password: '' })
  const [confirmDel, setConfirmDel] = useState(null)
  const [openTeams, setOpenTeams] = useState({})

  const all = store.db.accounts
  const users = mode === 'teams'
    ? all.filter(a => a.teamOf === actor.id || a.id === actor.id)
    : all

  const managers = users.filter(u => u.role === 'Manager')
  const standalone = users.filter(u => u.role !== 'Manager' && !u.teamOf)

  const create = () => {
    if (!form.email || !form.password) return
    const acc = store.addAccount({ ...form, role: 'Membre', teamOf: mode === 'teams' ? actor.id : null })
    setCreating(false)
    setForm({ email: '', pseudo: '', password: '' })
    return acc
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold">{mode === 'teams' ? 'Gérez mes équipes' : 'Gestion Administration'}</h2>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Créer un utilisateur</button>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3"><Users size={18} className="text-brand" /><h3 className="font-bold">Gestion des utilisateurs</h3></div>
        {users.length === 0 && <Empty text="Aucun utilisateur." />}
        <div className="space-y-3">
          {standalone.map(u => <UserRow key={u.id} u={u} actor={actor} store={store} onDelete={setConfirmDel} />)}
          {managers.map(m => {
            const team = all.filter(a => a.teamOf === m.id)
            return (
              <div key={m.id} className="space-y-2">
                <UserRow u={m} actor={actor} store={store} onDelete={setConfirmDel} />
                <button className="flex items-center gap-1.5 text-sm font-bold text-brand ml-3"
                  onClick={() => setOpenTeams(t => ({ ...t, [m.id]: !t[m.id] }))}>
                  {openTeams[m.id] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  Équipe de {m.pseudo} ({team.length})
                </button>
                {openTeams[m.id] && (
                  <div className="ml-6 space-y-2">
                    {team.length === 0 && <p className="text-xs text-muted">Aucun membre dans cette équipe.</p>}
                    {team.map(u => <UserRow key={u.id} u={u} actor={actor} store={store} onDelete={setConfirmDel} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {creating && (
        <Modal title="Créer un utilisateur" onClose={() => setCreating(false)}>
          <div className="space-y-3">
            <Field label="Mail" required><input className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Pseudo"><input className="input" value={form.pseudo} onChange={e => setForm(f => ({ ...f, pseudo: e.target.value }))} /></Field>
            <Field label="Mot de passe" required><input className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></Field>
            <p className="text-xs text-muted">L'Id est généré automatiquement et l'utilisateur est ajouté à la base de données{mode === 'teams' ? ' dans votre équipe' : ''}.</p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setCreating(false)}>Annuler</button>
              <button className="btn-primary" onClick={create}>Créer</button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Confirm message="Supprimer définitivement ce compte utilisateur ?"
          onYes={() => { store.deleteAccount(confirmDel); setConfirmDel(null) }} onNo={() => setConfirmDel(null)} />
      )}
    </div>
  )
}
