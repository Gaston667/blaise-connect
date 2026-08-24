import { apiRequest, apiRequestJson } from '../utils/apiErrorHandler.js'

export function getClassLevels() {
  return apiRequestJson('/api/class-levels', {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des niveaux',
  })
}

export function getTeachers() {
  return apiRequestJson('/api/teachers/overview', {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des enseignants',
  })
}

export function getSchoolClassesOverview({ q, schoolYearId, classLevelId, status, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (schoolYearId) params.append('school_year_id', schoolYearId)
  if (classLevelId) params.append('class_level_id', classLevelId)
  if (status) params.append('status', status)
  params.append('limit', String(limit))
  params.append('offset', String(offset))

  return apiRequestJson(`/api/school-classes/overview?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des classes',
  })
}

export function getSchoolClassDetail(id) {
  return apiRequestJson(`/api/school-classes/${id}/detail`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement de la classe',
  })
}

export function createSchoolClass(payload) {
  return apiRequestJson('/api/school-classes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Échec de la création de la classe',
  })
}

export function updateSchoolClass(id, payload) {
  return apiRequestJson(`/api/school-classes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Échec de la mise à jour',
  })
}

export function deleteSchoolClass(id) {
  return apiRequest(`/api/school-classes/${id}`, {
    method: 'DELETE',
    expectJson: false,
    fallbackMessage: 'Échec de la suppression',
  })
}

export function getSchoolClassSubjects(id, { q = '', isActive = '' } = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (isActive !== '') params.append('is_active', isActive)

  return apiRequestJson(`/api/school-classes/${id}/subjects?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des matières',
  })
}

export function getAvailableSubjectsForClass(classId) {
  return apiRequestJson(`/api/school-classes/${classId}/available-subjects`, {
    method: 'GET',
    fallbackMessage: 'Échec du chargement des matières disponibles',
  })
}

export function addClassSubject(classId, subjectId, coefficient) {
  return apiRequestJson(`/api/school-classes/${classId}/subjects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject_id: subjectId, coefficient: Number(coefficient) }),
    fallbackMessage: 'Échec de l\'ajout de la matière',
  })
}

export function updateClassSubjectCoefficient(classId, classSubjectId, coefficient) {
  return apiRequestJson(`/api/school-classes/${classId}/subjects/${classSubjectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coefficient: Number(coefficient) }),
    fallbackMessage: 'Échec de la modification du coefficient',
  })
}

export function removeClassSubject(classId, classSubjectId) {
  return apiRequest(`/api/school-classes/${classId}/subjects/${classSubjectId}`, {
    method: 'DELETE',
    expectJson: false,
    fallbackMessage: 'Échec du retrait de la matière',
  })
}
