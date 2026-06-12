import React from 'react'
import { useStore } from '../store.jsx'
import { Empty } from '../ui.jsx'

export default function OrgChart({ onOpenProfile }) {
  const store = useStore()
  const session = store.session
  const env = store.db.environments.find(e => e.id === session.envId)
  const subs = store.db.subenvs.filter(s => s.envId === session.envId)
  const isManager = ['Manager', 'Administrateur', 'Fondateur'].includes(store.account.role)
  const services = [...new Set(subs.map(s => s.service).filter(Boolean))]

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-extrabold">Organigramme — {env?.name}</h2>
      {subs.length === 0 && <Empty text="Aucun profil dans cet environnement." />}
      <div className="flex flex-col items-center gap-6">
        {env && (
          <div className="card px-6 py-3 text-center border-2 border-brand">
            {env.logo && <img src={env.logo} alt="" className="w-10 h-10 rounded-lg object-cover mx-auto mb-1" />}
            <div className="font-extrabold">{env.name}</div>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-8 w-full">
          {services.map(service => (
            <div key={service} className="flex flex-col items-center gap-3">
              <div className="chip bg-brand/15 text-brand !text-sm !px-4 !py-1.5 font-extrabold">{service}</div>
              <div className="w-px h-4 bg-line" />
              <div className="flex flex-wrap justify-center gap-3">
                {subs.filter(s => s.service === service).map(s => (
                  <div key={s.id} className="card p-4 text-center w-44">
                    {s.photo
                      ? <img src={s.photo} alt="" className="w-14 h-14 rounded-full object-cover mx-auto mb-2 border-2 border-brand/30" />
                      : <div className="w-14 h-14 rounded-full bg-brand/15 text-brand font-extrabold flex items-center justify-center mx-auto mb-2 text-lg">
                          {(s.prenom?.[0] || '') + (s.nom?.[0] || '')}
                        </div>}
                    <div className="font-bold text-sm">{s.prenom} {s.nom}</div>
                    <div className="text-xs text-muted">{s.poste}</div>
                    {isManager && (
                      <button className="btn-ghost !py-1 text-xs mt-2 w-full justify-center" onClick={() => onOpenProfile(s)}>
                        Afficher le profil
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
