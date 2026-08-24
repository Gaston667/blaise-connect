import { apiRequestJson } from '../utils/apiErrorHandler.js'

/** Indicateurs agrégés du tableau de bord administrateur. */
export function getAdminDashboard() {
  return apiRequestJson('/api/admin-dashboard', {
    method: 'GET',
    fallbackMessage: 'Échec du chargement du tableau de bord',
  })
}
