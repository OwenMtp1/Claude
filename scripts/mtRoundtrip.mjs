// Test : assembleDb(splitDb(db)) reconstruit fidèlement db (zéro perte de données).
// Lancer : node scripts/mtRoundtrip.mjs
import { splitDb, assembleDb } from '../src/multiTenantSync.js'

// Échantillon représentatif : 2 sociétés, comptes (dont un partagé), espaces,
// support rattaché à une société + un ticket non rattaché (plateforme), flags.
const db = {
  _autoSeed: { pipelineOwen: true },
  _savedAt: 1700000000000,
  accounts: [
    { id: '01', pseudo: 'Owen', email: 'owen@x.com', role: 'Fondateur' },
    { id: 'a2', pseudo: 'Julie', email: 'julie@a.com', role: 'Manager' },
    { id: 'b1', pseudo: 'Karim', email: 'karim@b.com', role: 'Membre' },
  ],
  environments: [
    { id: 'env-a', name: 'Société A', createdBy: '01', members: ['a2'] },
    { id: 'env-b', name: 'Société B', createdBy: '01', members: ['b1'] },
  ],
  subenvs: [
    { id: 'sa1', envId: 'env-a', prenom: 'Julie' },
    { id: 'sb1', envId: 'env-b', prenom: 'Karim' },
  ],
  data: {
    sa1: { rdvs: [{ id: 'r1', entreprise: 'Acme' }], currency: 'EUR' },
    sb1: { rdvs: [{ id: 'r2', entreprise: 'Globex' }] },
  },
  tickets: [
    { id: 't1', envId: 'env-a', subject: 'A' },
    { id: 't2', envId: 'env-b', subject: 'B' },
    { id: 't3', envId: null, subject: 'orphelin' },
  ],
  clients: [{ id: 'c1', envId: 'env-a' }],
  projects: [{ id: 'p1', sourceEnvId: 'env-b' }],
  supportRequests: [{ id: 'sr1', name: 'Prospect' }],
  cannedReplies: [{ id: 'cr1' }],
  kbArticles: [{ id: 'kb1' }],
  supportLogs: [], supportTrash: [],
}

const norm = (d) => {
  const sort = (a) => [...a].sort((x, y) => (x.id > y.id ? 1 : -1))
  return {
    accounts: sort(d.accounts), environments: sort(d.environments), subenvs: sort(d.subenvs),
    data: d.data, tickets: sort(d.tickets), clients: sort(d.clients), projects: sort(d.projects),
    supportRequests: sort(d.supportRequests), cannedReplies: sort(d.cannedReplies),
    kbArticles: sort(d.kbArticles), supportLogs: sort(d.supportLogs), supportTrash: sort(d.supportTrash),
    _autoSeed: d._autoSeed, _savedAt: d._savedAt,
  }
}

const back = assembleDb(splitDb(db))
const a = JSON.stringify(norm(db))
const b = JSON.stringify(norm(back))

if (a === b) {
  console.log('round-trip OK ✓ — aucune donnée perdue (2 sociétés, compte partagé, orphelins, flags)')
} else {
  console.error('ÉCHEC round-trip ✗')
  console.error('attendu :', a)
  console.error('obtenu  :', b)
  process.exit(1)
}
