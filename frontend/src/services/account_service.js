const ACCOUNTS_API_URL = '/api/accounts'

/** Extrait un message lisible d'une erreur FastAPI. */
async function getAccountsApiErrorMessage(response) {
  try {
    const errorData = await response.json()
    if (typeof errorData.detail === 'string') {
      return errorData.detail
    }
    return 'La requête sur les comptes a échoué.'
  } catch {
    return 'Le serveur ne répond pas correctement.'
  }
}

/** Récupère les comptes visibles par l'administrateur connecté. */
export async function getAccounts() {
  const response = await fetch(ACCOUNTS_API_URL, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    const errorMessage = await getAccountsApiErrorMessage(response)
    throw new Error(errorMessage)
  }

  return response.json()
}
