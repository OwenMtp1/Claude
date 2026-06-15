import { env } from '../config/env.js'

// ─────────────────────────────────────────────────────────────────────────────
// Générateur d'emails IA — pluggable.
// Si ANTHROPIC_API_KEY est défini, on appelle l'API Claude ; sinon on retombe
// sur un générateur local (templates) pour rester fonctionnel hors-ligne.
// L'interface publique : generateEmail({ goal, tone, contact, language, context })
//   → { subject, body_html }
// ─────────────────────────────────────────────────────────────────────────────

function fallbackEmail({ goal = 'prise de contact', tone = 'professionnel', contact = {}, language = 'fr' }) {
  const name = contact.first_name || (language === 'fr' ? 'Bonjour' : 'Hello')
  const company = contact.company ? ` chez ${contact.company}` : ''
  const subject = language === 'fr'
    ? `${goal} — ${contact.company || 'votre équipe'}`
    : `${goal} — ${contact.company || 'your team'}`
  const body = language === 'fr'
    ? `<p>Bonjour ${name},</p>
<p>Je me permets de vous contacter${company} au sujet de ${goal}. Nous aidons des équipes commerciales à gagner du temps et à mieux convertir.</p>
<p>Seriez-vous disponible pour un échange de 15 minutes cette semaine ?</p>
<p>Bien à vous,</p>`
    : `<p>Hi ${name},</p>
<p>Reaching out${company} about ${goal}. We help sales teams save time and convert better.</p>
<p>Would you have 15 minutes this week for a quick chat?</p>
<p>Best,</p>`
  return { subject, body_html: body }
}

export async function generateEmail(opts = {}) {
  const { goal = 'prise de contact', tone = 'professionnel', contact = {}, language = 'fr', context = '' } = opts

  if (!env.ai.apiKey) {
    return fallbackEmail(opts)
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: env.ai.apiKey })
    const prompt = `Tu es un expert en cold email B2B. Rédige UN email court (max 120 mots), ton ${tone}, langue ${language}.
Objectif : ${goal}.
Destinataire : ${contact.first_name || ''} ${contact.last_name || ''}, ${contact.title || ''} chez ${contact.company || ''}.
${context ? 'Contexte additionnel : ' + context : ''}
Utilise les variables {{first_name}} et {{company}} si pertinent.
Réponds STRICTEMENT en JSON : {"subject": "...", "body_html": "<p>...</p>"}`

    const msg = await client.messages.create({
      model: env.ai.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content?.[0]?.text || ''
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    if (!json.subject || !json.body_html) throw new Error('réponse IA incomplète')
    return { subject: json.subject, body_html: json.body_html }
  } catch (e) {
    console.warn('[ai] repli sur le générateur local :', e.message)
    return fallbackEmail(opts)
  }
}
