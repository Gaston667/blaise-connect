export async function getTeachersOverview(q) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  const res = await fetch(`/api/teachers/overview?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Échec du chargement des enseignants')
  return await res.json()
}

/**
 * Charge un enseignant depuis la vue de gestion afin que son URL reste
 * consultable après une actualisation du navigateur.
 */
export async function getTeacherOverview(teacherId) {
  const teachers = await getTeachersOverview()
  const teacher = teachers.find((item) => item.id === teacherId)
  if (!teacher) throw new Error('Enseignant introuvable.')
  return teacher
}
