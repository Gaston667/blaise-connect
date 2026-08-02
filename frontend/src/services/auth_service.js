/**
 * Client HTTP de l'authentification côté React.
 * Il regroupera login, logout et get_current_user.
 */

import { apiRequestJson } from '../utils/apiErrorHandler.js'

const AUTH_API_URL = '/api/auth'


export async function login(registrationNumber, password) {
  return apiRequestJson(`${AUTH_API_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registration_number: registrationNumber,
      password: password,
    }),
    fallbackMessage: 'Impossible de se connecter.',
  })
}

export async function getCurrentAccount() {
  return apiRequestJson(`${AUTH_API_URL}/me`, {
    method: 'GET',
    fallbackMessage: 'Impossible de récupérer le compte connecté.',
  })
}


export async function logout() {
  await apiRequestJson(`${AUTH_API_URL}/logout`, {
    method: 'POST',
    expectJson: false,
    fallbackMessage: 'Impossible de se déconnecter.',
  })
}
