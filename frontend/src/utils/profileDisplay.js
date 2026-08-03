export function getCivilTitle(gender) {
  if (gender === 'MALE' || gender === 'M') return 'M.'
  if (gender === 'FEMALE' || gender === 'F') return 'Mme'
  return ''
}

export function formatProfileName(firstName, lastName, gender, { order = 'last-first', fallback = 'Non renseigne' } = {}) {
  const title = getCivilTitle(gender)
  const normalizedLastName = String(lastName ?? '').trim().toLocaleUpperCase('fr-FR')
  const normalizedFirstName = String(firstName ?? '').trim()
  const parts = order === 'last-first'
    ? [normalizedLastName, normalizedFirstName]
    : [normalizedFirstName, normalizedLastName]
  const fullName = parts.filter(Boolean).join(' ').trim()

  if (!fullName) return fallback
  return title ? `${title} ${fullName}` : fullName
}