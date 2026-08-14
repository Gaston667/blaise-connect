import { apiRequestJson } from '../utils/apiErrorHandler.js'

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
