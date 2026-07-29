import { Eye, EyeOff, IdCard, KeyRound, Printer, RefreshCw, UserRoundPlus } from 'lucide-react'
import { useState } from 'react'

import { createAccount } from '../services/account_service.js'

const INITIAL_FORM = {
  role: '',
  registration_number: '',
  password: '',
  password_confirmation: '',
  first_name: '',
  last_name: '',
  birth_date: '',
  gender: '',
  email: '',
  phone: '',
  address: '',
  admission_date: '',
  hire_date: '',
  qualification: '',
  job_title: '',
  occupation: '',
  employer: '',
}

const PASSWORD_UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const PASSWORD_LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const PASSWORD_DIGITS = '0123456789'
const PASSWORD_SPECIALS = '!@#.*/+=-'

/** Sélectionne un caractère avec le générateur aléatoire sécurisé du navigateur. */
function pickSecureCharacter(characters) {
  const values = new Uint32Array(1)
  window.crypto.getRandomValues(values)
  return characters[values[0] % characters.length]
}

/** Mélange une liste de caractères avec le générateur sécurisé du navigateur. */
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
function generatePasswordValue() {
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

/** Page de création atomique d'un compte et de son profil métier. */
export default function AccountCreatePage({ onNavigate }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [creationSummary, setCreationSummary] = useState(null)

  function updateField(event) {
    const { name, value } = event.target
    setForm(function updateCurrentForm(currentForm) {
      return { ...currentForm, [name]: value }
    })
  }

  function togglePasswordVisibility() {
    setShowPassword(function toggleCurrentVisibility(currentVisibility) {
      return !currentVisibility
    })
  }

  /** Génère un mot de passe modifiable et remplit sa confirmation. */
  function generatePassword() {
    const generatedPassword = generatePasswordValue()
    setForm(function addGeneratedPassword(currentForm) {
      return {
        ...currentForm,
        password: generatedPassword,
        password_confirmation: generatedPassword,
      }
    })
    setShowPassword(true)
  }

  function cancelCreation() {
    onNavigate('accounts')
  }

  function printCreationSummary() {
    window.print()
  }

  function startAnotherCreation() {
    setForm(INITIAL_FORM)
    setCreationSummary(null)
    setShowPassword(false)
    setErrorMessage('')
    setSuccessMessage('')
  }

  function cleanOptionalValue(value) {
    return value.trim() || null
  }

  async function submitCreation(event) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (form.password !== form.password_confirmation) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)
    try {
      const createdAccount = await createAccount({
        password: form.password,
        role: form.role,
        profile: {
          first_name: form.first_name,
          last_name: form.last_name,
          birth_date: form.birth_date || null,
          gender: form.gender || null,
          email: cleanOptionalValue(form.email),
          phone: cleanOptionalValue(form.phone),
          address: cleanOptionalValue(form.address),
          admission_date: form.admission_date || null,
          hire_date: form.hire_date || null,
          qualification: cleanOptionalValue(form.qualification),
          job_title: cleanOptionalValue(form.job_title),
          occupation: cleanOptionalValue(form.occupation),
          employer: cleanOptionalValue(form.employer),
        },
      })
      setCreationSummary({
        ...createdAccount,
        password: form.password,
        submittedProfile: { ...form },
      })
      setSuccessMessage('Le compte et son profil ont été créés avec succès.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const passwordType = showPassword ? 'text' : 'password'
  const isStudent = form.role === 'STUDENT'
  const isTeacher = form.role === 'TEACHER'
  const isAdministrator = form.role === 'ADMIN'
  const isGuardian = form.role === 'GUARDIAN'

  if (creationSummary) {
    const summaryProfile = creationSummary.profile || creationSummary.submittedProfile
    return (
      <main className="creation-compte-page creation-compte-summary-page">
        <header className="creation-compte-heading">
          <h1>Compte créé avec succès</h1>
          <p>Conservez ou imprimez ce récapitulatif avant de quitter cette page.</p>
        </header>

        <article className="creation-compte-summary">
          <header>
            <div>
              <span className="creation-compte-summary-status">Compte actif</span>
              <h2>{summaryProfile.first_name} {summaryProfile.last_name}</h2>
            </div>
            <UserRoundPlus size={34} aria-hidden="true" />
          </header>

          <section>
            <h3>Identifiants de connexion</h3>
            <dl>
              <div><dt>Matricule</dt><dd>{creationSummary.registration_number}</dd></div>
              <div><dt>Mot de passe</dt><dd>{creationSummary.password}</dd></div>
              <div><dt>Rôle</dt><dd>{creationSummary.role}</dd></div>
            </dl>
            <p className="creation-compte-summary-warning">
              Le mot de passe est affiché uniquement sur cette page. Remettez-le directement à son titulaire.
            </p>
          </section>

          <section>
            <h3>Informations du profil</h3>
            <dl>
              <div><dt>Prénom</dt><dd>{summaryProfile.first_name}</dd></div>
              <div><dt>Nom</dt><dd>{summaryProfile.last_name}</dd></div>
              <div><dt>Sexe</dt><dd>{summaryProfile.gender || 'Non renseigné'}</dd></div>
              <div><dt>Date de naissance</dt><dd>{summaryProfile.birth_date || 'Non renseignée'}</dd></div>
              <div><dt>Email</dt><dd>{summaryProfile.email || 'Non renseigné'}</dd></div>
              <div><dt>Téléphone</dt><dd>{summaryProfile.phone || 'Non renseigné'}</dd></div>
              <div><dt>Adresse</dt><dd>{summaryProfile.address || 'Non renseignée'}</dd></div>
              <div><dt>Date d’admission</dt><dd>{summaryProfile.admission_date || 'Non concerné'}</dd></div>
              <div><dt>Date d’embauche</dt><dd>{summaryProfile.hire_date || 'Non concerné'}</dd></div>
              <div><dt>Qualification</dt><dd>{summaryProfile.qualification || 'Non concerné'}</dd></div>
              <div><dt>Fonction</dt><dd>{summaryProfile.job_title || 'Non concerné'}</dd></div>
              <div><dt>Profession</dt><dd>{summaryProfile.occupation || 'Non concerné'}</dd></div>
              <div><dt>Employeur</dt><dd>{summaryProfile.employer || 'Non concerné'}</dd></div>
              <div><dt>Date de création</dt><dd>{new Date(creationSummary.created_at).toLocaleString('fr-FR')}</dd></div>
            </dl>
          </section>
        </article>

        <footer className="creation-compte-summary-actions">
          <button type="button" className="creation-compte-cancel" onClick={cancelCreation}>Retour aux comptes</button>
          <button type="button" className="creation-compte-cancel" onClick={startAnotherCreation}>Créer un autre compte</button>
          <button type="button" className="creation-compte-submit" onClick={printCreationSummary}>
            <Printer size={18} aria-hidden="true" />
            Imprimer
          </button>
        </footer>
      </main>
    )
  }

  return (
    <main className="creation-compte-page">
      <header className="creation-compte-heading">
        <h1>Ajouter un nouveau compte</h1>
        <nav aria-label="Fil d’Ariane">
          <button type="button" onClick={() => onNavigate('home')}>Accueil</button>
          <span>›</span>
          <button type="button" onClick={() => onNavigate('accounts')}>Comptes</button>
          <span>›</span>
          <span>Ajouter un compte</span>
        </nav>
        <p>Créez le compte et le profil associé en une seule opération.</p>
      </header>

      <form className="creation-compte-form" onSubmit={submitCreation} autoComplete="off">
        <section className="creation-compte-section">
          <h2><KeyRound size={19} aria-hidden="true" /> Informations du compte</h2>
          <div className="creation-compte-grid creation-compte-account-grid">
            <label className="creation-compte-role-field">
              Rôle *
              <select name="role" value={form.role} onChange={updateField} required>
                <option value="">Sélectionner un rôle</option>
                <option value="ADMIN">Administrateur</option>
                <option value="TEACHER">Enseignant</option>
                <option value="STUDENT">Élève</option>
                <option value="GUARDIAN">Responsable</option>
              </select>
            </label>

            <label className="creation-compte-registration-field">
              Matricule
              <input value="Généré automatiquement après la création" readOnly aria-readonly="true" />
              <small>Le préfixe dépendra du rôle sélectionné.</small>
            </label>

            <label className="creation-compte-password-field">
              Mot de passe *
              <span className="creation-compte-password">
                <input name="password" type={passwordType} value={form.password} onChange={updateField} minLength="8" maxLength="128" autoComplete="new-password" required />
                <button type="button" onClick={togglePasswordVisibility} aria-label="Afficher ou masquer le mot de passe">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
              <button type="button" className="creation-compte-generate" onClick={generatePassword}>
                <RefreshCw size={16} aria-hidden="true" />
                Générer
              </button>
            </label>

            <label className="creation-compte-confirmation-field">
              Confirmer le mot de passe *
              <input name="password_confirmation" type={passwordType} value={form.password_confirmation} onChange={updateField} minLength="8" maxLength="128" autoComplete="new-password" required />
            </label>
          </div>
        </section>

        <section className="creation-compte-section">
          <h2><IdCard size={19} aria-hidden="true" /> Informations d’identité</h2>
          <div className="creation-compte-grid">
            <label>Prénom *<input name="first_name" value={form.first_name} onChange={updateField} maxLength="100" autoComplete="off" required /></label>
            <label>Nom *<input name="last_name" value={form.last_name} onChange={updateField} maxLength="100" autoComplete="off" required /></label>

            {(isStudent || isTeacher) && (
              <label>Date de naissance<input name="birth_date" type="date" value={form.birth_date} onChange={updateField} /></label>
            )}

            <label>
              Sexe
              <select name="gender" value={form.gender} onChange={updateField}>
                <option value="">Non renseigné</option>
                <option value="MALE">Masculin</option>
                <option value="FEMALE">Féminin</option>
              </select>
            </label>

            <label>Email<input name="email" type="email" value={form.email} onChange={updateField} maxLength="254" autoComplete="off" /></label>
            <label>Téléphone {isGuardian && '*'}<input name="phone" value={form.phone} onChange={updateField} maxLength="30" autoComplete="off" required={isGuardian} /></label>
            <label className="creation-compte-wide">Adresse<input name="address" value={form.address} onChange={updateField} autoComplete="off" /></label>
          </div>
        </section>

        {form.role && (
          <section className="creation-compte-section">
            <h2><UserRoundPlus size={19} aria-hidden="true" /> Informations {isStudent ? 'scolaires' : 'professionnelles'}</h2>
            <div className="creation-compte-grid">
              {isStudent && <label>Date d’admission *<input name="admission_date" type="date" value={form.admission_date} onChange={updateField} required /></label>}
              {(isTeacher || isAdministrator) && <label>Date d’embauche *<input name="hire_date" type="date" value={form.hire_date} onChange={updateField} required /></label>}
              {isTeacher && <label>Qualification<input name="qualification" value={form.qualification} onChange={updateField} /></label>}
              {isAdministrator && <label>Fonction / Poste *<input name="job_title" value={form.job_title} onChange={updateField} maxLength="100" required /></label>}
              {isGuardian && <label>Profession<input name="occupation" value={form.occupation} onChange={updateField} maxLength="150" /></label>}
              {isGuardian && <label>Employeur<input name="employer" value={form.employer} onChange={updateField} maxLength="150" /></label>}
            </div>
          </section>
        )}

        {errorMessage && <p className="creation-compte-message creation-compte-message-error" role="alert">{errorMessage}</p>}
        {successMessage && <p className="creation-compte-message creation-compte-message-success" role="status">{successMessage}</p>}

        <footer className="creation-compte-actions">
          <button type="button" className="creation-compte-cancel" onClick={cancelCreation}>Annuler</button>
          <button type="submit" className="creation-compte-submit" disabled={submitting}>
            <UserRoundPlus size={18} aria-hidden="true" />
            {submitting ? 'Création…' : 'Créer le compte'}
          </button>
        </footer>
      </form>
    </main>
  )
}
