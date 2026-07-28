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
