import { useEffect, useState } from 'react'
import {
  Activity,
  ArchiveRestore,
  ArrowLeft,
  Ban,
  ChevronRight,
  Eye,
  EyeOff,
  FileClock,
  ImagePlus,
  KeyRound,
  Pencil,
  RefreshCw,
} from 'lucide-react'
import defaultPhoto from '../assets/image_phtoto_default.png'
import ConfirmationPopup from '../components/confirmation_popup.jsx'
import NotificationPopup from '../components/notification_popup.jsx'
import {
  changeAccountState,
  getAccount,
  resetAccountPassword,
  uploadAccountPhoto,
} from '../services/account_service.js'
import { generateSecurePassword } from '../services/password_generator.js'
import { formatProfileName } from '../utils/profileDisplay.js'

const ROLE_LABELS = {
  ADMIN: 'Administrateur',
  TEACHER: 'Enseignant',
  STUDENT: 'Élève',
  GUARDIAN: 'Responsable',
}

const ROLE_BADGE_CLASSES = {
  ADMIN: 'comptes-role-badge-admin',
  TEACHER: 'comptes-role-badge-teacher',
  STUDENT: 'comptes-role-badge-student',
  GUARDIAN: 'comptes-role-badge-guardian',
}

const GENDER_LABELS = {
  MALE: 'Masculin',
  FEMALE: 'Féminin',
}

const TABS = [
  { key: 'account', label: 'Informations du compte' },
  { key: 'personal', label: 'Identité personnelle' },
]

const ACCESS_RIGHTS = {
  STUDENT: [
    'Tableau de bord',
    'Consulter ses informations',
    'Consulter ses notes',
    'Consulter ses absences',
  ],
  TEACHER: ['Tableau de bord', 'Gérer ses classes', 'Saisir les notes', 'Gérer les absences'],
  ADMIN: ['Tableau de bord', 'Gestion des comptes', 'Gestion scolaire', 'Paramètres'],
  GUARDIAN: ['Tableau de bord', 'Consulter les informations de ses enfants'],
}

function isInactive(account) {
  return !account.is_active || account.archived_at !== null
}

function getInitials(firstName, lastName) {
  const first = firstName?.[0] || ''
  const last = lastName?.[0] || ''
  return (first + last).toUpperCase() || '?'
}

const DEFAULT_PHOTO = defaultPhoto

