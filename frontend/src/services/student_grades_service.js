import { apiRequestJson } from '../utils/apiErrorHandler.js'

/** Profil résumé (nom, classe) de l'élève connecté. */
export function getMyProfile() {
  return apiRequestJson('/api/students/me', {
    method: 'GET',
    fallbackMessage: 'Échec du chargement du profil',
  })
}

/** Notes de l'élève connecté. */
export function getMyGrades() {
  return apiRequestJson('/api/students/me/grades', {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des notes',
  })
}

/** Moyenne générale, moyennes par matière et évaluations à venir de l'élève connecté. */
export function getMyGradesSummary() {
  return apiRequestJson('/api/students/me/grades/summary', {
    method: 'GET',
    fallbackMessage: 'Échec du chargement de la synthèse',
  })
}

/** Détail privé d'une évaluation appartenant à l'élève connecté. */
export function getMyAssessmentDetail(assessmentId) {
  return apiRequestJson(`/api/students/me/grades/assessments/${assessmentId}`, {
    method: 'GET',
    fallbackMessage: "Impossible de charger le détail de cette évaluation.",
  })
}
