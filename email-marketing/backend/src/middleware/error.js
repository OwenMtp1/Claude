import { HttpError } from '../lib/http.js'

export function notFound(req, res) {
  res.status(404).json({ ok: false, error: 'Route introuvable' })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err instanceof HttpError ? err.status : (err.status || 500)
  if (status >= 500) console.error('[error]', err)
  res.status(status).json({ ok: false, error: err.message || 'Erreur serveur' })
}
