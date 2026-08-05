import { apiRequestJson } from '../utils/apiErrorHandler.js'

/** Salles actives. */
export function getRooms() {
  return apiRequestJson('/api/rooms', {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des salles',
  })
}

/** Crée une salle. */
export function createRoom(payload) {
  return apiRequestJson('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Échec de la création de la salle',
  })
}

/** Emploi du temps réel d'une classe (créneaux enregistrés en base). */
export function getClassTimetable(classId) {
  return apiRequestJson(`/api/school-classes/${classId}/timetable`, {
    method: 'GET',
    fallbackMessage: "Échec du chargement de l'emploi du temps",
  })
}

/** Ajoute un créneau régulier à l'emploi du temps d'une classe. */
export function createTimetableSlot(classId, payload) {
  return apiRequestJson(`/api/school-classes/${classId}/timetable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Échec de la création du créneau',
  })
}

/** Supprime tous les créneaux existants d'une classe (avant régénération). */
export function clearClassTimetable(classId) {
  return apiRequestJson(`/api/school-classes/${classId}/timetable`, {
    method: 'DELETE',
    fallbackMessage: "Échec de la suppression de l'emploi du temps",
  })
}

/** Cours particuliers des élèves de la classe. */
export function getClassSpecialCourses(classId) {
  return apiRequestJson(`/api/school-classes/${classId}/special-courses`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des cours particuliers',
  })
}

/** Ajoute un cours particulier pour un élève (17h30-19h00 uniquement). */
export function createSpecialCourse(classId, payload) {
  return apiRequestJson(`/api/school-classes/${classId}/special-courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Échec de la création du cours particulier',
  })
}

/** Supprime un cours particulier. */
export function deleteSpecialCourse(specialCourseId) {
  return apiRequestJson(`/api/special-courses/${specialCourseId}`, {
    method: 'DELETE',
    fallbackMessage: 'Échec de la suppression du cours particulier',
  })
}
