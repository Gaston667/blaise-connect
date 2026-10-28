import { apiRequestJson } from '../utils/apiErrorHandler.js'
import { studentApiPath } from '../utils/student_scope.js'

// Chaque fonction accepte un `childId` facultatif : absent pour un élève
// (ses propres données), renseigné pour un responsable légal (son enfant).

/** Profil résumé (nom, classe) de l'élève. */
export function getMyProfile(childId) {
  return apiRequestJson(studentApiPath(childId), {
    method: 'GET',
    fallbackMessage: 'Échec du chargement du profil',
  })
}

/** Notes de l'élève. */
export function getMyGrades(childId) {
  return apiRequestJson(studentApiPath(childId, '/grades'), {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des notes',
  })
}

/** Moyenne générale, moyennes par matière et évaluations à venir de l'élève. */
export function getMyGradesSummary(childId) {
  return apiRequestJson(studentApiPath(childId, '/grades/summary'), {
    method: 'GET',
    fallbackMessage: 'Échec du chargement de la synthèse',
  })
}

/** Détail privé d'une évaluation appartenant à l'élève. */
export function getMyAssessmentDetail(assessmentId, childId) {
  return apiRequestJson(studentApiPath(childId, `/grades/assessments/${assessmentId}`), {
    method: 'GET',
    fallbackMessage: "Impossible de charger le détail de cette évaluation.",
  })
}
