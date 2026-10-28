import { apiRequestJson } from '../utils/apiErrorHandler.js'

/** Enfants rattachés au responsable légal connecté. */
export function getGuardianChildren() {
  return apiRequestJson('/api/guardian/children', {
    method: 'GET',
    fallbackMessage: 'Impossible de charger vos enfants.',
  })
}

/** Bulletins validés d'un enfant. */
export function getChildReportCards(childId) {
  return apiRequestJson(`/api/guardian/children/${childId}/report-cards`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les bulletins.',
  })
}
