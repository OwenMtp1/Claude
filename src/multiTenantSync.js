// ---------------------------------------------------------------------------
//  Synchronisation MULTI-TENANT (utilisée quand FEATURES.multiTenant est ON).
//
//  Idée : au lieu d'un seul blob partagé, chaque société (org) a sa ligne
//  `org_state`. Un utilisateur connecté ne charge (RLS) que les org dont il est
//  membre ; un admin plateforme les voit toutes. On RÉASSEMBLE ces lignes en un
//  objet `db` de la MÊME forme qu'avant, pour que toutes les pages marchent sans
//  changement. À la sauvegarde, on REDÉCOUPE `db` par société et on ne pousse
//  que les lignes concernées.
//
//  Invariant testé : assembleDb(splitDb(db)) reconstruit db (aux régularisations
//  de tri près). Voir scripts/mtRoundtrip.mjs.
// ---------------------------------------------------------------------------
import { getClient } from './supabaseClient.js'
import { encryptBlob, decryptBlob } from './blobCrypto.js'

// Bucket spécial portant les données globales (plateforme/support non rattaché).
export const PLATFORM_KEY = 'platform'

const arr = (x) => (Array.isArray(x) ? x : [])
const byId = (list) => { const m = new Map(); for (const x of arr(list)) m.set(x.id, x); return [...m.values()] }

// Un compte est-il membre d'une société ?
const isMember = (acc, env) =>
  env.createdBy === acc.id || arr(env.members).includes(acc.id)

// --------------------------------------------------------------- DÉCOUPAGE
// db (forme historique) → { [orgId]: data, platform: data }.
// `orgEnvIds` = liste des id d'environnements à matérialiser comme org (sinon, tous).
export function splitDb(db, orgEnvIds = null) {
  const envs = arr(db.environments)
  const ids = orgEnvIds || envs.map((e) => e.id)
  const out = {}

  for (const env of envs) {
    if (!ids.includes(env.id)) continue
    const oid = env.id
    const subenvs = arr(db.subenvs).filter((s) => s.envId === oid)
    const spaces = {}
    for (const s of subenvs) if (db.data && db.data[s.id] != null) spaces[s.id] = db.data[s.id]
    out[oid] = {
      env,
      subenvs,
      spaces,
      members: arr(db.accounts).filter((a) => isMember(a, env)),
      tickets: arr(db.tickets).filter((t) => t.envId === oid),
      clients: arr(db.clients).filter((c) => c.envId === oid),
      projects: arr(db.projects).filter((p) => p.envId === oid || p.sourceEnvId === oid),
    }
  }

  // Tout ce qui n'est rattaché à aucune société va dans le bucket plateforme.
  const claimed = {
    tickets: new Set(Object.values(out).flatMap((o) => o.tickets.map((t) => t.id))),
    clients: new Set(Object.values(out).flatMap((o) => o.clients.map((c) => c.id))),
    projects: new Set(Object.values(out).flatMap((o) => o.projects.map((p) => p.id))),
  }
  out[PLATFORM_KEY] = {
    accountsFull: arr(db.accounts),
    supportRequests: arr(db.supportRequests),
    cannedReplies: arr(db.cannedReplies),
    kbArticles: arr(db.kbArticles),
    supportLogs: arr(db.supportLogs),
    supportTrash: arr(db.supportTrash),
    tickets: arr(db.tickets).filter((t) => !claimed.tickets.has(t.id)),
    clients: arr(db.clients).filter((c) => !claimed.clients.has(c.id)),
    projects: arr(db.projects).filter((p) => !claimed.projects.has(p.id)),
    flags: pickFlags(db),
  }
  return out
}

function pickFlags(db) {
  const flags = {}
  for (const k of Object.keys(db)) {
    if (k.startsWith('_') || k === 'version') flags[k] = db[k]
  }
  return flags
}

// --------------------------------------------------------------- RÉASSEMBLAGE
// { [orgId]: data, platform: data } → db (forme historique).
export function assembleDb(rows) {
  const db = {
    accounts: [], environments: [], subenvs: [], data: {},
    supportRequests: [], tickets: [], clients: [], projects: [],
    supportLogs: [], supportTrash: [], cannedReplies: [], kbArticles: [],
  }
  for (const [key, d] of Object.entries(rows || {})) {
    if (!d) continue
    if (key === PLATFORM_KEY) {
      db.accounts.push(...arr(d.accountsFull))
      db.supportRequests.push(...arr(d.supportRequests))
      db.cannedReplies.push(...arr(d.cannedReplies))
      db.kbArticles.push(...arr(d.kbArticles))
      db.supportLogs.push(...arr(d.supportLogs))
      db.supportTrash.push(...arr(d.supportTrash))
      db.tickets.push(...arr(d.tickets))
      db.clients.push(...arr(d.clients))
      db.projects.push(...arr(d.projects))
      Object.assign(db, d.flags || {})
    } else {
      if (d.env) db.environments.push(d.env)
      db.subenvs.push(...arr(d.subenvs))
      Object.assign(db.data, d.spaces || {})
      db.accounts.push(...arr(d.members))
      db.tickets.push(...arr(d.tickets))
      db.clients.push(...arr(d.clients))
      db.projects.push(...arr(d.projects))
    }
  }
  // Dédoublonnage (un compte peut apparaître dans plusieurs sociétés + plateforme).
  db.accounts = byId(db.accounts)
  db.tickets = byId(db.tickets)
  db.clients = byId(db.clients)
  db.projects = byId(db.projects)
  return db
}

// --------------------------------------------------------------- SUPABASE I/O
// Charge toutes les lignes org_state visibles (RLS) et reconstruit db.
export async function loadMultiTenant() {
  const c = await getClient(); if (!c) return null
  const { data, error } = await c.from('org_state').select('org_id, data')
  if (error || !data) return null
  const rows = {}
  for (const r of data) {
    const d = await decryptBlob(r.data)         // org_state aussi chiffré au repos
    rows[d?.__key === PLATFORM_KEY ? PLATFORM_KEY : r.org_id] = d
  }
  return assembleDb(rows)
}

// Pousse les sociétés modifiées. orgRowIds : map { envId|platform : org_id (uuid) }.
export async function pushMultiTenant(db, orgRowIds) {
  const c = await getClient(); if (!c) return
  const split = splitDb(db)
  for (const [key, d] of Object.entries(split)) {
    const orgId = orgRowIds[key]
    if (!orgId) continue
    try {
      const payload = await encryptBlob({ ...d, __key: key })
      await c.from('org_state').upsert({ org_id: orgId, data: payload, updated_at: new Date().toISOString() })
    } catch (e) { /* offline / non-membre */ }
  }
}
