async function guardiansApiErrorMessage(response) {
  try {
    const body = await response.json()
    if (body && body.detail) return typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
  } catch {}
  return 'Une erreur est survenue.'
}

export async function searchGuardians(q) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  const res = await fetch(`/api/guardians?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) throw new Error(await guardiansApiErrorMessage(res))
  return await res.json()
}

export async function createGuardian(payload) {
  const res = await fetch('/api/guardians', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await guardiansApiErrorMessage(res))
  return await res.json()
}

export async function linkGuardianToStudent(studentId, guardianId, relationship, isPrimaryContact) {
  const params = new URLSearchParams({
    relationship,
    is_primary_contact: String(isPrimaryContact),
  })
  const res = await fetch(`/api/students/${studentId}/guardians/${guardianId}?${params.toString()}`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await guardiansApiErrorMessage(res))
  return await res.json()
}