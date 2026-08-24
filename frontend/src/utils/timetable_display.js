/** Libellés des jours utilisés uniquement pour l'affichage. */
export const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/**
 * Fusionne les créneaux réellement retournés par l'API et les pauses de
 * l'établissement en une seule liste de lignes triées, sans inventer d'horaire.
 *
 * Une même heure de début peut apparaître avec des durées différentes selon
 * les jours (ex. un reliquat de 15 min en fin de volume horaire d'une
 * matière) : on ne garde alors qu'une seule ligne par heure de début, avec
 * la durée la plus longue observée, pour éviter les lignes dupliquées.
 */
export function getScheduleRows(slots, breaks = []) {
  const periodRows = new Map()

  for (const slot of slots) {
    const start = slot.start_time?.slice(0, 5)
    const end = slot.end_time?.slice(0, 5)
    if (!start || !end) continue
    const existing = periodRows.get(start)
    if (!existing || end > existing.end) {
      periodRows.set(start, { type: 'period', start, end })
    }
  }

  const breakRows = new Map()
  for (const schoolBreak of breaks) {
    const start = schoolBreak.start_time?.slice(0, 5)
    const end = schoolBreak.end_time?.slice(0, 5)
    if (start && end) {
      breakRows.set(start, { type: 'break', start, end, label: schoolBreak.label })
    }
  }

  return [...periodRows.values(), ...breakRows.values()]
    .sort((first, second) => first.start.localeCompare(second.start))
}
