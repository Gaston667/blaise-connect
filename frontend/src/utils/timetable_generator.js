// Générateur d'emploi du temps hebdomadaire à partir d'un besoin en heures/semaine
// par matière. Règles simples pour une première version :
//   - pas de trou dans la journée (on remplit chaque jour du premier au dernier créneau)
//   - on évite de placer deux fois la même matière le même jour, sauf si le nombre
//     d'heures demandées force la répétition
//   - à volume horaire égal, la matière avec le plus d'heures restantes est
//     priorisée en premier

export const DEFAULT_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
export const DEFAULT_PERIODS_PER_DAY = 4

/**
 * @param {{ subjectId: string, subjectName: string, hours: number }[]} subjectHours
 * @param {{ days?: string[], periodsPerDay?: number }} options
 * @returns {{
 *   grid: Record<string, (string|null)[]>,
 *   warnings: string[],
 *   unplacedHoursBySubject: { subjectId: string, subjectName: string, hours: number }[],
 * }}
 */
export function generateWeeklyTimetable(subjectHours, options = {}) {
  const days = options.days ?? DEFAULT_DAYS
  const periodsPerDay = options.periodsPerDay ?? DEFAULT_PERIODS_PER_DAY

  const remainingHoursBySubjectId = new Map(
    subjectHours.map((entry) => [entry.subjectId, entry.hours])
  )
  const subjectNameById = new Map(
    subjectHours.map((entry) => [entry.subjectId, entry.subjectName])
  )

  const grid = {}
  days.forEach((day) => { grid[day] = new Array(periodsPerDay).fill(null) })

  const totalCapacity = days.length * periodsPerDay
  const totalRequested = subjectHours.reduce((sum, entry) => sum + entry.hours, 0)
  const warnings = []
  if (totalRequested > totalCapacity) {
    warnings.push(
      `Le volume horaire demandé (${totalRequested}h) dépasse la capacité de la grille (${totalCapacity}h). Certaines heures ne seront pas placées.`
    )
  }

  for (const day of days) {
    const subjectsUsedToday = new Set()
    for (let period = 0; period < periodsPerDay; period++) {
      let candidates = [...remainingHoursBySubjectId.entries()].filter(
        ([subjectId, hours]) => hours > 0 && !subjectsUsedToday.has(subjectId)
      )
      if (candidates.length === 0) {
        // Plus aucune matière "fraîche" pour ce jour : on autorise une répétition
        // plutôt que de laisser un trou, si des heures restent à placer.
        candidates = [...remainingHoursBySubjectId.entries()].filter(([, hours]) => hours > 0)
      }
      if (candidates.length === 0) break

      candidates.sort((a, b) => b[1] - a[1])
      const [subjectId] = candidates[0]
      grid[day][period] = subjectId
      subjectsUsedToday.add(subjectId)
      remainingHoursBySubjectId.set(subjectId, remainingHoursBySubjectId.get(subjectId) - 1)
    }
  }

  const unplacedHoursBySubject = [...remainingHoursBySubjectId.entries()]
    .filter(([, hours]) => hours > 0)
    .map(([subjectId, hours]) => ({ subjectId, subjectName: subjectNameById.get(subjectId), hours }))

  return { grid, warnings, unplacedHoursBySubject }
}
