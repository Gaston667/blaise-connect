import { apiRequestJson } from '../utils/apiErrorHandler.js'

export function getTeachersOverview(q) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  return apiRequestJson(`/api/teachers/overview?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des enseignants',
  })
}

/**
 * Charge un enseignant depuis la vue de gestion afin que son URL reste
 * consultable après une actualisation du navigateur.
 */
export async function getTeacherOverview(teacherId) {
  const teachers = await getTeachersOverview()
  const teacher = teachers.find((item) => item.id === teacherId)
  if (!teacher) throw new Error('Enseignant introuvable.')
  return teacher
}

export function getTeacherDetail(teacherId) {
  return apiRequestJson(`/api/teachers/${teacherId}/detail`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement du dossier enseignant.',
  })
}

export function updateTeacherProfile(teacherId, payload) {
  return apiRequestJson(`/api/teachers/${teacherId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Échec de la mise à jour du profil enseignant.',
  })
}

export function getAvailableTeacherAssignments(teacherId) {
  return apiRequestJson(`/api/teachers/${teacherId}/available-assignments`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des matières disponibles.',
  })
}

export function createTeacherAssignment(teacherId, payload) {
  return apiRequestJson(`/api/teachers/${teacherId}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Échec de l’affectation de la matière.',
  })
}

export function endTeacherAssignment(teacherId, assignmentId, endDate) {
  return apiRequestJson(`/api/teachers/${teacherId}/assignments/${assignmentId}/end`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ end_date: endDate }),
    fallbackMessage: 'Échec de la désaffectation de la matière.',
  })
}
