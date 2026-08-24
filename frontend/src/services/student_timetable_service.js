import { apiRequestJson } from '../utils/apiErrorHandler.js'

/** Emploi du temps (créneaux + pauses) de la classe active de l'élève connecté. */
export function getMyTimetable() {
  return apiRequestJson('/api/students/me/timetable', {
    method: 'GET',
    fallbackMessage: "Échec du chargement de l'emploi du temps",
  })
}
