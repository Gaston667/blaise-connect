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

/**
 * Prépare les cellules d'une colonne (un jour) : les lignes consécutives qui
 * portent exactement les mêmes cours sont fusionnées en une seule cellule
 * (ex. un bloc de 2 h n'est plus coupé en deux lignes d'une heure).
 * Retourne, pour chaque ligne, `null` (absorbée par la cellule précédente),
 * ou `{ slots, span }` avec `slots` = tous les cours simultanés (spécialités).
 */
export function getMergedDayCells(rows, getSlotsForRow) {
  const cells = []
  let runIndex = -1
  let runKey = ''
  rows.forEach((row, index) => {
    if (row.type === 'break') {
      cells.push({ slots: [], span: 1, isBreak: true })
      runIndex = -1
      return
    }
    const slots = getSlotsForRow(row)
    const key = slots.map((slot) => slot.id ?? `${slot.subject_name}-${slot.start_time}`).sort().join('|')
    if (runIndex >= 0 && key && key === runKey) {
      cells[runIndex].span += 1
      cells.push(null)
      return
    }
    cells.push({ slots, span: 1 })
    runIndex = index
    runKey = key
  })
  return cells
}

/** Nom affiché sous un cours : enseignant, sinon libellé du cours particulier. */
export function getSlotSubtitle(slot, fallback = '') {
  if (slot.is_special) return slot.title || 'Cours particulier'
  return slot.teacher_name || fallback
}
