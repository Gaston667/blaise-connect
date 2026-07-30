export async function getGuardiansOverview(q) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  const res = await fetch(`/api/guardians?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement des responsables')
  return await res.json()
}

export async function getGuardianDetail(id) {
  const res = await fetch(`/api/guardians/${id}/detail`, { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement du responsable')
  return await res.json()
}