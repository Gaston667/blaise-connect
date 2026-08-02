import { apiRequestJson } from '../utils/apiErrorHandler.js'

export function getTeachersOverview(q) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  return apiRequestJson(`/api/teachers/overview?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des enseignants',
  })
}

/**
 * Charge un enseignant depuis la vue de gestion afin que son URL reste
 * consultable après une actualisation du navigateur.
 */
export async function getTeacherOverview(teacherId) {
  const teachers = await getTeachersOverview()
  const teacher = teachers.find((item) => item.id === teacherId)
  if (!teacher) throw new Error('Enseignant introuvable.')
  return teacher
}
