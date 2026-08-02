export async function getAdministratorsOverview(q) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  const res = await fetch(`/api/administrators/overview?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement des administrateurs')
  return await res.json()
}

/**
 * Charge un administrateur depuis la vue de gestion afin que son URL reste
 * consultable après une actualisation du navigateur.
 */
export async function getAdministratorOverview(administratorId) {
  const administrators = await getAdministratorsOverview()
  const administrator = administrators.find((item) => item.id === administratorId)
  if (!administrator) throw new Error('Administrateur introuvable.')
  return administrator
}
