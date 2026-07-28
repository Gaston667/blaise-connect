export async function getClassLevels() {
  const res = await fetch('/api/class-levels', { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement des niveaux')
  return await res.json()
}

export async function getTeachers() {
  const res = await fetch('/api/teachers', { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement des enseignants')
  return await res.json()
}

export async function getSchoolClassesOverview({ q, schoolYearId, classLevelId, status, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (schoolYearId) params.append('school_year_id', schoolYearId)
  if (classLevelId) params.append('class_level_id', classLevelId)
  if (status) params.append('status', status)
  params.append('limit', String(limit))
  params.append('offset', String(offset))

  const res = await fetch(`/api/school-classes/overview?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement des classes')
  return await res.json()
}

export async function getSchoolClassDetail(id) {
  const res = await fetch(`/api/school-classes/${id}/detail`, { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement de la classe')
  return await res.json()
}

export async function updateSchoolClass(id, payload) {
  const res = await fetch(`/api/school-classes/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let err = 'Échec de la mise à jour'
    try { const body = await res.json(); if (body?.detail) err = body.detail } catch {}
    throw new Error(err)
  }
  return await res.json()
}

export async function deleteSchoolClass(id) {
  const res = await fetch(`/api/school-classes/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    let err = 'Échec de la suppression'
    try { const body = await res.json(); if (body?.detail) err = body.detail } catch {}
    throw new Error(err)
  }
}