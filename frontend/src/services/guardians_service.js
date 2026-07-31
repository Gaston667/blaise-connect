/** Appels HTTP liés aux responsables légaux. */

export async function getGuardianDetail(id) {
  const response = await fetch(`/api/guardians/${id}/detail`, {
    credentials: 'include',
  })
  if (!response.ok) {
    let message = 'Impossible de charger ce responsable.'
    try {
      const body = await response.json()
      if (body?.detail) message = body.detail
    } catch {
      // Le message générique est conservé si la réponse n'est pas du JSON.
    }
    throw new Error(message)
  }
  return response.json()
}

export async function updateGuardian(guardianId, payload) {
  const response = await fetch(`/api/guardians/${guardianId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    let message = 'Impossible de mettre à jour ce responsable.'
    try {
      const body = await response.json()
      if (body?.detail) message = body.detail
    } catch {
      // Le message générique est conservé si la réponse n'est pas du JSON.
    }
    throw new Error(message)
  }
  return response.json()
}

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

export async function unlinkGuardianFromStudent(studentId, guardianId) {
  const response = await fetch(
    `/api/students/${studentId}/guardians/${guardianId}`,
    {
      method: 'DELETE',
      credentials: 'include',
    },
  )
  if (!response.ok) {
    let message = 'Impossible de retirer ce responsable.'
    try {
      const body = await response.json()
      if (body?.detail) message = body.detail
    } catch {
      // On conserve le message générique si la réponse n'est pas du JSON.
    }
    throw new Error(message)
  }
}
