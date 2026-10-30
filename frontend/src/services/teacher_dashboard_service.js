import { apiRequestJson } from '../utils/apiErrorHandler.js'

/** Résumé de la journée de l'enseignant connecté. */
export function getTeacherDashboard() {
  return apiRequestJson('/api/teachers/me/dashboard', {
    method: 'GET',
    fallbackMessage: 'Impossible de charger votre tableau de bord.',
  })
}
