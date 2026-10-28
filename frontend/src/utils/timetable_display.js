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
  const breakRows = []
  for (const schoolBreak of breaks) {
    const start = schoolBreak.start_time?.slice(0, 5)
    const end = schoolBreak.end_time?.slice(0, 5)
    if (start && end) breakRows.push({ type: 'break', start, end, label: schoolBreak.label })
  }

  const intervals = []
  for (const slot of slots) {
    const start = slot.start_time?.slice(0, 5)
    const end = slot.end_time?.slice(0, 5)
    if (start && end) intervals.push({ start, end })
  }

  // Les lignes ne doivent jamais se chevaucher : on découpe aux bornes de tous
  // les créneaux (ex. 15:30-17:30 et 16:30-17:30 donnent 15:30-16:30 puis 16:30-17:30).
  const points = [...new Set(intervals.flatMap((item) => [item.start, item.end]))].sort()
  const periodRows = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    if (intervals.some((item) => item.start <= start && item.end >= end)) {
      periodRows.push({ type: 'period', start, end })
    }
  }

  return [...periodRows, ...breakRows].sort((first, second) => first.start.localeCompare(second.start))
}
