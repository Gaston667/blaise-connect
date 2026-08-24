import { apiRequestJson } from '../utils/apiErrorHandler.js'

/** Appels HTTP liés aux responsables légaux. */

export function getGuardianDetail(id) {
  return apiRequestJson(`/api/guardians/${id}/detail`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger ce responsable.',
  })
}

export function updateGuardian(guardianId, payload) {
  return apiRequestJson(`/api/guardians/${guardianId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Impossible de mettre à jour ce responsable.',
  })
}

export function searchGuardians(query = '') {
  const parameters = new URLSearchParams()
  if (query.trim()) parameters.set('q', query.trim())
  return apiRequestJson(`/api/guardians?${parameters.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Impossible de rechercher les responsables.',
  })
}

export function linkGuardianToStudent(studentId, guardianId, linkData) {
  return apiRequestJson(`/api/students/${studentId}/guardians/${guardianId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(linkData),
    fallbackMessage: 'Impossible d’associer ce responsable.',
  })
}

export function unlinkGuardianFromStudent(studentId, guardianId) {
  return apiRequestJson(`/api/students/${studentId}/guardians/${guardianId}`, {
    method: 'DELETE',
    expectJson: false,
    fallbackMessage: 'Impossible de retirer ce responsable.',
  })
}
