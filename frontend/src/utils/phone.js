/** Format international lisible attendu dans les formulaires BlaiseConnect. */
export const INTERNATIONAL_PHONE_PATTERN = '^\\+\\d{1,3}(?: \\d{1,3}){3,6}$'

export function normalizeInternationalPhone(value) {
  return value.trim().replace(/\s+/g, ' ')
}

export function isValidInternationalPhone(value) {
  return new RegExp(INTERNATIONAL_PHONE_PATTERN).test(
    normalizeInternationalPhone(value),
  )
}
