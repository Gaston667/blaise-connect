import { apiRequestJson } from '../utils/apiErrorHandler.js'

/** Emploi du temps de l'enseignant connecté, toutes classes confondues. */
export function getMyTeacherTimetable() {
  return apiRequestJson('/api/teachers/me/timetable', {
    method: 'GET',
    fallbackMessage: "Échec du chargement de l'emploi du temps",
  })
}
