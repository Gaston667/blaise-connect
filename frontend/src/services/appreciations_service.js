import { apiRequestJson } from '../utils/apiErrorHandler.js'

/** Client HTTP des appréciations de période. */

export function getAppreciationContexts() {
  return apiRequestJson('/api/appreciations/contexts', {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les contextes d’appréciation.',
  })
}

export function getSubjectAppreciations(classSubjectId, reportingPeriodId) {
  const query = new URLSearchParams({
    class_subject_id: classSubjectId,
    reporting_period_id: reportingPeriodId,
  })
  return apiRequestJson(`/api/appreciations/subject?${query.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les appréciations par matière.',
  })
}

export function saveSubjectAppreciation(studentEnrollmentId, payload) {
  return apiRequestJson(`/api/appreciations/subject/${studentEnrollmentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Impossible d’enregistrer l’appréciation.',
  })
}

export function getOverallAppreciations(classId, reportingPeriodId) {
  const query = new URLSearchParams({
    class_id: classId,
    reporting_period_id: reportingPeriodId,
  })
  return apiRequestJson(`/api/appreciations/overall?${query.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les appréciations générales.',
  })
}

export function saveOverallAppreciation(studentEnrollmentId, payload) {
  return apiRequestJson(`/api/appreciations/overall/${studentEnrollmentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Impossible d’enregistrer l’appréciation générale.',
  })
}
