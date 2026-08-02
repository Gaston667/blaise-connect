export function getCivilTitle(gender) {
  if (gender === 'MALE' || gender === 'M') return 'M.'
  if (gender === 'FEMALE' || gender === 'F') return 'Mme'
  return ''
}

export function formatProfileName(firstName, lastName, gender, { order = 'first-last', fallback = 'Non renseigne' } = {}) {
  const title = getCivilTitle(gender)
  const parts = order === 'last-first'
    ? [lastName, firstName]
    : [firstName, lastName]
  const fullName = parts.filter(Boolean).join(' ').trim()

  if (!fullName) return fallback
  return title ? `${title} ${fullName}` : fullName
}