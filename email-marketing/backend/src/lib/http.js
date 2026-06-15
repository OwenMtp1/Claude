// Petits helpers de réponse + wrapper async pour les routes Express.
export const ok = (res, data) => res.json({ ok: true, data })
export const created = (res, data) => res.status(201).json({ ok: true, data })
export const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ ok: false, error: message, ...extra })

// Évite les try/catch répétés : asyncRoute(handler) propage les erreurs au middleware.
export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next)

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
