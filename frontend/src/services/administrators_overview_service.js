import { apiRequestJson } from '../utils/apiErrorHandler.js'

export function getAdministratorsOverview(q) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  return apiRequestJson(`/api/administrators/overview?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des administrateurs',
  })
}

/**
 * Charge un administrateur depuis la vue de gestion afin que son URL reste
 * consultable après une actualisation du navigateur.
 */
export async function getAdministratorOverview(administratorId) {
  const administrators = await getAdministratorsOverview()
  const administrator = administrators.find((item) => item.id === administratorId)
  if (!administrator) throw new Error('Administrateur introuvable.')
  return administrator
}

/** Modifie les coordonnées et le rôle d'un administrateur. */
export function updateAdministrator(administratorId, payload) {
  return apiRequestJson(`/api/administrators/${administratorId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Échec de la mise à jour de l’administrateur',
  })
}
