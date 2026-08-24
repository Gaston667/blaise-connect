import { Eye, EyeOff, IdCard, ImagePlus, KeyRound, LockKeyhole, Printer, RefreshCw, UserRoundPlus } from 'lucide-react'
import { useState } from 'react'

import { createAccount, uploadAccountPhoto } from '../services/account_service.js'
import { generateSecurePassword } from '../services/password_generator.js'
import ConfirmationPopup from '../components/confirmation_popup.jsx'
import NotificationPopup from '../components/notification_popup.jsx'
import { formatProfileName } from '../utils/profileDisplay.js'
import { NATIONALITIES } from '../constants/nationalities.js'
import { INTERNATIONAL_PHONE_PATTERN, normalizeInternationalPhone } from '../utils/phone.js'

const INITIAL_FORM = {
  role: '',
  registration_number: '',
  password: '',
  password_confirmation: '',
  first_name: '',
  last_name: '',
  birth_date: '',
  gender: '',
  nationality: '',
  email: '',
  phone: '',
  address: '',
  birth_place: '',
  admission_date: '',
  previous_establishment: '',
  medical_condition: '',
  is_enrolled_in_cned: false,
  hire_date: '',
  qualification: '',
  job_title: '',
  occupation: '',
  employer: '',
}

const REGISTRATION_PREFIXES = {
  ADMIN: 'a',
  TEACHER: 'e',
  STUDENT: 'u',
  GUARDIAN: 'p',
}

const DEFAULT_PHOTO_ADJUSTMENTS = {
  zoom: 1.15,
  offsetX: 0,
  offsetY: 0,
}

/** Calcule un aperçu du matricule selon la même formule UTC que le backend. */
function generateRegistrationPreview(role) {
  const prefix = REGISTRATION_PREFIXES[role]
  if (!prefix) return 'Sélectionnez d’abord un rôle'

  const now = new Date()
  const shortYear = now.getUTCFullYear() % 100
  const dateValue = (
    shortYear * 372
    + now.getUTCMonth() * 31
    + now.getUTCDate()
  )
  const dateCode = dateValue % 100
  const secondsSinceMidnight = (
    now.getUTCHours() * 3600
    + now.getUTCMinutes() * 60
    + now.getUTCSeconds()
  )
  const timeCode = secondsSinceMidnight % 10000
  return `${prefix}${String(dateCode).padStart(2, '0')}${String(timeCode).padStart(4, '0')}`
}

