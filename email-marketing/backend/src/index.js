import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { notFound, errorHandler } from './middleware/error.js'

import accountsRoutes from './modules/accounts/routes.js'
import contactsRoutes from './modules/contacts/routes.js'
import campaignsRoutes from './modules/campaigns/routes.js'
import messagingRoutes from './modules/messaging/routes.js'
import analyticsRoutes from './modules/analytics/routes.js'
import aiRoutes from './modules/ai/routes.js'
import trackingRoutes from './modules/tracking/routes.js'

const app = express()

app.use(cors({ origin: env.frontendUrl, credentials: true }))
app.use(express.json({ limit: '5mb' }))
app.use(cookieParser())

app.get('/health', (req, res) => res.json({ ok: true, service: 'email-marketing', env: env.nodeEnv }))

// Tracking public (pixel + clics) — pas d'auth.
app.use('/t', trackingRoutes)

// API métier.
app.use('/api/accounts', accountsRoutes)
app.use('/api/contacts', contactsRoutes)
app.use('/api/campaigns', campaignsRoutes)
app.use('/api/messaging', messagingRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/ai', aiRoutes)

app.use(notFound)
app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`[email-marketing] API en écoute sur http://localhost:${env.port} (${env.nodeEnv})`)
})

export default app
