export async function getGuardiansOverview(q) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  const res = await fetch(`/api/guardians?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) {
    let message = 'Échec du chargement des responsables'
    try {
      const body = await res.json()
      if (body?.detail) message = body.detail
    } catch {
      // Le message générique est conservé si la réponse n'est pas du JSON.
    }
    throw new Error(message)
  }
  return await res.json()
}

export async function getGuardianDetail(id) {
  const res = await fetch(`/api/guardians/${id}/detail`, { credentials: 'include' })
  if (!res.ok) {
    let message = 'Échec du chargement du responsable'
    try {
      const body = await res.json()
      if (body?.detail) message = body.detail
    } catch {
      // Le message générique est conservé si la réponse n'est pas du JSON.
    }
    throw new Error(message)
  }
  return await res.json()
}