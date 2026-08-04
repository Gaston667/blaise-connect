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

export function listAssessments({ q, classId, subjectId, periodId, teacherId } = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (classId) params.append('class_id', classId)
  if (subjectId) params.append('subject_id', subjectId)
  if (periodId) params.append('reporting_period_id', periodId)
  if (teacherId) params.append('teacher_id', teacherId)

  return apiRequestJson(`/api/assessments?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les évaluations.',
  })
}

export function getAssessmentsSummary({ q, classId, subjectId, periodId } = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (classId) params.append('class_id', classId)
  if (subjectId) params.append('subject_id', subjectId)
  if (periodId) params.append('reporting_period_id', periodId)

  return apiRequestJson(`/api/assessments/summary?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les indicateurs officiels.',
  })
}

export function listAssessmentAssignmentOptions({ classId } = {}) {
  const params = new URLSearchParams()
  if (classId) params.append('class_id', classId)
  return apiRequestJson(`/api/assessments/assignment-options?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les affectations pédagogiques.',
  })
}

export function createAssessment(payload) {
  return apiRequestJson('/api/assessments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Impossible de créer l’évaluation.',
  })
}

export function updateAssessment(assessmentId, payload) {
  return apiRequestJson(`/api/assessments/${assessmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Impossible de modifier l’évaluation.',
  })
}

export function getAssessmentGradeSheet(assessmentId) {
  return apiRequestJson(`/api/assessments/${assessmentId}/grade-sheet`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger la feuille de notes.',
  })
}

export function submitAssessmentGradeSheet(assessmentId, entries) {
  return apiRequestJson(`/api/assessments/${assessmentId}/grade-sheet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
    fallbackMessage: 'Impossible d’enregistrer la feuille de notes.',
  })
}

export function listGradeChangeRequests({ status, gradeId, assessmentId } = {}) {
  const params = new URLSearchParams()
  if (status) params.append('status', status)
  if (gradeId) params.append('grade_id', gradeId)
  if (assessmentId) params.append('assessment_id', assessmentId)
  return apiRequestJson(`/api/grade-change-requests?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les demandes de correction.',
  })
}

export function createGradeChangeRequest(payload) {
  return apiRequestJson('/api/grade-change-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Impossible de transmettre la demande de correction.',
  })
}

export function decideGradeChangeRequest(requestId, payload) {
  return apiRequestJson(`/api/grade-change-requests/${requestId}/decision`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Impossible d’enregistrer la décision.',
  })
}

export function reviewGradeAbsence(gradeId, justificationStatus) {
  return apiRequestJson(`/api/grades/${gradeId}/absence-review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ justification_status: justificationStatus }),
    fallbackMessage: 'Impossible de traiter le justificatif.',
  })
}

export function uploadGradeJustification(gradeId, file) {
  const body = new FormData()
  body.append('document', file)
  return apiRequestJson(`/api/grades/${gradeId}/documents`, {
    method: 'POST',
    body,
    fallbackMessage: 'Impossible de téléverser le justificatif.',
  })
}

export function getGradeDocuments(gradeId) {
  return apiRequestJson(`/api/grades/${gradeId}/documents`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les justificatifs.',
  })
}

export function getGradeDocumentDownloadUrl(gradeId, documentId) {
  return `/api/grades/${gradeId}/documents/${documentId}/content`
}
