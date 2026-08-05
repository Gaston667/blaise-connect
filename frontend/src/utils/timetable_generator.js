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

function periodsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart
}

/**
 * L'algorithme doit toujours produire un emploi du temps, quelle que soit la
 * disponibilité réelle des enseignants (un même enseignant partagé par
 * plusieurs classes est le cas normal, pas une exception à contourner en
 * amont). Il ne place donc jamais une matière sur un créneau où son
 * enseignant est déjà en cours ailleurs, mais reste libre de la placer un
 * autre jour ou sur un autre créneau du même jour.
 *
 * @param {{ subjectId: string, subjectName: string, hours: number, teacherId?: string }[]} subjectHours
 * @param {{
 *   days?: string[],
 *   periods?: {start: string, end: string}[],
 *   busySlotsByTeacherId?: Map<string, {day_of_week: number, start: string, end: string}[]>,
 * }} options
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
  const busySlotsByTeacherId = options.busySlotsByTeacherId ?? new Map()
  const hoursPerPeriod = 2

  const remainingHoursBySubjectId = new Map(
    subjectHours.map((entry) => [entry.subjectId, entry.hours])
  )
  const subjectNameById = new Map(
    subjectHours.map((entry) => [entry.subjectId, entry.subjectName])
  )
  const teacherIdBySubjectId = new Map(
    subjectHours.map((entry) => [entry.subjectId, entry.teacherId ?? null])
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

  function isTeacherBusy(subjectId, dayNumber, period) {
    const teacherId = teacherIdBySubjectId.get(subjectId)
    if (!teacherId) return false
    const busySlots = busySlotsByTeacherId.get(teacherId)
    if (!busySlots) return false
    return busySlots.some(
      (slot) => slot.day_of_week === dayNumber && periodsOverlap(slot.start, slot.end, period.start, period.end)
    )
  }

  let teacherConflictsAvoided = 0

  for (const [dayIndex, day] of days.entries()) {
    const dayNumber = dayIndex + 1
    const subjectsUsedToday = new Set()
    for (let period = 0; period < periods.length; period++) {
      const currentPeriod = periods[period]

      let candidates = [...remainingHoursBySubjectId.entries()].filter(
        ([subjectId, hours]) =>
          hours > 0 && !subjectsUsedToday.has(subjectId) && !isTeacherBusy(subjectId, dayNumber, currentPeriod)
      )
      if (candidates.length === 0) {
        // Plus aucune matière "fraîche" pour ce jour : on autorise une répétition
        // plutôt que de laisser un trou, si des heures restent à placer.
        candidates = [...remainingHoursBySubjectId.entries()].filter(
          ([subjectId, hours]) => hours > 0 && !isTeacherBusy(subjectId, dayNumber, currentPeriod)
        )
      }
      if (candidates.length === 0) {
        // Rien de plaçable sur CE créneau précis (matières restantes toutes
        // bloquées par leur enseignant) : on continue vers le créneau
        // suivant plutôt que d'abandonner le reste de la journée, un
        // enseignant occupé à 10h peut très bien être libre à 14h.
        if ([...remainingHoursBySubjectId.values()].some((hours) => hours > 0)) {
          teacherConflictsAvoided += 1
        }
        continue
      }

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

  if (unplacedHoursBySubject.length > 0 && teacherConflictsAvoided > 0) {
    warnings.push(
      "Certaines heures n'ont pas pu être placées car l'enseignant concerné est déjà en cours dans une autre classe sur tous les créneaux restants disponibles."
    )
  }

  return { grid, periods, warnings, unplacedHoursBySubject }
}
