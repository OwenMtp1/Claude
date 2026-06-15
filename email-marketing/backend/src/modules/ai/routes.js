import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncRoute, ok } from '../../lib/http.js'
import { generateEmail } from '../../lib/ai.js'

const router = Router()
router.use(authRequired)

// Génère un email (sujet + corps HTML). Éditable côté front avant envoi.
router.post('/generate', asyncRoute(async (req, res) => {
  const { goal, tone, contact, language, context } = req.body
  const result = await generateEmail({ goal, tone, contact, language, context })
  ok(res, result)
}))

export default router
