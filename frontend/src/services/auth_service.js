/**
 * Client HTTP de l'authentification côté React.
 * Il regroupera login, logout et get_current_user.
 */

const AUTH_API_URL = '/api/auth'

async function getApiErrorMessage(response){
    /**
     * Récupère le message d'erreur retourné par FastAPI.
     */

    try{
        const errorData = await response.json()
        return errorData.detail || 'Une erreur est survenue.'
    } catch {
    return 'Le serveur ne répond pas correctement.'
  }
}


export async function login(registrationNumber, password) {
  /**
   * Connecte un utilisateur avec son matricule et son mot de passe.
   */

  const response = await fetch(`${AUTH_API_URL}/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registration_number: registrationNumber,
      password: password,
    }),
  })

  if (!response.ok) {
    const errorMessage = await getApiErrorMessage(response)
    throw new Error(errorMessage)
  }

  return response.json()
}

export async function getCurrentAccount() {
  /**
   * Récupère le compte associé à la session actuelle.
   */

  const response = await fetch(`${AUTH_API_URL}/me`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    const errorMessage = await getApiErrorMessage(response)
    throw new Error(errorMessage)
  }

  return response.json()
}


export async function logout() {
  /**
   * Ferme la session actuelle et supprime le cookie.
   */

  const response = await fetch(`${AUTH_API_URL}/logout`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    const errorMessage = await getApiErrorMessage(response)
    throw new Error(errorMessage)
  }
}
