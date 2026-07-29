export async function getTeachersOverview(q) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  const res = await fetch(`/api/teachers/overview?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement des enseignants')
  return await res.json()
}