function SummaryAvatar({ photoPath }) {
  return (
    <span className="details-summary-avatar">
      <img
        src={photoPath || DEFAULT_PHOTO}
        alt=""
        onError={(e) => { e.currentTarget.src = DEFAULT_PHOTO }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </span>
  )
}

function formatDate(dateValue) {
  if (!dateValue) return '—'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR')
}

function formatDateTime(dateValue) {
  if (!dateValue) return '—'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/** Bloc "Bientôt disponible" pour les onglets/champs non encore branchés au backend. */
function ComingSoonPanel({ label }) {
  return (
    <div className="details-coming-soon">
      <p>{label} sera bientôt disponible.</p>
    </div>
  )
}

// eslint-disable-next-line no-unused-vars -- réservé aux prochains onglets
const _ComingSoonPanel = ComingSoonPanel

/** Affiche les détails complets d'un compte (US suivante). */
export default function AccountDetailsPage({ account: initialAccount, onNavigate }) {
  const [account, setAccount] = useState(
    initialAccount?.registration_number ? initialAccount : null,
  )
  const [activeTab, setActiveTab] = useState('account')
  const [editingPersonal, setEditingPersonal] = useState(false)
  const [personalForm, setPersonalForm] = useState(initialAccount?.profile || {})

  useEffect(
    function fetchAccountByIdEffect() {
      if (account !== null) return
      const accountId = initialAccount?.id
      if (!accountId) return
      async function fetchAccount() {
        try {
          const fresh = await getAccount(accountId)
          setAccount(fresh)
          setPersonalForm(fresh.profile || {})
        } catch {
          setAccount(undefined)
        }
      }
      fetchAccount()
    },
    [initialAccount?.id, account],
  )
  const [actionLoading, setActionLoading] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [personalPhoto, setPersonalPhoto] = useState(null)
  const [personalPhotoPreview, setPersonalPhotoPreview] = useState('')
  const [photoSaving, setPhotoSaving] = useState(false)
  const [passwordResetOpen, setPasswordResetOpen] = useState(false)
  const [passwordResetStep, setPasswordResetStep] = useState('password')
  const [passwordResetForm, setPasswordResetForm] = useState({
    newPassword: '',
    passwordConfirmation: '',
    adminPassword: '',
  })
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordResetLoading, setPasswordResetLoading] = useState(false)

  function handleBackNavigation() {
    onNavigate('accounts')
  }

  function startPersonalEditing() {
    setPersonalForm(account.profile || {})
    setPersonalPhoto(null)
    setPersonalPhotoPreview(account.profile?.photo_path || '')
    setEditingPersonal(true)
  }

  function cancelPersonalEditing() {
    if (personalPhoto && personalPhotoPreview) {
      URL.revokeObjectURL(personalPhotoPreview)
    }
    setPersonalForm(account.profile || {})
    setPersonalPhoto(null)
    setPersonalPhotoPreview('')
    setEditingPersonal(false)
  }

  function selectPersonalPhoto(event) {
    const selectedPhoto = event.target.files?.[0] || null
    if (!selectedPhoto) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedPhoto.type)) {
      setActionError('La photo doit être au format JPEG, PNG ou WebP.')
      event.target.value = ''
      return
    }
    if (selectedPhoto.size > 5 * 1024 * 1024) {
      setActionError('La photo doit avoir une taille maximale de 5 Mo.')
      event.target.value = ''
      return
    }
    if (personalPhoto && personalPhotoPreview) {
      URL.revokeObjectURL(personalPhotoPreview)
    }
    setPersonalPhoto(selectedPhoto)
    setPersonalPhotoPreview(URL.createObjectURL(selectedPhoto))
  }

  async function savePersonalPhoto() {
    if (!personalPhoto) return
    setPhotoSaving(true)
    setActionError('')
    try {
      const updatedAccount = await uploadAccountPhoto(account.id, personalPhoto)
      setAccount(updatedAccount)
      setActionMessage('La photo du profil a été modifiée.')
      URL.revokeObjectURL(personalPhotoPreview)
      setPersonalPhoto(null)
      setPersonalPhotoPreview('')
      setEditingPersonal(false)
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setPhotoSaving(false)
    }
  }

  function updatePersonalField(event) {
    const field = event.currentTarget.name
    const value = event.currentTarget.value
    setPersonalForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  async function runAccountAction(action, successMessage) {
    setActionLoading(action)
    setActionError('')
    try {
      const updatedAccount = await changeAccountState(account.id, action)
      setAccount(updatedAccount)
      setActionMessage(successMessage)
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setActionLoading('')
    }
  }

  function deactivateAccount() {
    setPendingAction({
      action: 'deactivate',
      message: 'Confirmer la désactivation de ce compte ?',
      confirmLabel: 'Désactiver',
      successMessage: 'Le compte a été désactivé.',
    })
  }

  function archiveAccount() {
    setPendingAction({
      action: 'archive',
      message: 'Confirmer l’archivage ? Le titulaire ne pourra plus se connecter.',
      confirmLabel: 'Archiver',
      successMessage: 'Le compte a été archivé.',
    })
  }

  function activateAccount() {
    setPendingAction({
      action: 'activate',
      message: 'Confirmer la réactivation de ce compte ?',
      confirmLabel: 'Activer',
      successMessage: 'Le compte a été activé.',
    })
  }

  function cancelAccountAction() {
    setPendingAction(null)
  }

  function confirmAccountAction() {
    const selectedAction = pendingAction
    setPendingAction(null)
    if (!selectedAction) return
    runAccountAction(selectedAction.action, selectedAction.successMessage)
  }

  function openPasswordReset() {
    setPasswordResetForm({
      newPassword: '',
      passwordConfirmation: '',
      adminPassword: '',
    })
    setPasswordResetStep('password')
    setShowNewPassword(false)
    setActionError('')
    setPasswordResetOpen(true)
  }

  function closePasswordReset() {
    if (!passwordResetLoading) setPasswordResetOpen(false)
  }

  /** Revient à la saisie du nouveau mot de passe. */
  function returnToPasswordStep() {
    setPasswordResetStep('password')
  }

  function updatePasswordResetField(event) {
    const { name, value } = event.currentTarget
    setPasswordResetForm(function updateCurrentPasswordForm(currentForm) {
      return { ...currentForm, [name]: value }
    })
  }

  function generateResetPassword() {
    const generatedPassword = generateSecurePassword()
    setPasswordResetForm(function applyGeneratedPassword(currentForm) {
      return {
        ...currentForm,
        newPassword: generatedPassword,
        passwordConfirmation: generatedPassword,
      }
    })
    setShowNewPassword(true)
  }

  function toggleNewPasswordVisibility() {
    setShowNewPassword(function toggleCurrentVisibility(currentVisibility) {
      return !currentVisibility
    })
  }

  function continuePasswordReset(event) {
    event.preventDefault()
    if (passwordResetForm.newPassword !== passwordResetForm.passwordConfirmation) {
      setActionError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setActionError('')
    setPasswordResetStep('admin')
  }

  async function confirmPasswordReset(event) {
    event.preventDefault()
    setPasswordResetLoading(true)
    setActionError('')
    try {
      const updatedAccount = await resetAccountPassword(
        account.id,
        passwordResetForm.newPassword,
        passwordResetForm.adminPassword,
      )
      setAccount(updatedAccount)
      setPasswordResetOpen(false)
      setActionMessage('Le mot de passe du compte a été réinitialisé avec succès.')
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setPasswordResetLoading(false)
    }
  }

  function showTwoFactorInformation() {
    setActionMessage('L’authentification à deux facteurs sera disponible dans une prochaine version.')
  }

  if (account === null || account === undefined) {
    return (
      <main className="comptes-main">
        <p className="comptes-error" role="alert">
          {account === undefined ? 'Compte introuvable.' : 'Chargement du compte…'}
        </p>
      </main>
    )
  }

  const profile = account.profile || {}
  const fullName = formatProfileName(profile.first_name, profile.last_name, profile.gender)
  const inactive = isInactive(account)
  const qualificationLabel = account.role === 'TEACHER' ? 'Spécialité / Qualification' : 'Fonction'
  const qualificationValue =
    account.role === 'TEACHER' ? profile.qualification : profile.job_title
  const canShowPersonalIdentity = account.role === 'ADMIN'
  const visibleActiveTab =
    activeTab === 'personal' && !canShowPersonalIdentity ? 'account' : activeTab

  return (
    <main className="comptes-main">
      <header className="details-heading">
        <div className="details-heading-top">
          <button
            type="button"
            className="details-back-button"
            onClick={handleBackNavigation}
            aria-label="Retour"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
          <div>
            <h1 className="comptes-title">Détails du compte</h1>
            <nav className="comptes-breadcrumb" aria-label="Fil d’Ariane">
              <button type="button" onClick={handleBackNavigation}>Accueil</button>
              <ChevronRight aria-hidden="true" size={14} />
              <button type="button" onClick={handleBackNavigation}>Comptes</button>
              <ChevronRight aria-hidden="true" size={14} />
              <span className="comptes-breadcrumb-current">Détails du compte</span>
            </nav>
          </div>
        </div>
      </header>

      <section className="details-summary-card">
        <div className="details-summary-identity">
          <SummaryAvatar photoPath={profile?.photo_path} />
          <div>
            <h2>{fullName}</h2>
            <span
              className={`comptes-status ${
                inactive ? 'comptes-status-inactive' : 'comptes-status-active'
              }`}
            >
              <span className="comptes-status-dot" aria-hidden="true" />
              {inactive ? 'Inactif' : 'Actif'}
            </span>
          </div>
        </div>

        <dl className="details-summary-facts">
          <div>
            <dt>Matricule</dt>
            <dd>{account.registration_number}</dd>
          </div>
          <div>
            <dt>Rôle</dt>
            <dd>{ROLE_LABELS[account.role] || account.role}</dd>
          </div>
          <div>
            <dt>Date de création</dt>
            <dd>{formatDate(account.created_at)}</dd>
          </div>
        </dl>
      </section>

      <nav className="details-tabs" aria-label="Sections du compte">
        {TABS.filter((tab) => tab.key !== 'personal' || canShowPersonalIdentity).map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`details-tab ${visibleActiveTab === tab.key ? 'details-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            aria-current={visibleActiveTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {visibleActiveTab === 'account' && (
        <>
          <section className="details-account-grid">
            <article className="details-account-column">
              <h3>Informations du compte</h3>
              <dl>
                <div><dt>Matricule</dt><dd>{account.registration_number}</dd></div>
                <div><dt>Rôle</dt><dd>{ROLE_LABELS[account.role] || account.role}</dd></div>
                <div><dt>Statut</dt><dd>{inactive ? 'Inactif' : 'Actif'}</dd></div>
                <div><dt>Date de création</dt><dd>{formatDate(account.created_at)}</dd></div>
                <div><dt>Compte archivé</dt><dd>{account.archived_at ? 'Oui' : 'Non'}</dd></div>
                <div><dt>Archivé le</dt><dd>{formatDateTime(account.archived_at)}</dd></div>
              </dl>
            </article>

            <article className="details-account-column details-account-actions">
              <h3>Actions</h3>
              <div className="details-account-action-list">
                {account.is_active && !account.archived_at && (
                  <button
                    type="button"
                    className="details-account-action-danger"
                    onClick={deactivateAccount}
                    disabled={actionLoading !== ''}
                  >
                    <Ban aria-hidden="true" size={16} />
                    Désactiver
                  </button>
                )}
                {!account.archived_at && (
                  <button
                    type="button"
                    className="details-account-action-warning"
                    onClick={archiveAccount}
                    disabled={actionLoading !== ''}
                  >
                    <FileClock aria-hidden="true" size={16} />
                    Archiver
                  </button>
                )}
                {(!account.is_active || account.archived_at) && (
                  <button
                    type="button"
                    className="details-account-action-success"
                    onClick={activateAccount}
                    disabled={actionLoading !== ''}
                  >
                    {account.archived_at ? (
                      <ArchiveRestore aria-hidden="true" size={16} />
                    ) : (
                      <Activity aria-hidden="true" size={16} />
                    )}
                    {account.archived_at ? 'Désarchiver' : 'Activer'}
                  </button>
                )}
              </div>
            </article>

            <article className="details-account-column">
              <div className="details-account-column-heading">
                <h3>Droits d’accès</h3>
                <span>Indisponible en V1</span>
              </div>
              <ul className="details-access-rights">
                {(ACCESS_RIGHTS[account.role] || []).map((right) => (
                  <li key={right}>
                    <span>{right}</span>
                    <strong>Autorisé</strong>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="details-panel details-account-security">
            <h3>Sécurité du compte</h3>
            <ul className="details-security-list">
              <li>
                <span>Mot de passe</span>
                <span className="details-security-value">
                  <span className="details-password-dots">••••••••••••</span>
                  <button type="button" className="details-mini-button" onClick={openPasswordReset}>
                    Réinitialiser
                  </button>
                </span>
              </li>
              <li>
                <span>Authentification à deux facteurs</span>
                <span className="details-security-value">
                  {account.two_factor_enabled ? 'Activée' : 'Non activée'}
                  <button type="button" className="details-mini-button" onClick={showTwoFactorInformation}>
                    {account.two_factor_enabled ? 'Désactiver' : 'Activer'}
                  </button>
                </span>
              </li>
            </ul>
          </section>

          {account.role === 'STUDENT' && (
            <section className="details-linked-card">
              <h3>Informations liées</h3>
              <div>
                <p><span>Élève</span><strong>{fullName}</strong></p>
                <p><span>Classe actuelle</span><strong>{profile.class_name || '—'}</strong></p>
                <p><span>Année scolaire</span><strong>{profile.school_year_name || '—'}</strong></p>
              </div>
            </section>
          )}
        </>
      )}

      {visibleActiveTab === 'personal' && canShowPersonalIdentity && (
        <section className="details-panel sdp-view">
          <div className="sdp-section-heading">
            <h2>Informations personnelles</h2>
            {!editingPersonal && (
              <button type="button" className="sdp-btn-outline" onClick={startPersonalEditing}>
                <Pencil aria-hidden="true" size={16} />
                Modifier
              </button>
            )}
          </div>
          {editingPersonal ? (
            <div className="sdp-form">
              <label className="sdp-photo-edit">
                Photo de profil
                <span>
                  {personalPhotoPreview ? (
                    <img src={personalPhotoPreview} alt="Aperçu de la photo du profil" />
                  ) : (
                    <ImagePlus aria-hidden="true" size={26} />
                  )}
                  <strong>Choisir une nouvelle photo</strong>
                  <small>JPEG, PNG ou WebP — 5 Mo maximum</small>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={selectPersonalPhoto}
                  />
                </span>
              </label>
              <div className="sdp-row">
                <label>Nom<input name="last_name" value={personalForm.last_name || ''} onChange={updatePersonalField} /></label>
                <label>Prénom<input name="first_name" value={personalForm.first_name || ''} onChange={updatePersonalField} /></label>
                <label>
                  Sexe
                  <select name="gender" value={personalForm.gender || ''} onChange={updatePersonalField}>
                    <option value="">—</option>
                    <option value="FEMALE">Féminin</option>
                    <option value="MALE">Masculin</option>
                  </select>
                </label>
              </div>
              <div className="sdp-row">
                <label>Date de naissance<input type="date" name="birth_date" value={personalForm.birth_date || ''} onChange={updatePersonalField} /></label>
                <label>Lieu de naissance<input name="birth_place" value={personalForm.birth_place || ''} onChange={updatePersonalField} /></label>
                <label>Nationalité<input name="nationality" value={personalForm.nationality || ''} onChange={updatePersonalField} /></label>
              </div>
              <div className="sdp-row">
                <label>Téléphone<input name="phone" value={personalForm.phone || ''} onChange={updatePersonalField} /></label>
                <label>Email<input type="email" name="email" value={personalForm.email || personalForm.personal_email || ''} onChange={updatePersonalField} /></label>
              </div>
              <label className="sdp-full">Adresse<input name="address" value={personalForm.address || ''} onChange={updatePersonalField} /></label>
              <div className="sdp-form-actions">
                <button type="button" className="sdp-btn-outline" onClick={cancelPersonalEditing}>Annuler</button>
                <button
                  type="button"
                  className="sdp-btn-primary"
                  onClick={savePersonalPhoto}
                  disabled={!personalPhoto || photoSaving}
                >
                  {photoSaving ? 'Enregistrement…' : 'Enregistrer la photo'}
                </button>
              </div>
            </div>
          ) : (
            <div className="sdp-personal-grid">
              <section>
                <h3>Informations d’identité</h3>
                <dl>
                  <div><dt>Nom</dt><dd>{profile.last_name || '—'}</dd></div>
                  <div><dt>Prénom</dt><dd>{profile.first_name || '—'}</dd></div>
                  <div><dt>Sexe</dt><dd>{GENDER_LABELS[profile.gender] || '—'}</dd></div>
                  <div><dt>Date de naissance</dt><dd>{formatDate(profile.birth_date)}</dd></div>
                  <div><dt>Lieu de naissance</dt><dd>{profile.birth_place || '—'}</dd></div>
                  <div><dt>Nationalité</dt><dd>{profile.nationality || '—'}</dd></div>
                  <div><dt>{qualificationLabel}</dt><dd>{qualificationValue || '—'}</dd></div>
                  <div><dt>Date d’embauche</dt><dd>{formatDate(profile.hire_date)}</dd></div>
                </dl>
              </section>

              <section>
                <h3>Informations de contact</h3>
                <dl>
                  <div><dt>Adresse</dt><dd>{profile.address || '—'}</dd></div>
                  <div><dt>Téléphone</dt><dd>{profile.phone || '—'}</dd></div>
                  <div><dt>Email</dt><dd>{profile.email || profile.personal_email || '—'}</dd></div>
                </dl>
              </section>
            </div>
          )}
        </section>
      )}

      {passwordResetOpen && (
        <div className="details-password-reset-overlay" role="presentation">
          <section
            className="details-password-reset-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="details-password-reset-title"
          >
            <header>
              <span><KeyRound aria-hidden="true" size={22} /></span>
              <div>
                <h2 id="details-password-reset-title">Réinitialiser le mot de passe</h2>
                <p>
                  {passwordResetStep === 'password'
                    ? `Définissez le nouveau mot de passe de ${account.registration_number}.`
                    : 'Confirmez cette opération sensible avec votre mot de passe administrateur.'}
                </p>
              </div>
            </header>

            {passwordResetStep === 'password' ? (
              <form onSubmit={continuePasswordReset}>
                <label>
                  Nouveau mot de passe
                  <span className="details-password-reset-input">
                    <input
                      name="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordResetForm.newPassword}
                      onChange={updatePasswordResetField}
                      minLength="8"
                      maxLength="128"
                      autoComplete="new-password"
                      required
                    />
                    <button type="button" onClick={toggleNewPasswordVisibility} aria-label="Afficher ou masquer le mot de passe">
                      {showNewPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                    </button>
                  </span>
                </label>
                <button type="button" className="details-password-generate" onClick={generateResetPassword}>
                  <RefreshCw aria-hidden="true" size={17} />
                  Générer un mot de passe
                </button>
                <label>
                  Confirmer le mot de passe
                  <input
                    name="passwordConfirmation"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordResetForm.passwordConfirmation}
                    onChange={updatePasswordResetField}
                    minLength="8"
                    maxLength="128"
                    autoComplete="new-password"
                    required
                  />
                </label>
                <small>8 caractères minimum. Le mot de passe généré respecte les règles de création des comptes.</small>
                <footer>
                  <button type="button" className="details-password-cancel" onClick={closePasswordReset}>Annuler</button>
                  <button type="submit" className="details-password-confirm">Continuer</button>
                </footer>
              </form>
            ) : (
              <form onSubmit={confirmPasswordReset}>
                <label>
                  Votre mot de passe administrateur
                  <input
                    name="adminPassword"
                    type="password"
                    value={passwordResetForm.adminPassword}
                    onChange={updatePasswordResetField}
                    autoComplete="current-password"
                    required
                    autoFocus
                  />
                </label>
                <footer>
                  <button
                    type="button"
                    className="details-password-cancel"
                    onClick={returnToPasswordStep}
                  >
                    Retour
                  </button>
                  <button type="submit" className="details-password-confirm" disabled={passwordResetLoading}>
                    {passwordResetLoading ? 'Vérification…' : 'Confirmer la réinitialisation'}
                  </button>
                </footer>
              </form>
            )}
          </section>
        </div>
      )}

      <NotificationPopup
        message={actionError}
        type="error"
        onClose={function closeActionError() {
          setActionError('')
        }}
      />
      <NotificationPopup
        message={actionMessage}
        type="info"
        onClose={function closeActionMessage() {
          setActionMessage('')
        }}
      />
      <ConfirmationPopup
        message={pendingAction?.message}
        confirmLabel={pendingAction?.confirmLabel}
        onCancel={cancelAccountAction}
        onConfirm={confirmAccountAction}
      />

      {activeTab === 'roles' && (
        <section className="details-panels">
          <div className="details-panel">
            <ComingSoonPanel label="La gestion des rôles et permissions" />
          </div>
        </section>
      )}

      {activeTab === 'classes' && (
        <section className="details-panels">
          <div className="details-panel">
            <ComingSoonPanel label="L'affichage des classes et matières" />
          </div>
        </section>
      )}

      {activeTab === 'activity' && (
        <section className="details-panels">
          <div className="details-panel">
            <ComingSoonPanel label="L'activité récente" />
          </div>
        </section>
      )}

      {activeTab === 'journal' && (
        <section className="details-panels">
          <div className="details-panel">
            <ComingSoonPanel label="Le journal des actions" />
          </div>
        </section>
      )}
    </main>
  )
}
