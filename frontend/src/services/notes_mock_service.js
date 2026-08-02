/**
 * Service simulé pour l'écran "Gestion des notes".
 *
 * Aucune table "assessments"/"grades" n'existe encore côté backend
 * (documentées dans AGENTS.md 5.16-5.17, jamais créées). Ce module garde
 * les notes ajoutées en mémoire, côté navigateur uniquement, pour valider
 * l'écran avant de brancher un vrai backend. Rien n'est persisté au
 * rechargement de la page.
 */

export const MOCK_PERIODS = [
  { id: 'p1', name: '1er trimestre' },
  { id: 'p2', name: '2e trimestre' },
  { id: 'p3', name: '3e trimestre' },
]

let mockGrades = []
let nextMockId = 1

export function listMockGrades({ classId, subjectId, periodId, q } = {}) {
  const needle = (q ?? '').trim().toLowerCase()
  return mockGrades.filter((grade) => {
    if (classId && grade.class_id !== classId) return false
    if (subjectId && grade.subject_id !== subjectId) return false
    if (periodId && grade.period_id !== periodId) return false
    if (needle && !grade.student_name.toLowerCase().includes(needle)) return false
    return true
  })
}

export function addMockGrade(payload) {
  const grade = { id: `mock-${nextMockId++}`, ...payload }
  mockGrades = [grade, ...mockGrades]
  return grade
}

export function removeMockGrade(id) {
  mockGrades = mockGrades.filter((grade) => grade.id !== id)
}
