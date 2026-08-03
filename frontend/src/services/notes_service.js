import { apiRequestJson } from '../utils/apiErrorHandler.js'

/** Client HTTP des évaluations disponibles et des notes persistées. */

export function listGrades({ q, classId, subjectId, periodId } = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (classId) params.append('class_id', classId)
  if (subjectId) params.append('subject_id', subjectId)
  if (periodId) params.append('reporting_period_id', periodId)

  return apiRequestJson(`/api/grades?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les notes.',
  })
}

export function getGradeOptions({ classId, subjectId, assessmentId } = {}) {
  const params = new URLSearchParams()
  if (classId) params.append('class_id', classId)
  if (subjectId) params.append('subject_id', subjectId)
  if (assessmentId) params.append('assessment_id', assessmentId)

  return apiRequestJson(`/api/grades/options?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les choix de saisie.',
  })
}

export function createGrade(payload) {
  return apiRequestJson('/api/grades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Impossible d’enregistrer la note.',
  })
}
