/** Libellés des jours utilisés uniquement pour l'affichage. */
export const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/**
 * Fusionne les créneaux réellement retournés par l'API et les pauses de
 * l'établissement en une seule liste de lignes triées, sans inventer d'horaire.
 */
export function getScheduleRows(slots, breaks = []) {
  const rows = new Map()

  for (const slot of slots) {
    const start = slot.start_time?.slice(0, 5)
    const end = slot.end_time?.slice(0, 5)
    if (start && end) rows.set(`period-${start}-${end}`, { type: 'period', start, end })
  }

  for (const schoolBreak of breaks) {
    const start = schoolBreak.start_time?.slice(0, 5)
    const end = schoolBreak.end_time?.slice(0, 5)
    if (start && end) {
      rows.set(`break-${start}-${end}`, {
        type: 'break',
        start,
        end,
        label: schoolBreak.label,
      })
    }
  }

  return [...rows.values()].sort((first, second) => first.start.localeCompare(second.start))
}
