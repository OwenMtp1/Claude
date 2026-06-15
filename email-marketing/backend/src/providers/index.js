import * as gmail from './gmail.js'
import * as outlook from './outlook.js'

// Interface unifiée des boîtes mail. Chaque fournisseur expose :
//   isConfigured(), getAuthUrl(state), exchangeCode(code),
//   sendEmail(account, opts), fetchInbox(account, opts)
const PROVIDERS = { gmail, outlook }

export function getProvider(name) {
  const p = PROVIDERS[name]
  if (!p) throw new Error(`Fournisseur inconnu : ${name}`)
  return p
}

export function availableProviders() {
  return Object.entries(PROVIDERS)
    .filter(([, p]) => p.isConfigured())
    .map(([name]) => name)
}
