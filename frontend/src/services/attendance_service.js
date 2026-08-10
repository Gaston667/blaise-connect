import { apiRequestJson, parseApiError } from '../utils/apiErrorHandler.js'

const ATTENDANCE_API_URL = '/api/attendance'

function buildQuery(parameters = {}) {
  const query = new URLSearchParams()
  Object.entries(parameters).forEach(function addParameter([key, value]) {
    if (value !== '' && value !== null && value !== undefined) query.set(key, value)
  })
  const suffix = query.toString()
  return suffix ? `?${suffix}` : ''
}

export function getAttendanceOptions() {
  return apiRequestJson(`${ATTENDANCE_API_URL}/options`)
}

export function getAttendanceRoster(assignmentId, attendanceDate) {
  return apiRequestJson(
    `${ATTENDANCE_API_URL}/roster${buildQuery({
      assignment_id: assignmentId,
      attendance_date: attendanceDate,
    })}`,
  )
}

export function createAttendanceEvent(eventData) {
  return apiRequestJson(`${ATTENDANCE_API_URL}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData),
    fallbackMessage: "Impossible d'enregistrer l'appel.",
  })
}

export function getAttendanceEvents(filters = {}) {
  return apiRequestJson(`${ATTENDANCE_API_URL}/events${buildQuery(filters)}`)
}

export function getAttendanceRecords(filters = {}) {
  return apiRequestJson(`${ATTENDANCE_API_URL}/records${buildQuery(filters)}`)
}

export function getAttendanceRecordDetail(recordId) {
  return apiRequestJson(`${ATTENDANCE_API_URL}/records/${recordId}/detail`)
}

export function updateAttendanceRecord(recordId, data) {
  return apiRequestJson(`${ATTENDANCE_API_URL}/records/${recordId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteAttendanceRecord(recordId, changeReason) {
  return apiRequestJson(`${ATTENDANCE_API_URL}/records/${recordId}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ change_reason: changeReason }),
  })
}

export function getAttendanceDocuments(recordId) {
  return apiRequestJson(`${ATTENDANCE_API_URL}/records/${recordId}/documents`)
}

export function createAttendanceChangeRequest(recordId, data) {
  return apiRequestJson(
    `${ATTENDANCE_API_URL}/records/${recordId}/change-requests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  )
}

export function getAttendanceChangeRequests(status = '') {
  return apiRequestJson(
    `${ATTENDANCE_API_URL}/change-requests${buildQuery({ status })}`,
  )
}

export function reviewAttendanceChangeRequest(requestId, data) {
  return apiRequestJson(`${ATTENDANCE_API_URL}/change-requests/${requestId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function reviewAttendanceJustification(recordId, data) {
  return apiRequestJson(
    `${ATTENDANCE_API_URL}/records/${recordId}/justification`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  )
}

export function getMyAttendance() {
  return apiRequestJson(`${ATTENDANCE_API_URL}/me`)
}

export function uploadMyAttendanceJustification(recordId, reason, file) {
  const body = new FormData()
  body.append('reason', reason)
  if (file) body.append('document', file)
  return apiRequestJson(
    `${ATTENDANCE_API_URL}/me/${recordId}/justification`,
    { method: 'POST', body },
  )
}

export async function getAttendanceDocumentFile(recordId, documentId) {
  const response = await fetch(
    `${ATTENDANCE_API_URL}/records/${recordId}/documents/${documentId}/content`,
    { credentials: 'include' },
  )
  if (!response.ok) {
    throw await parseApiError(response, 'Impossible de recuperer le justificatif.')
  }
  return response.blob()
}
