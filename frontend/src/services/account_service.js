import { apiRequest, apiRequestJson } from '../utils/apiErrorHandler.js'

const ACCOUNTS_API_URL = '/api/accounts'

/** Récupère les comptes visibles par l'administrateur connecté. */
export async function getAccounts() {
  return apiRequestJson(ACCOUNTS_API_URL, {
    method: 'GET',
    fallbackMessage: 'La requête sur les comptes a échoué.',
  })
}

/** Récupère un compte par son identifiant. */
export async function getAccount(accountId) {
  return apiRequestJson(`${ACCOUNTS_API_URL}/${accountId}`, {
    method: 'GET',
    fallbackMessage: 'La requête sur les comptes a échoué.',
  })
}


/**
 * Envoie au backend les informations du nouveau compte.
 *
 * @param {object} account_data Informations saisies dans le formulaire.
 * @returns {Promise<object>} Compte créé par le backend.
 */
export async function createAccount(account_data) {
  return apiRequestJson('/api/accounts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(account_data),
    fallbackMessage: 'Impossible de créer le compte.',
  })
}

/** Téléverse la photo du profil créé et retourne le compte actualisé. */
export async function uploadAccountPhoto(accountId, photo) {
  const formData = new FormData()
  formData.append('photo', photo)
  return apiRequest(`/api/accounts/${accountId}/photo`, {
    method: 'POST',
    body: formData,
    fallbackMessage: 'Impossible d’envoyer la photo du compte.',
  })
}

/** Modifie l'état d'un compte et retourne sa version actualisée. */
export async function changeAccountState(accountId, action) {
  return apiRequestJson(`/api/accounts/${accountId}/${action}`, {
    method: 'POST',
    fallbackMessage: 'Impossible de modifier l’état du compte.',
  })
}

/** Réinitialise le mot de passe après confirmation de l'administrateur. */
export async function resetAccountPassword(accountId, newPassword, adminPassword) {
  return apiRequestJson(`/api/accounts/${accountId}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      new_password: newPassword,
      admin_password: adminPassword,
    }),
    fallbackMessage: 'Impossible de réinitialiser le mot de passe.',
  })
}
