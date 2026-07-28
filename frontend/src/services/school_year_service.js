const SCHOOL_YEARS_API_URL = '/api/school-years'

/** Extrait un message lisible d'une erreur FastAPI. */
async function getSchoolYearsApiErrorMessage(response) {
  try {
    const errorData = await response.json()
    if (typeof errorData.detail === 'string') {
      return errorData.detail
    }
    return 'La requête sur les années scolaires a échoué.'
  } catch {
    return 'Le serveur ne répond pas correctement.'
  }
}

/** Récupère les années scolaires visibles par l'administrateur connecté. */
export async function getSchoolYears() {
  const response = await fetch(SCHOOL_YEARS_API_URL, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(await getSchoolYearsApiErrorMessage(response))
  }

  return response.json()
}

/** Récupère le détail d'une année scolaire. */
export async function getSchoolYear(schoolYearId) {
  const response = await fetch(`${SCHOOL_YEARS_API_URL}/${schoolYearId}`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(await getSchoolYearsApiErrorMessage(response))
  }

  return response.json()
}

/** Crée une nouvelle année scolaire. */
export async function createSchoolYear(schoolYearData) {
  const response = await fetch(SCHOOL_YEARS_API_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schoolYearData),
  })

  if (!response.ok) {
    throw new Error(await getSchoolYearsApiErrorMessage(response))
  }

  return response.json()
}

/** Définit une année scolaire comme l'unique année courante. */
export async function setCurrentSchoolYear(schoolYearId) {
  const response = await fetch(
    `${SCHOOL_YEARS_API_URL}/${schoolYearId}/set-current`,
    { method: 'POST', credentials: 'include' },
  )

  if (!response.ok) {
    throw new Error(await getSchoolYearsApiErrorMessage(response))
  }

  return response.json()
}

/** Clôture une année scolaire. */
export async function closeSchoolYear(schoolYearId) {
  const response = await fetch(
    `${SCHOOL_YEARS_API_URL}/${schoolYearId}/close`,
    { method: 'POST', credentials: 'include' },
  )

  if (!response.ok) {
    throw new Error(await getSchoolYearsApiErrorMessage(response))
  }

  return response.json()
}

/** Récupère les périodes d'une année scolaire. */
export async function getReportingPeriods(schoolYearId) {
  const response = await fetch(
    `${SCHOOL_YEARS_API_URL}/${schoolYearId}/reporting-periods`,
    { method: 'GET', credentials: 'include' },
  )

  if (!response.ok) {
    throw new Error(await getSchoolYearsApiErrorMessage(response))
  }

  return response.json()
}

/**
 * Crée une période de bulletin.
 *
 * Seule `end_date` est saisie par l'administrateur : le backend
 * calcule la date de début.
 */
export async function createReportingPeriod(schoolYearId, periodData) {
  const response = await fetch(
    `${SCHOOL_YEARS_API_URL}/${schoolYearId}/reporting-periods`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_year_id: schoolYearId, ...periodData }),
    },
  )

  if (!response.ok) {
    throw new Error(await getSchoolYearsApiErrorMessage(response))
  }

  return response.json()
}

/** Modifie les informations d'une année scolaire non clôturée. */
export async function updateSchoolYear(schoolYearId, schoolYearData) {
  const response = await fetch(`${SCHOOL_YEARS_API_URL}/${schoolYearId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schoolYearData),
  })

  if (!response.ok) {
    throw new Error(await getSchoolYearsApiErrorMessage(response))
  }

  return response.json()
}

/** Modifie une année et toutes ses périodes dans une transaction backend. */
export async function updateSchoolYearDetails(schoolYearId, detailsData) {
  const response = await fetch(
    `${SCHOOL_YEARS_API_URL}/${schoolYearId}/details`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detailsData),
    },
  )

  if (!response.ok) {
    throw new Error(await getSchoolYearsApiErrorMessage(response))
  }

  return response.json()
}

/** Compte les données concernées avant une suppression définitive. */
export async function getSchoolYearDeletionPreview(schoolYearId) {
  const response = await fetch(
    `${SCHOOL_YEARS_API_URL}/${schoolYearId}/deletion-preview`,
    { method: 'GET', credentials: 'include' },
  )

  if (!response.ok) {
    throw new Error(await getSchoolYearsApiErrorMessage(response))
  }

  return response.json()
}

/** Supprime une année ouverte après confirmation exacte de son nom. */
export async function deleteSchoolYear(schoolYearId, confirmationName) {
  const response = await fetch(`${SCHOOL_YEARS_API_URL}/${schoolYearId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation_name: confirmationName }),
  })

  if (!response.ok) {
    throw new Error(await getSchoolYearsApiErrorMessage(response))
  }

  return response.json()
}

/** Modifie une période et laisse le backend ajuster la période suivante. */
export async function updateReportingPeriod(
  schoolYearId,
  reportingPeriodId,
  periodData,
) {
  const response = await fetch(
    `${SCHOOL_YEARS_API_URL}/${schoolYearId}/reporting-periods/${reportingPeriodId}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(periodData),
    },
  )

  if (!response.ok) {
    throw new Error(await getSchoolYearsApiErrorMessage(response))
  }

  return response.json()
}
