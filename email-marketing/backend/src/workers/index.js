import cron from 'node-cron'
import { processDueSequences } from './sequenceWorker.js'
import { syncAllInboxes } from './inboxSync.js'

// Process worker autonome (séparé de l'API web) : `npm run worker`.
// - séquences dues : toutes les 5 minutes
// - synchro inbox / détection de réponses : toutes les 2 minutes
console.log('[workers] démarrage des tâches planifiées')

cron.schedule('*/5 * * * *', () => {
  processDueSequences().catch((e) => console.error('[cron] sequences', e))
})

cron.schedule('*/2 * * * *', () => {
  syncAllInboxes().catch((e) => console.error('[cron] inbox', e))
})

// Premier passage immédiat au démarrage.
processDueSequences().catch(() => {})
syncAllInboxes().catch(() => {})
