export const STUDENTS_API_URL = '/api/students/'

export async function listStudents({ q = null, status = null, class_id = null, school_year_id = null, limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (status) params.append('status', status)
  if (class_id) params.append('class_id', class_id)
  if (school_year_id) params.append('school_year_id', school_year_id)
  params.append('limit', String(limit))
  params.append('offset', String(offset))

  const res = await fetch(`${STUDENTS_API_URL}?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!res.ok) {
    let err = 'Failed to fetch students'
    try {
      const body = await res.json()
      if (body && body.detail) err = body.detail
    } catch {}
    throw new Error(err)
  }

  return await res.json()
}

export async function getStudent(id) {
const res = await fetch(`${STUDENTS_API_URL}${id}`, { credentials: 'include' })
    if (!res.ok) {
    let err = 'Failed to fetch student'
    try {
      const body = await res.json()
      if (body && body.detail) err = body.detail
    } catch {}
    throw new Error(err)
  }
  return await res.json()
}
export async function createStudent(payload) {
  const res = await fetch(STUDENTS_API_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    let err = 'Échec de la création de l\'élève'
    try {
      const body = await res.json()
      if (body && body.detail) err = body.detail
    } catch {}
    throw new Error(err)
  }

  return await res.json()
}
export async function updateStudent(id, payload) {
  const res = await fetch(`${STUDENTS_API_URL}${id}`, {
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

async function postAction(id, action) {
  const res = await fetch(`${STUDENTS_API_URL}${id}/${action}`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    let err = `Échec de l'action "${action}"`
    try { const body = await res.json(); if (body?.detail) err = body.detail } catch {}
    throw new Error(err)
  }
  return await res.json()
}

export const archiveStudent = (id) => postAction(id, 'archive')
export const deactivateStudent = (id) => postAction(id, 'deactivate')
export const reactivateStudent = (id) => postAction(id, 'reactivate')

export async function getStudentStatusHistory(id) {
  const res = await fetch(`${STUDENTS_API_URL}${id}/status-history`, { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement de l\'historique')
  return await res.json()
}