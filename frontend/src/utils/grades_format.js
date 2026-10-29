/** Formatage partagé des notes (espace élève et parent). */

export function formatAverage(value) {
  if (value === null || value === undefined) return '—'
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue.toFixed(2).replace('.', ',') : '—'
}

export function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

export function formatScore(grade) {
  if (grade.result_type === 'ABSENT') return 'Absent'
  if (grade.score === null || grade.score === undefined) return '—'
  return `${Number(grade.score).toFixed(2)} / ${Number(grade.maximum_score).toFixed(2)}`
}

export function scoreTone(grade) {
  if (grade.result_type === 'ABSENT') return 'sgp-score--absent'
  const ratio = Number(grade.score) / Number(grade.maximum_score)
  if (ratio >= 0.7) return 'sgp-score--good'
  if (ratio >= 0.5) return 'sgp-score--average'
  return 'sgp-score--low'
}
