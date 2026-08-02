import { apiRequestJson } from '../utils/apiErrorHandler.js'

/** Client HTTP pour la gestion des matières. */

export async function getSubjectsOverview({ q, classId, teacherId, isActive } = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (classId) params.append('class_id', classId)
  if (teacherId) params.append('teacher_id', teacherId)
  if (isActive !== undefined && isActive !== '') params.append('is_active', isActive)

  return apiRequestJson(`/api/subjects/overview?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des matières',
  })
}

export async function createSubject(payload) {
  return apiRequestJson('/api/subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Échec de la création de la matière',
  })
}

export async function updateSubject(id, payload) {
  return apiRequestJson(`/api/subjects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Échec de la mise à jour de la matière',
  })
}