/** Sélectionne un caractère avec le générateur aléatoire sécurisé du navigateur. */
/** Page de création atomique d'un compte et de son profil métier. */
export default function AccountCreatePage({ onNavigate }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [creationSummary, setCreationSummary] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoAdjustments, setPhotoAdjustments] = useState(DEFAULT_PHOTO_ADJUSTMENTS)
  const [confirmationOpen, setConfirmationOpen] = useState(false)

  function updateField(event) {
    const { name, value, type, checked } = event.target
    setForm(function updateCurrentForm(currentForm) {
      return { ...currentForm, [name]: type === 'checkbox' ? checked : value }
    })
  }

  function togglePasswordVisibility() {
    setShowPassword(function toggleCurrentVisibility(currentVisibility) {
      return !currentVisibility
    })
  }

  /** Génère un mot de passe modifiable et remplit sa confirmation. */
  function generatePassword() {
    const generatedPassword = generateSecurePassword()
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
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setForm(INITIAL_FORM)
    setPhoto(null)
    setPhotoPreview('')
    setPhotoAdjustments(DEFAULT_PHOTO_ADJUSTMENTS)
    setCreationSummary(null)
    setShowPassword(false)
    setErrorMessage('')
    setSuccessMessage('')
  }

  function selectPhoto(event) {
    const selectedPhoto = event.target.files?.[0] || null
    if (!selectedPhoto) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedPhoto.type)) {
      setErrorMessage('La photo doit être au format JPEG, PNG ou WebP.')
      event.target.value = ''
      return
    }
    if (selectedPhoto.size > 5 * 1024 * 1024) {
      setErrorMessage('La photo doit avoir une taille maximale de 5 Mo.')
      event.target.value = ''
      return
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(selectedPhoto)
    setPhotoPreview(URL.createObjectURL(selectedPhoto))
    setPhotoAdjustments(DEFAULT_PHOTO_ADJUSTMENTS)
    setErrorMessage('')
  }

  function updatePhotoAdjustment(field, value) {
    setPhotoAdjustments((current) => ({ ...current, [field]: value }))
  }

  async function buildAdjustedPhotoFile(sourcePhoto, adjustments) {
    const imageUrl = URL.createObjectURL(sourcePhoto)
    try {
      const image = await new Promise((resolve, reject) => {
        const loadedImage = new Image()
        loadedImage.onload = () => resolve(loadedImage)
        loadedImage.onerror = () => reject(new Error('Impossible de charger la photo sélectionnée.'))
        loadedImage.src = imageUrl
      })

      const cropSize = Math.min(image.width, image.height) / adjustments.zoom
      const maxOffsetX = (image.width - cropSize) / 2
      const maxOffsetY = (image.height - cropSize) / 2
      const sourceX = Math.max(0, Math.min(image.width - cropSize, (image.width - cropSize) / 2 + (adjustments.offsetX / 100) * maxOffsetX))
      const sourceY = Math.max(0, Math.min(image.height - cropSize, (image.height - cropSize) / 2 + (adjustments.offsetY / 100) * maxOffsetY))

      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Impossible de préparer la photo sélectionnée.')

      context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, canvas.width, canvas.height)

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (!result) {
            reject(new Error('Impossible de préparer la photo sélectionnée.'))
            return
          }
          resolve(result)
        }, sourcePhoto.type || 'image/jpeg', 0.92)
      })

      const extension = sourcePhoto.type === 'image/png'
        ? 'png'
        : sourcePhoto.type === 'image/webp'
          ? 'webp'
          : 'jpg'
      return new File([blob], `profile-photo.${extension}`, { type: blob.type || sourcePhoto.type })
    } finally {
      URL.revokeObjectURL(imageUrl)
    }
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
    setConfirmationOpen(true)
  }

  async function confirmCreation() {
    setConfirmationOpen(false)
    setSubmitting(true)
    try {
      let createdAccount = await createAccount({
        password: form.password,
        role: form.role,
        profile: {
          first_name: form.first_name,
          last_name: form.last_name,
          birth_date: form.birth_date || null,
          gender: form.gender || null,
          email: cleanOptionalValue(form.email),
          phone: cleanOptionalValue(normalizeInternationalPhone(form.phone)),
            nationality: cleanOptionalValue(form.nationality),
            address: cleanOptionalValue(form.address),
            birth_place: cleanOptionalValue(form.birth_place),
            admission_date: form.admission_date || null,
            previous_establishment: cleanOptionalValue(form.previous_establishment),
            medical_condition: cleanOptionalValue(form.medical_condition),
            is_enrolled_in_cned: form.is_enrolled_in_cned,
            hire_date: form.hire_date || null,
          qualification: cleanOptionalValue(form.qualification),
          job_title: cleanOptionalValue(form.job_title),
          occupation: cleanOptionalValue(form.occupation),
          employer: cleanOptionalValue(form.employer),
        },
      })
      let photoUploadFailed = false
      if (photo) {
        try {
          const adjustedPhoto = await buildAdjustedPhotoFile(photo, photoAdjustments)
          createdAccount = await uploadAccountPhoto(createdAccount.id, adjustedPhoto)
        } catch {
          photoUploadFailed = true
        }
      }
      setCreationSummary({
        ...createdAccount,
        password: form.password,
        submittedProfile: { ...form },
      })
      if (photoUploadFailed) {
        setErrorMessage(
          'Le compte a été créé, mais la photo n’a pas pu être enregistrée.',
        )
      } else {
        setSuccessMessage('Le compte et son profil ont été créés avec succès.')
      }
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  function cancelCreationConfirmation() {
    setConfirmationOpen(false)
  }

  const passwordType = showPassword ? 'text' : 'password'
  const isStudent = form.role === 'STUDENT'
  const isTeacher = form.role === 'TEACHER'
  const isAdministrator = form.role === 'ADMIN'
  const isGuardian = form.role === 'GUARDIAN'
  const isEmailRequired = !isStudent && !isGuardian
  const isPhoneRequired = !isStudent
  const registrationPreview = generateRegistrationPreview(form.role)

  if (creationSummary) {
    const summaryProfile = creationSummary.profile || creationSummary.submittedProfile
    return (
      <main className="creation-compte-page creation-compte-summary-page">
        <header className="creation-compte-heading">
          <h1>Compte créé avec succès</h1>
          <p>Conservez ou imprimez ce récapitulatif avant de quitter cette page.</p>
        </header>

        <div className="creation-compte-summary-actions">
          <button type="button" className="creation-compte-cancel" onClick={cancelCreation}>Retour aux comptes</button>
          <button type="button" className="creation-compte-cancel" onClick={startAnotherCreation}>Créer un autre compte</button>
          <button type="button" className="creation-compte-submit" onClick={printCreationSummary}>
            <Printer size={18} aria-hidden="true" />
            Imprimer
          </button>
        </div>

        <article className="creation-compte-summary">
          <header>
            <div>
              <span className="creation-compte-summary-status">Compte actif</span>
              <h2>{formatProfileName(summaryProfile.first_name, summaryProfile.last_name, summaryProfile.gender)}</h2>
            </div>
            {summaryProfile.photo_path ? (
              <img
                className="creation-compte-summary-photo"
                src={summaryProfile.photo_path}
                alt={`Photo de ${formatProfileName(summaryProfile.first_name, summaryProfile.last_name, summaryProfile.gender, { fallback: 'ce profil' })}`}
              />
            ) : (
              <UserRoundPlus size={34} aria-hidden="true" />
            )}
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
              <div><dt>Lieu de naissance</dt><dd>{summaryProfile.birth_place || 'Non renseigné'}</dd></div>
              <div><dt>Email</dt><dd>{summaryProfile.email || 'Non renseigné'}</dd></div>
              <div><dt>Téléphone</dt><dd>{summaryProfile.phone || 'Non renseigné'}</dd></div>
              <div><dt>Adresse</dt><dd>{summaryProfile.address || 'Non renseignée'}</dd></div>
              <div><dt>Date d’admission</dt><dd>{summaryProfile.admission_date || 'Non concerné'}</dd></div>
              <div><dt>Établissement précédent</dt><dd>{summaryProfile.previous_establishment || 'Non renseigné'}</dd></div>
              <div><dt>Maladie particulière</dt><dd>{summaryProfile.medical_condition || 'Aucune renseignée'}</dd></div>
              <div><dt>Inscrit au CNED</dt><dd>{summaryProfile.is_enrolled_in_cned ? 'Oui' : 'Non'}</dd></div>
              <div><dt>Date d’embauche</dt><dd>{summaryProfile.hire_date || 'Non concerné'}</dd></div>
              <div><dt>Qualification</dt><dd>{summaryProfile.qualification || 'Non concerné'}</dd></div>
              <div><dt>Fonction</dt><dd>{summaryProfile.job_title || 'Non concerné'}</dd></div>
              <div><dt>Profession</dt><dd>{summaryProfile.occupation || 'Non concerné'}</dd></div>
              <div><dt>Employeur</dt><dd>{summaryProfile.employer || 'Non concerné'}</dd></div>
              <div><dt>Date de création</dt><dd>{new Date(creationSummary.created_at).toLocaleString('fr-FR')}</dd></div>
            </dl>
          </section>
        </article>

        <NotificationPopup
          message={errorMessage}
          type="error"
          onClose={function closeSummaryErrorMessage() {
            setErrorMessage('')
          }}
        />

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
              <span className="creation-compte-registration-input">
                <input value={registrationPreview} readOnly aria-readonly="true" />
                <LockKeyhole aria-hidden="true" size={18} />
              </span>
              <small>
                Aperçu généré automatiquement. Le matricule définitif sera confirmé après la création.
              </small>
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
            <label className="creation-compte-photo-field">
              Photo (facultative)
              <span className="creation-compte-photo-picker">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Aperçu de la photo sélectionnée"
                    style={{
                      objectPosition: `${50 + photoAdjustments.offsetX * 0.35}% ${50 + photoAdjustments.offsetY * 0.35}%`,
                      transform: `scale(${photoAdjustments.zoom})`,
                    }}
                  />
                ) : (
                  <ImagePlus aria-hidden="true" size={28} />
                )}
                <span>
                  Choisir une photo
                  <small>JPEG, PNG ou WebP — 5 Mo maximum</small>
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={selectPhoto}
                />
              </span>
              {photoPreview && (
                <div className="creation-compte-photo-adjustments">
                  <label>
                    Zoom
                    <input
                      type="range"
                      min="1"
                      max="2"
                      step="0.01"
                      value={photoAdjustments.zoom}
                      onChange={(event) => updatePhotoAdjustment('zoom', Number(event.target.value))}
                    />
                  </label>
                  <label>
                    Position horizontale
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={photoAdjustments.offsetX}
                      onChange={(event) => updatePhotoAdjustment('offsetX', Number(event.target.value))}
                    />
                  </label>
                  <label>
                    Position verticale
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={photoAdjustments.offsetY}
                      onChange={(event) => updatePhotoAdjustment('offsetY', Number(event.target.value))}
                    />
                  </label>
                </div>
              )}
            </label>
            <label>Prénom *<input name="first_name" value={form.first_name} onChange={updateField} maxLength="100" autoComplete="off" required /></label>
            <label>Nom *<input name="last_name" value={form.last_name} onChange={updateField} maxLength="100" autoComplete="off" required /></label>

            {(isStudent || isTeacher) && (
              <label>Date de naissance *<input name="birth_date" type="date" value={form.birth_date} onChange={updateField} required /></label>
            )}
            {isStudent && <label>Lieu de naissance<input name="birth_place" value={form.birth_place} onChange={updateField} maxLength="150" autoComplete="off" /></label>}

            <label>
              Sexe *
              <select name="gender" value={form.gender} onChange={updateField} required>
                <option value="">Sélectionner</option>
                <option value="MALE">Masculin</option>
                <option value="FEMALE">Féminin</option>
              </select>
            </label>

            <label>
              Nationalité *
              <select name="nationality" value={form.nationality} onChange={updateField} required>
                <option value="">Sélectionner une nationalité</option>
                {NATIONALITIES.map(function nationalityOption(nationality) {
                  return <option key={nationality} value={nationality}>{nationality}</option>
                })}
              </select>
            </label>

            <label>Email {isEmailRequired ? '*' : '(facultatif)'}<input name="email" type="email" value={form.email} onChange={updateField} maxLength="254" autoComplete="off" required={isEmailRequired} /></label>
            <label>Téléphone {isPhoneRequired ? '*' : '(facultatif)'}<input name="phone" value={form.phone} onChange={updateField} placeholder="+224 610 70 08 00" pattern={INTERNATIONAL_PHONE_PATTERN} title="Exemple : +224 610 70 08 00" inputMode="tel" maxLength="30" autoComplete="off" required={isPhoneRequired} /></label>
            <label className="creation-compte-wide">Adresse *<input name="address" value={form.address} onChange={updateField} autoComplete="off" required /></label>
          </div>
        </section>

        {form.role && (
          <section className="creation-compte-section">
            <h2><UserRoundPlus size={19} aria-hidden="true" /> Informations {isStudent ? 'scolaires' : 'professionnelles'}</h2>
            <div className="creation-compte-grid">
              {isStudent && <label>Date d’admission *<input name="admission_date" type="date" value={form.admission_date} onChange={updateField} required /></label>}
              {(isTeacher || isAdministrator) && <label>Date d’embauche *<input name="hire_date" type="date" value={form.hire_date} onChange={updateField} required /></label>}
              {isTeacher && <label>Qualification *<input name="qualification" value={form.qualification} onChange={updateField} required /></label>}
              {isAdministrator && <label>Fonction / Poste *<input name="job_title" value={form.job_title} onChange={updateField} maxLength="100" required /></label>}
              {isGuardian && <label>Profession *<input name="occupation" value={form.occupation} onChange={updateField} maxLength="150" required /></label>}
              {isGuardian && <label>Employeur *<input name="employer" value={form.employer} onChange={updateField} maxLength="150" required /></label>}
              {isStudent && <label>Établissement précédent<input name="previous_establishment" value={form.previous_establishment} onChange={updateField} maxLength="150" autoComplete="off" /></label>}
              {isStudent && <label className="creation-compte-wide">Maladie particulière<textarea name="medical_condition" value={form.medical_condition} onChange={updateField} autoComplete="off" /></label>}
              {isStudent && (
                <label className="creation-compte-checkbox">
                  <input
                    name="is_enrolled_in_cned"
                    type="checkbox"
                    checked={form.is_enrolled_in_cned}
                    onChange={updateField}
                  />
                  <span>Inscrit au CNED</span>
                </label>
              )}
            </div>
          </section>
        )}

        <NotificationPopup
          message={errorMessage}
          type="error"
          onClose={function closeErrorMessage() {
            setErrorMessage('')
          }}
        />
        <ConfirmationPopup
          message={
            confirmationOpen
              ? 'Le mot de passe ne sera affiché qu’une seule fois, sur la page récapitulative. Pensez à le noter ou à imprimer cette page.'
              : ''
          }
          confirmLabel="Créer le compte"
          onCancel={cancelCreationConfirmation}
          onConfirm={confirmCreation}
        />
        <NotificationPopup
          message={successMessage}
          type="info"
          onClose={function closeSuccessMessage() {
            setSuccessMessage('')
          }}
        />

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
