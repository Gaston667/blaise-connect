export async function getClassLevels() {
  const res = await fetch('/api/class-levels', { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement des niveaux')
  return await res.json()
}

export async function getTeachers() {
  const res = await fetch('/api/teachers/overview', { credentials: 'include' })
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

export async function createSchoolClass(payload) {
  const res = await fetch('/api/school-classes', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let message = 'Échec de la création de la classe'
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

export async function getSchoolClassSubjects(id, { q = '', isActive = '' } = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (isActive !== '') params.append('is_active', isActive)

  const res = await fetch(
    `/api/school-classes/${id}/subjects?${params.toString()}`,
    { credentials: 'include' },
  )
  if (!res.ok) {
    let message = 'Échec du chargement des matières'
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

export async function getAvailableSubjectsForClass(classId) {
  const res = await fetch(`/api/school-classes/${classId}/available-subjects`, { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement des matières disponibles')
  return res.json()
}

export async function addClassSubject(classId, subjectId, coefficient) {
  const res = await fetch(`/api/school-classes/${classId}/subjects`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject_id: subjectId, coefficient: Number(coefficient) }),
  })
  if (!res.ok) {
    let err = 'Échec de l\'ajout de la matière'
    try { const b = await res.json(); if (b?.detail) err = b.detail } catch {}
    throw new Error(err)
  }
  return res.json()
}

export async function updateClassSubjectCoefficient(classId, classSubjectId, coefficient) {
  const res = await fetch(`/api/school-classes/${classId}/subjects/${classSubjectId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coefficient: Number(coefficient) }),
  })
  if (!res.ok) {
    let err = 'Échec de la modification du coefficient'
    try { const b = await res.json(); if (b?.detail) err = b.detail } catch {}
    throw new Error(err)
  }
  return res.json()
}

export async function removeClassSubject(classId, classSubjectId) {
  const res = await fetch(`/api/school-classes/${classId}/subjects/${classSubjectId}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    let err = 'Échec du retrait de la matière'
    try { const b = await res.json(); if (b?.detail) err = b.detail } catch {}
    throw new Error(err)
  }
}
