// Calcul de la prochaine date d'envoi en respectant délai + fenêtre d'envoi.
// `send_window` = { days:[1..7 (lundi=1)], start:"09:00", end:"18:00" }.

function inWindow(date, win) {
  const day = ((date.getDay() + 6) % 7) + 1 // JS dim=0 → 7, lundi=1
  if (!(win.days || [1, 2, 3, 4, 5]).includes(day)) return false
  const [sh, sm] = (win.start || '09:00').split(':').map(Number)
  const [eh, em] = (win.end || '18:00').split(':').map(Number)
  const mins = date.getHours() * 60 + date.getMinutes()
  return mins >= sh * 60 + sm && mins <= eh * 60 + em
}

// Avance la date jusqu'au prochain créneau autorisé par la fenêtre d'envoi.
function nextWindowSlot(date, win) {
  const d = new Date(date)
  for (let i = 0; i < 14 * 24 * 4; i++) { // borne de sécurité (~14 j par pas de 15 min)
    if (inWindow(d, win)) return d
    d.setMinutes(d.getMinutes() + 15)
  }
  return d
}

export function computeNextSendAt(from, step, campaign) {
  const base = new Date(from)
  base.setDate(base.getDate() + (step.delay_days || 0))
  base.setHours(base.getHours() + (step.delay_hours || 0))
  const win = campaign.send_window || { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' }
  return nextWindowSlot(base, win)
}

export { inWindow }
