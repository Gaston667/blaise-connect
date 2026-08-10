/** Libellés des jours utilisés uniquement pour l'affichage. */
export const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/** Réunit les créneaux réellement retournés par l'API, sans inventer d'horaire. */
export function getScheduleRows(slots) {
  const rows = new Map()

  for (const slot of slots) {
    const start = slot.start_time?.slice(0, 5)
    const end = slot.end_time?.slice(0, 5)
    if (start && end) rows.set(`${start}-${end}`, { type: 'period', start, end })
  }

  return [...rows.values()].sort((first, second) => first.start.localeCompare(second.start))
}
