import { apiRequestJson } from '../utils/apiErrorHandler.js'

export const STUDENTS_API_URL = '/api/students/'

export function listStudents({ q = null, status = null, class_id = null, school_year_id = null, limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (status) params.append('status', status)
  if (class_id) params.append('class_id', class_id)
  if (school_year_id) params.append('school_year_id', school_year_id)
  params.append('limit', String(limit))
  params.append('offset', String(offset))

  return apiRequestJson(`${STUDENTS_API_URL}?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Failed to fetch students',
  })
}

export function getStudent(id) {
  return apiRequestJson(`${STUDENTS_API_URL}${id}`, {
    method: 'GET',
    fallbackMessage: 'Failed to fetch student',
  })
}

export function getStudentAcademicSummary(id) {
  return apiRequestJson(`${STUDENTS_API_URL}${id}/academic-summary`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les résultats scolaires.',
  })
}

export function enrollStudent(studentId, enrollmentData) {
  return apiRequestJson(`${STUDENTS_API_URL}${studentId}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enrollmentData),
    fallbackMessage: 'Impossible d’inscrire cet élève dans la classe.',
  })
}

export function updateStudent(id, payload) {
  return apiRequestJson(`${STUDENTS_API_URL}${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Échec de la mise à jour',
  })
}

function postAction(id, action) {
  return apiRequestJson(`${STUDENTS_API_URL}${id}/${action}`, {
    method: 'POST',
    fallbackMessage: `Échec de l'action "${action}"`,
  })
}

export const archiveStudent = (id) => postAction(id, 'archive')
export const deactivateStudent = (id) => postAction(id, 'deactivate')
export const reactivateStudent = (id) => postAction(id, 'reactivate')

export function getStudentStatusHistory(id) {
  return apiRequestJson(`${STUDENTS_API_URL}${id}/status-history`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement de l\'historique',
  })
}
