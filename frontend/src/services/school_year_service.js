import { apiRequest, apiRequestJson } from '../utils/apiErrorHandler.js'

const SCHOOL_YEARS_API_URL = '/api/school-years'

/** Récupère les années scolaires visibles par l'administrateur connecté. */
export async function getSchoolYears() {
  return apiRequestJson(SCHOOL_YEARS_API_URL, {
    method: 'GET',
    fallbackMessage: 'La requête sur les années scolaires a échoué.',
  })
}

/** Récupère le détail d'une année scolaire. */
export async function getSchoolYear(schoolYearId) {
  return apiRequestJson(`${SCHOOL_YEARS_API_URL}/${schoolYearId}`, {
    method: 'GET',
    fallbackMessage: 'La requête sur les années scolaires a échoué.',
  })
}

/** Crée une nouvelle année scolaire. */
export async function createSchoolYear(schoolYearData) {
  return apiRequestJson(SCHOOL_YEARS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schoolYearData),
    fallbackMessage: 'Impossible de créer l’année scolaire.',
  })
}

/** Définit une année scolaire comme l'unique année courante. */
export async function setCurrentSchoolYear(schoolYearId) {
  return apiRequestJson(`${SCHOOL_YEARS_API_URL}/${schoolYearId}/set-current`, {
    method: 'POST',
    fallbackMessage: 'Impossible de définir l’année courante.',
  })
}

/** Clôture une année scolaire. */
export async function closeSchoolYear(schoolYearId) {
  return apiRequestJson(`${SCHOOL_YEARS_API_URL}/${schoolYearId}/close`, {
    method: 'POST',
    fallbackMessage: 'Impossible de clôturer l’année scolaire.',
  })
}

/** Récupère les périodes d'une année scolaire. */
export async function getReportingPeriods(schoolYearId) {
  return apiRequestJson(`${SCHOOL_YEARS_API_URL}/${schoolYearId}/reporting-periods`, {
    method: 'GET',
    fallbackMessage: 'La requête sur les périodes a échoué.',
  })
}

/**
 * Crée une période de bulletin.
 *
 * Seule `end_date` est saisie par l'administrateur : le backend
 * calcule la date de début.
 */
export async function createReportingPeriod(schoolYearId, periodData) {
  return apiRequestJson(`${SCHOOL_YEARS_API_URL}/${schoolYearId}/reporting-periods`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ school_year_id: schoolYearId, ...periodData }),
    fallbackMessage: 'Impossible de créer la période.',
  })
}

/** Modifie les informations d'une année scolaire non clôturée. */
export async function updateSchoolYear(schoolYearId, schoolYearData) {
  return apiRequestJson(`${SCHOOL_YEARS_API_URL}/${schoolYearId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schoolYearData),
    fallbackMessage: 'Impossible de modifier l’année scolaire.',
  })
}

/** Modifie une année et toutes ses périodes dans une transaction backend. */
export async function updateSchoolYearDetails(schoolYearId, detailsData) {
  return apiRequestJson(`${SCHOOL_YEARS_API_URL}/${schoolYearId}/details`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(detailsData),
    fallbackMessage: 'Impossible de modifier les détails de l’année scolaire.',
  })
}

/** Compte les données concernées avant une suppression définitive. */
export async function getSchoolYearDeletionPreview(schoolYearId) {
  return apiRequestJson(`${SCHOOL_YEARS_API_URL}/${schoolYearId}/deletion-preview`, {
    method: 'GET',
    fallbackMessage: 'Impossible de charger l’aperçu de suppression.',
  })
}

/** Supprime une année ouverte après confirmation exacte de son nom. */
export async function deleteSchoolYear(schoolYearId, confirmationName) {
  return apiRequestJson(`${SCHOOL_YEARS_API_URL}/${schoolYearId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation_name: confirmationName }),
    expectJson: true,
    fallbackMessage: 'Impossible de supprimer l’année scolaire.',
  })
}

/** Modifie une période et laisse le backend ajuster la période suivante. */
export async function updateReportingPeriod(
  schoolYearId,
  reportingPeriodId,
  periodData,
) {
  return apiRequestJson(`${SCHOOL_YEARS_API_URL}/${schoolYearId}/reporting-periods/${reportingPeriodId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(periodData),
    fallbackMessage: 'Impossible de modifier la période.',
  })
}
