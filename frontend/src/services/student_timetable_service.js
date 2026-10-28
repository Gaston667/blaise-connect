import { apiRequestJson } from '../utils/apiErrorHandler.js'
import { studentApiPath } from '../utils/student_scope.js'

/** Emploi du temps (créneaux + pauses) de la classe active de l'élève (ou de l'enfant). */
export function getMyTimetable(childId) {
  return apiRequestJson(studentApiPath(childId, '/timetable'), {
    method: 'GET',
    fallbackMessage: "Échec du chargement de l'emploi du temps",
  })
}
