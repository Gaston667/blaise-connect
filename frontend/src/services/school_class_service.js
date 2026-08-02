/** Client HTTP à implémenter pour les classes de l'US-004. */

export const SCHOOL_CLASSES_API_URL = '/api/school-classes'




import { apiRequestJson } from '../utils/apiErrorHandler.js'

export function getSchoolClasses() {
  return apiRequestJson(SCHOOL_CLASSES_API_URL, {
    method: 'GET',
    fallbackMessage: 'La requête sur les classes a échoué.',
  })
}