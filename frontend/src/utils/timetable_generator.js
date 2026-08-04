// Générateur d'emploi du temps hebdomadaire à partir d'un besoin en heures/semaine
// par matière. Règles simples pour une première version :
//   - pas de trou dans la journée (on remplit chaque jour du premier au dernier créneau)
//   - on évite de placer deux fois la même matière le même jour, sauf si le nombre
//     d'heures demandées force la répétition
//   - à volume horaire égal, la matière avec le plus d'heures restantes est
//     priorisée en premier
//
// Un cours dure 2h (et non 1h). Horaires de l'établissement : 8h00-19h00.
// Les cours réguliers (générés ici) s'arrêtent au plus tard à 17h30 ; au-delà
// et jusqu'à 19h00, seuls des cours particuliers (saisis à la main, hors de
// ce générateur) peuvent être placés.
//
// Récréation : 9h50-10h10 pour le collège/lycée, 9h30-9h50 pour le primaire
// (et la maternelle, qui suit le même rythme). Pause déjeuner commune :
// 12h00-13h30. Ces deux pauses sont affichées comme des lignes à part
// entière dans la grille (voir getDayScheduleForStage), pas juste un trou.

export const DEFAULT_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']

export const ESTABLISHMENT_OPENING_HOUR = 8
export const ESTABLISHMENT_CLOSING_HOUR = 19
export const REGULAR_COURSE_CLOSING_TIME = '17:30'

export const LUNCH_BREAK = { start: '12:00', end: '13:30', label: 'Pause déjeuner' }

// Créneaux réguliers (cours de 2h) utilisables par le générateur automatique,
// un jeu par cycle scolaire. Tous s'arrêtent à 17h30. Les blocs du matin sont
// légèrement raccourcis par la récréation (20 min).
export const SECONDARY_PERIODS = [
  { start: '08:00', end: '09:50' },
  { start: '10:10', end: '12:00' },
  { start: '13:30', end: '15:30' },
  { start: '15:30', end: '17:30' },
]
const SECONDARY_BREAK = { afterPeriodIndex: 0, label: 'Récréation', start: '09:50', end: '10:10' }

export const PRIMARY_PERIODS = [
  { start: '08:00', end: '09:30' },
  { start: '09:50', end: '12:00' },
  { start: '13:30', end: '15:30' },
  { start: '15:30', end: '17:30' },
]
const PRIMARY_BREAK = { afterPeriodIndex: 0, label: 'Récréation', start: '09:30', end: '09:50' }

// Prolongement affiché après 17h30, réservé aux cours particuliers (jamais
// rempli par le générateur automatique).
const EVENING_EXTENSION_PERIODS = [
  { start: '17:30', end: '18:00' },
  { start: '18:00', end: '19:00' },
]

function isPrimaryStage(educationStage) {
  return educationStage === 'PRESCHOOL' || educationStage === 'PRIMARY'
}

export function getRegularPeriodsForStage(educationStage) {
  return isPrimaryStage(educationStage) ? PRIMARY_PERIODS : SECONDARY_PERIODS
}

/**
 * Construit la trame d'une journée (période par période, pauses incluses)
 * pour l'affichage en grille. Chaque entrée est soit un créneau de cours
 * ({ type: 'period', start, end }), soit une pause qui s'étend sur toute la
 * largeur de la semaine ({ type: 'break', label, start, end }).
 * @param {string|undefined} educationStage
 * @param {{ fullDay?: boolean }} options
 */
export function getDayScheduleForStage(educationStage, options = {}) {
  const periods = getRegularPeriodsForStage(educationStage)
  const morningBreak = isPrimaryStage(educationStage) ? PRIMARY_BREAK : SECONDARY_BREAK

  const schedule = []
  periods.forEach((period, index) => {
    schedule.push({ type: 'period', ...period })
    if (index === morningBreak.afterPeriodIndex) {
      schedule.push({ type: 'break', label: morningBreak.label, start: morningBreak.start, end: morningBreak.end })
    }
    if (index === 1) {
      schedule.push({ type: 'break', label: LUNCH_BREAK.label, start: LUNCH_BREAK.start, end: LUNCH_BREAK.end })
    }
  })

  if (options.fullDay) {
    EVENING_EXTENSION_PERIODS.forEach((period) => schedule.push({ type: 'period', ...period }))
  }

  return schedule
}

/**
 * @param {{ subjectId: string, subjectName: string, hours: number }[]} subjectHours
 * @param {{ days?: string[], periods?: {start: string, end: string}[] }} options
 * @returns {{
 *   grid: Record<string, (string|null)[]>,
 *   periods: {start: string, end: string}[],
 *   warnings: string[],
 *   unplacedHoursBySubject: { subjectId: string, subjectName: string, hours: number }[],
 * }}
 */
export function generateWeeklyTimetable(subjectHours, options = {}) {
  const days = options.days ?? DEFAULT_DAYS
  const periods = options.periods ?? SECONDARY_PERIODS
  const hoursPerPeriod = 2

  const remainingHoursBySubjectId = new Map(
    subjectHours.map((entry) => [entry.subjectId, entry.hours])
  )
  const subjectNameById = new Map(
    subjectHours.map((entry) => [entry.subjectId, entry.subjectName])
  )

  const grid = {}
  days.forEach((day) => { grid[day] = new Array(periods.length).fill(null) })

  const totalCapacity = days.length * periods.length * hoursPerPeriod
  const totalRequested = subjectHours.reduce((sum, entry) => sum + entry.hours, 0)
  const warnings = []
  if (totalRequested > totalCapacity) {
    warnings.push(
      `Le volume horaire demandé (${totalRequested}h) dépasse la capacité des cours réguliers (${totalCapacity}h, cours de 2h, hors récréation et pause déjeuner). Certaines heures ne seront pas placées.`
    )
  }

  for (const day of days) {
    const subjectsUsedToday = new Set()
    for (let period = 0; period < periods.length; period++) {
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
      remainingHoursBySubjectId.set(
        subjectId,
        Math.max(0, remainingHoursBySubjectId.get(subjectId) - hoursPerPeriod)
      )
    }
  }

  const unplacedHoursBySubject = [...remainingHoursBySubjectId.entries()]
    .filter(([, hours]) => hours > 0)
    .map(([subjectId, hours]) => ({ subjectId, subjectName: subjectNameById.get(subjectId), hours }))

  return { grid, periods, warnings, unplacedHoursBySubject }
}
