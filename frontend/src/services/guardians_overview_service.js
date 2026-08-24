import { apiRequestJson } from '../utils/apiErrorHandler.js'

export function getGuardiansOverview(q) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  return apiRequestJson(`/api/guardians?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des responsables',
  })
}

export function getGuardianDetail(id) {
  return apiRequestJson(`/api/guardians/${id}/detail`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement du responsable',
  })
}