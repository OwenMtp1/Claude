import dotenv from 'dotenv'
dotenv.config()

const required = (key, fallback) => {
  const v = process.env[key] ?? fallback
  if (v === undefined) {
    console.warn(`[config] variable d'environnement manquante : ${key}`)
  }
  return v
}

export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  // Sur Render, RENDER_EXTERNAL_URL est injecté automatiquement (service web).
  publicBaseUrl: process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:4000',
  frontendUrl: required('FRONTEND_URL', 'http://localhost:5173'),

  databaseUrl: required('DATABASE_URL'),
  // Supabase / Postgres managés exigent TLS. Détecté via la chaîne (?sslmode=require) ou DATABASE_SSL=true.
  databaseSsl: /sslmode=require/i.test(process.env.DATABASE_URL || '') || process.env.DATABASE_SSL === 'true',
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY'),
  appSharedSecret: required('APP_SHARED_SECRET', 'dev-secret'),

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/accounts/oauth/gmail/callback',
  },
  microsoft: {
    clientId: process.env.MS_CLIENT_ID || '',
    clientSecret: process.env.MS_CLIENT_SECRET || '',
    tenant: process.env.MS_TENANT || 'common',
    redirectUri: process.env.MS_REDIRECT_URI || 'http://localhost:4000/api/accounts/oauth/outlook/callback',
  },

  ai: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.AI_MODEL || 'claude-fable-5',
  },

  defaultDailyLimit: parseInt(process.env.DEFAULT_DAILY_LIMIT || '50', 10),
  sendBatchSize: parseInt(process.env.SEND_BATCH_SIZE || '25', 10),
}

export const isGmailConfigured = () => !!(env.google.clientId && env.google.clientSecret)
export const isOutlookConfigured = () => !!(env.microsoft.clientId && env.microsoft.clientSecret)
