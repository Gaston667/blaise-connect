/** Appels HTTP liés aux responsables légaux. */

export async function searchGuardians(query = '') {
  const parameters = new URLSearchParams()
  if (query.trim()) parameters.set('q', query.trim())
  const response = await fetch(`/api/guardians?${parameters.toString()}`, {
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Impossible de rechercher les responsables.')
  return response.json()
}

export async function linkGuardianToStudent(studentId, guardianId, linkData) {
  const response = await fetch(
    `/api/students/${studentId}/guardians/${guardianId}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(linkData),
    },
  )
  if (!response.ok) throw new Error('Impossible d’associer ce responsable.')
  return response.json()
}
