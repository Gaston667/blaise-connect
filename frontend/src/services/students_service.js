import { apiRequest, apiRequestJson, parseApiError } from '../utils/apiErrorHandler.js'

export const STUDENTS_API_URL = '/api/students/'

export function listStudents({
  q = null,
  status = null,
  class_id = null,
  school_year_id = null,
  limit = 50,
  offset = 0,
} = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (status) params.append('status', status)
  if (class_id) params.append('class_id', class_id)
  if (school_year_id) params.append('school_year_id', school_year_id)
  params.append('limit', String(limit))
  params.append('offset', String(offset))

  return apiRequestJson(`${STUDENTS_API_URL}?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Failed to fetch students',
  })
}

export function getStudent(id) {
  return apiRequestJson(`${STUDENTS_API_URL}${id}`, {
    method: 'GET',
    fallbackMessage: 'Failed to fetch student',
  })
}

export function getStudentAcademicSummary(id) {
  return apiRequestJson(`${STUDENTS_API_URL}${id}/academic-summary`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les résultats scolaires.',
  })
}

export function enrollStudent(studentId, enrollmentData) {
  return apiRequestJson(`${STUDENTS_API_URL}${studentId}/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enrollmentData),
    fallbackMessage: 'Impossible d’inscrire cet élève dans la classe.',
  })
}

export function unenrollStudent(studentId) {
  return apiRequestJson(`${STUDENTS_API_URL}${studentId}/unenroll`, {
    method: 'POST',
    fallbackMessage: 'Impossible de désinscrire cet élève de sa classe.',
  })
}

export function updateStudent(id, payload) {
  return apiRequestJson(`${STUDENTS_API_URL}${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    fallbackMessage: 'Échec de la mise à jour',
  })
}

function postAction(id, action) {
  return apiRequestJson(`${STUDENTS_API_URL}${id}/${action}`, {
    method: 'POST',
    fallbackMessage: `Échec de l'action "${action}"`,
  })
}

export const archiveStudent = (id) => postAction(id, 'archive')
export const deactivateStudent = (id) => postAction(id, 'deactivate')
export const reactivateStudent = (id) => postAction(id, 'reactivate')

export function getStudentStatusHistory(id) {
  return apiRequestJson(`${STUDENTS_API_URL}${id}/status-history`, {
    method: 'GET',
    fallbackMessage: "Échec du chargement de l'historique",
  })
}

export function getStudentDocuments(studentId) {
  return apiRequestJson(`${STUDENTS_API_URL}${studentId}/documents`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les documents de cet élève.',
  })
}

export function uploadStudentDocument(studentId, documentData) {
  const body = new FormData()
  body.append('title', documentData.title)
  body.append('document_type_code', documentData.documentTypeCode)
  body.append('document', documentData.file)

  return apiRequestJson(`${STUDENTS_API_URL}${studentId}/documents`, {
    method: 'POST',
    body,
    fallbackMessage: 'Impossible de téléverser le document.',
  })
}

export function archiveStudentDocument(studentId, documentId) {
  return apiRequest(
    `${STUDENTS_API_URL}${studentId}/documents/${documentId}/archive`,
    {
      method: 'POST',
      fallbackMessage: "Impossible d'archiver le document.",
    },
  )
}

export async function getStudentDocumentFile(studentId, documentId) {
  const response = await fetch(
    `${STUDENTS_API_URL}${studentId}/documents/${documentId}/content`,
    {
      method: 'GET',
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw await parseApiError(
      response,
      'Impossible de récupérer le document.',
    )
  }

  const blob = await response.blob()

  let filename = 'document'

  const contentDisposition = response.headers.get('content-disposition')

  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/i)

    if (match?.[1]) {
      filename = match[1]
    }
  }

  return {
    blob,
    filename,
  }
}


/**
 * Retourne les spécialités actuellement choisies
 * pour l'inscription active de l'élève.
 */
export function getStudentSpecialties(studentId) {
  return apiRequestJson(
    `${STUDENTS_API_URL}${studentId}/specialties`,
    {
      method: 'GET',
      fallbackMessage:
        'Impossible de charger les spécialités de cet élève.',
    },
  )
}


/**
 * Retourne les spécialités disponibles
 * dans la classe actuelle de l'élève.
 */
export function getAvailableStudentSpecialties(studentId) {
  return apiRequestJson(
    `${STUDENTS_API_URL}${studentId}/available-specialties`,
    {
      method: 'GET',
      fallbackMessage:
        'Impossible de charger les spécialités disponibles.',
    },
  )
}


/**
 * Remplace complètement les spécialités
 * de l'inscription actuelle de l'élève.
 */
export function updateStudentSpecialties(studentId, subjectIds) {
  return apiRequestJson(
    `${STUDENTS_API_URL}${studentId}/specialties`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject_ids: subjectIds,
      }),
      fallbackMessage:
        'Impossible d’enregistrer les spécialités de cet élève.',
    },
  )
}
