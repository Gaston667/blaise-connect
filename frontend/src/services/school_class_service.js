/** Client HTTP à implémenter pour les classes de l'US-004. */

export const SCHOOL_CLASSES_API_URL = '/api/school-classes'

async function getSchoolClassesApiErrorMessage(response) {
  try {
    const errorData = await response.json()
    if (typeof errorData.detail === 'string') {
      return errorData.detail
    }
    return 'La requête sur les classes a échoué.'
  } catch {
    return 'Le serveur ne répond pas correctement.'
  }
}

export async function getSchoolClasses() {
  const response = await fetch(SCHOOL_CLASSES_API_URL, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(await getSchoolClassesApiErrorMessage(response))
  }

  return response.json()
}