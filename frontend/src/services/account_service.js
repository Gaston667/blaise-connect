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

/** Récupère un compte par son identifiant. */
export async function getAccount(accountId) {
  const response = await fetch(`${ACCOUNTS_API_URL}/${accountId}`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    const errorMessage = await getAccountsApiErrorMessage(response)
    throw new Error(errorMessage)
  }

  return response.json()
}


/**
 * Envoie au backend les informations du nouveau compte.
 *
 * @param {object} account_data Informations saisies dans le formulaire.
 * @returns {Promise<object>} Compte créé par le backend.
 */
export async function createAccount(account_data) {
  const response = await fetch('/api/accounts', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(account_data),
  })

  if (!response.ok) {
    const error_data = await response.json().catch(function parseError() {
      return null
    })

    throw new Error(
      error_data?.detail || 'Impossible de créer le compte.',
    )
  }

  return response.json()
}

/** Téléverse la photo du profil créé et retourne le compte actualisé. */
export async function uploadAccountPhoto(accountId, photo) {
  const formData = new FormData()
  formData.append('photo', photo)
  const response = await fetch(`/api/accounts/${accountId}/photo`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!response.ok) {
    throw new Error(await getAccountsApiErrorMessage(response))
  }
  return response.json()
}

/** Modifie l'état d'un compte et retourne sa version actualisée. */
export async function changeAccountState(accountId, action) {
  const response = await fetch(`/api/accounts/${accountId}/${action}`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(await getAccountsApiErrorMessage(response))
  }
  return response.json()
}

/** Réinitialise le mot de passe après confirmation de l'administrateur. */
export async function resetAccountPassword(accountId, newPassword, adminPassword) {
  const response = await fetch(`/api/accounts/${accountId}/password`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      new_password: newPassword,
      admin_password: adminPassword,
    }),
  })
  if (!response.ok) {
    throw new Error(await getAccountsApiErrorMessage(response))
  }
  return response.json()
}
