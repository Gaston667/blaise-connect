const PASSWORD_UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const PASSWORD_LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const PASSWORD_DIGITS = '0123456789'
const PASSWORD_SPECIALS = '!@#.*/+=-'

/** Sélectionne un caractère avec l'aléatoire sécurisé du navigateur. */
function pickSecureCharacter(characters) {
  const values = new Uint32Array(1)
  window.crypto.getRandomValues(values)
  return characters[values[0] % characters.length]
}

/** Mélange les caractères sans utiliser Math.random. */
function shuffleSecurely(characters) {
  const shuffledCharacters = [...characters]

  for (let index = shuffledCharacters.length - 1; index > 0; index -= 1) {
    const values = new Uint32Array(1)
    window.crypto.getRandomValues(values)
    const targetIndex = values[0] % (index + 1)
    const currentCharacter = shuffledCharacters[index]
    shuffledCharacters[index] = shuffledCharacters[targetIndex]
    shuffledCharacters[targetIndex] = currentCharacter
  }

  return shuffledCharacters.join('')
}

/** Génère 3 majuscules, 2 chiffres, 3 minuscules et 1 caractère spécial. */
export function generateSecurePassword() {
  const characters = [
    ...Array.from({ length: 3 }, function createUppercaseCharacter() {
      return pickSecureCharacter(PASSWORD_UPPERCASE)
    }),
    ...Array.from({ length: 2 }, function createDigitCharacter() {
      return pickSecureCharacter(PASSWORD_DIGITS)
    }),
    ...Array.from({ length: 3 }, function createLowercaseCharacter() {
      return pickSecureCharacter(PASSWORD_LOWERCASE)
    }),
    pickSecureCharacter(PASSWORD_SPECIALS),
  ]

  return shuffleSecurely(characters)
}
