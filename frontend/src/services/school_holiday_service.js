import { apiRequest, apiRequestJson } from '../utils/apiErrorHandler.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Vacances qui chevauchent une plage de dates (tous les rôles connectés). */
export function getSchoolHolidays(dateFrom, dateTo) {
  const params = new URLSearchParams()
  if (dateFrom) params.append('date_from', dateFrom)
  if (dateTo) params.append('date_to', dateTo)
  return apiRequestJson(`/api/school-holidays?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les vacances scolaires.',
  })
}

/** Vacances d'une année scolaire (administrateur). */
export function getYearHolidays(schoolYearId) {
  return apiRequestJson(`/api/school-years/${schoolYearId}/holidays`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les vacances de cette année.',
  })
}

export function createYearHoliday(schoolYearId, holiday) {
  return apiRequestJson(`/api/school-years/${schoolYearId}/holidays`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(holiday),
    fallbackMessage: "Impossible d'ajouter ces vacances.",
  })
}

export function deleteYearHoliday(schoolYearId, holidayId) {
  return apiRequest(`/api/school-years/${schoolYearId}/holidays/${holidayId}`, {
    method: 'DELETE',
    fallbackMessage: 'Impossible de supprimer ces vacances.',
  })
}
