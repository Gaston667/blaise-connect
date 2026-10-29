import { apiRequestJson, parseApiError } from '../utils/apiErrorHandler.js'

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

/** Dossier administratif d'un enfant (identité, scolarité). */
export function getChildRecord(childId) {
  return apiRequestJson(`/api/guardian/children/${childId}/record`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger le dossier de votre enfant.',
  })
}

/** Documents du dossier d'un enfant (acte de naissance, certificats...). */
export function getChildDocuments(childId) {
  return apiRequestJson(`/api/guardian/children/${childId}/documents`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les documents de votre enfant.',
  })
}

/** Récupère le fichier d'un document de l'enfant sous forme de blob. */
export async function getChildDocumentFile(childId, documentId) {
  const response = await fetch(`/api/guardian/children/${childId}/documents/${documentId}/content`, {
    method: 'GET',
    credentials: 'include',
  })
  if (!response.ok) throw await parseApiError(response, 'Impossible de récupérer le document.')
  return response.blob()
}
