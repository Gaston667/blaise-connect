import { apiRequest, apiRequestJson } from '../utils/apiErrorHandler.js'

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

/** Créneaux déjà occupés par chaque enseignant, hors de la classe donnée. */
export function getTeacherBusySlots(excludeClassId) {
  const params = excludeClassId ? `?exclude_class_id=${excludeClassId}` : ''
  return apiRequestJson(`/api/teacher-busy-slots${params}`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des disponibilités des enseignants',
  })
}

/** Horaires, pauses et volumes horaires applicables à une classe. */
export function getTimetableConfiguration(classId) {
  return apiRequestJson(`/api/school-classes/${classId}/timetable/configuration`, {
    method: 'GET',
    fallbackMessage: "Échec du chargement de la configuration de l'emploi du temps",
  })
}

/** Horaires et pauses configurés pour une année scolaire. */
export function getSchoolDaySchedules(schoolYearId) {
  return apiRequestJson(`/api/school-years/${schoolYearId}/day-schedules`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des horaires',
  })
}

/** Enregistre l'horaire d'un jour pour un cycle. */
export function saveSchoolDaySchedule(schoolYearId, payload) {
  return apiRequestJson(`/api/school-years/${schoolYearId}/day-schedules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: "Échec de l'enregistrement des horaires",
  })
}

/** Ajoute une pause à l'horaire sélectionné. */
export function createBreakSchedule(payload) {
  return apiRequestJson('/api/break-schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: "Échec de l'ajout de la pause",
  })
}

/** Retire une pause de la configuration. */
export function deleteBreakSchedule(breakId) {
  return apiRequestJson(`/api/break-schedules/${breakId}`, {
    method: 'DELETE',
    fallbackMessage: 'Échec de la suppression de la pause',
  })
}

/** Demande au backend de créer un brouillon de planning. */
export function generateTimetable(classId, requirements) {
  return apiRequestJson(`/api/school-classes/${classId}/timetable/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requirements }),
    fallbackMessage: "Échec de la génération de l'emploi du temps",
  })
}

/** Publie le brouillon courant après contrôle de l'administrateur. */
export function validateTimetable(classId) {
  return apiRequestJson(`/api/school-classes/${classId}/timetable/validate`, {
    method: 'POST',
    fallbackMessage: "Échec de la validation de l'emploi du temps",
  })
}

/** Emploi du temps réel d'une classe (créneaux enregistrés en base). */
/** Signale, sans publier, les conflits du brouillon avec une autre classe déjà publiée. */
export function getDraftConflicts(classId) {
  return apiRequestJson(`/api/school-classes/${classId}/timetable/conflicts`, {
    method: 'GET',
    fallbackMessage: 'Échec de la vérification des conflits',
  })
}

/** Emploi du temps de la classe. Brouillon prioritaire par défaut, ou
 * uniquement le planning publié (celui vu par les élèves/enseignants). */
export function getClassTimetable(classId, { publishedOnly = false } = {}) {
  const suffix = publishedOnly ? '?published_only=true' : ''
  return apiRequestJson(`/api/school-classes/${classId}/timetable${suffix}`, {
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

/** Supprime un créneau précis appartenant au brouillon courant. */
export function deleteTimetableSlot(slotId) {
  return apiRequest(`/api/timetable-slots/${slotId}`, {
    method: 'DELETE',
    expectJson: false,
    fallbackMessage: 'Échec de la suppression du créneau',
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

/** Ajoute un cours particulier pour un élève. */
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
