/** Utilitaires de navigation par semaine (dates au format AAAA-MM-JJ, jours locaux). */

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatIso(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function addDays(value, days) {
  const date = parseDate(value)
  date.setDate(date.getDate() + days)
  return formatIso(date)
}

/** Lundi de la semaine contenant la date donnée (aujourd'hui par défaut). */
export function getWeekStart(value) {
  const date = value ? parseDate(value) : new Date()
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return formatIso(date)
}

/** « 31 août – 4 septembre 2026 » */
export function formatWeekRange(weekStart, lastDayIndex = 4) {
  const start = parseDate(weekStart)
  const end = parseDate(addDays(weekStart, lastDayIndex))
  const sameMonth = start.getMonth() === end.getMonth()
  const startLabel = start.toLocaleDateString('fr-FR', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'long' })
  const endLabel = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

/** « 31/08 » */
export function formatShortDate(value) {
  const [, month, day] = value.split('-')
  return `${day}/${month}`
}

/**
 * Un cours daté n'a lieu qu'à sa date ; un cours hebdomadaire a lieu chaque
 * semaine, le bon jour, pendant la période de validité de son emploi du temps.
 */
export function isSlotOnDate(slot, dateValue, dayIndex) {
  if (slot.course_date) return slot.course_date === dateValue
  return slot.day_of_week === dayIndex + 1
    && (!slot.effective_start_date || dateValue >= slot.effective_start_date)
    && (!slot.effective_end_date || dateValue <= slot.effective_end_date)
}
