import { apiRequestJson, parseApiError } from '../utils/apiErrorHandler.js'

/** Charge les bulletins existants selon les filtres sélectionnés. */
export function getReportCards(filters = {}) {
  const params = new URLSearchParams()

  if (filters.schoolYearId) params.set('school_year_id', filters.schoolYearId)
  if (filters.schoolClassId) params.set('school_class_id', filters.schoolClassId)
  if (filters.reportingPeriodId) params.set('reporting_period_id', filters.reportingPeriodId)

  return apiRequestJson(`/api/report-cards?${params.toString()}`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger les bulletins.',
  })
}

/** Charge le contenu figé d'un bulletin. */
export function getReportCard(reportCardId) {
  return apiRequestJson(`/api/report-cards/${reportCardId}`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger ce bulletin.',
  })
}

/** Génère un PDF distant de test sans modifier le bulletin. */
export async function getReportCardTestPdf(reportCardId) {
  const response = await fetch(`/api/report-cards/${reportCardId}/test-pdf`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw await parseApiError(
      response,
      'Impossible de générer le PDF de test.',
    )
  }

  return response.blob()
}
