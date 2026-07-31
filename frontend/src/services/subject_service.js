/** Client HTTP pour la gestion des matières. */

export async function getSubjectsOverview({ q, classId, teacherId, isActive } = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (classId) params.append('class_id', classId)
  if (teacherId) params.append('teacher_id', teacherId)
  if (isActive !== undefined && isActive !== '') params.append('is_active', isActive)

  const res = await fetch(`/api/subjects/overview?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement des matières')
  return await res.json()
}

export async function createSubject(payload) {
  const res = await fetch('/api/subjects', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let message = 'Échec de la création de la matière'
    try {
      const body = await res.json()
      if (body?.detail) message = body.detail
    } catch {
      // Le message générique reste utilisé lorsque la réponse n'est pas du JSON.
    }
    throw new Error(message)
  }
  return await res.json()
}

export async function updateSubject(id, payload) {
  const res = await fetch(`/api/subjects/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let message = 'Échec de la mise à jour de la matière'
    try {
      const body = await res.json()
      if (body?.detail) message = body.detail
    } catch {
      // Le message générique reste utilisé lorsque la réponse n'est pas du JSON.
    }
    throw new Error(message)
  }
  return await res.json()
}
