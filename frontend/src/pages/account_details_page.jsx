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
import { reactivateStudent } from '../services/students_service.js'
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

function isInactive(account) {
  return !account.is_active || account.archived_at !== null
}

function getInitials(firstName, lastName) {
  const first = firstName?.[0] || ''
  const last = lastName?.[0] || ''
  return (first + last).toUpperCase() || '?'
}

const DEFAULT_PHOTO = defaultPhoto

function SummaryAvatar({ photoPath, disabled, onPhotoChange }) {
  return (
    <div className="details-summary-avatar">
      <img
        src={photoPath || DEFAULT_PHOTO}
        alt="Photo de profil"
        onError={(e) => { e.currentTarget.src = DEFAULT_PHOTO }}
      />
      <label
        className="details-summary-photo-edit"
        title="Modifier la photo"
        aria-label="Modifier la photo"
      >
        <Pencil aria-hidden="true" size={16} />
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled}
          onChange={onPhotoChange}
        />
      </label>
    </div>
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

/** Affiche les détails complets d'un compte (US suivante). */
export default function AccountDetailsPage({ account: initialAccount, onNavigate }) {
  const [account, setAccount] = useState(
    initialAccount?.registration_number ? initialAccount : null,
  )
  useEffect(
    function fetchAccountByIdEffect() {
      if (account !== null) return
      const accountId = initialAccount?.id
      if (!accountId) return
      async function fetchAccount() {
        try {
          const fresh = await getAccount(accountId)
          setAccount(fresh)
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
  const [passwordResetOpen, setPasswordResetOpen] = useState(false)
  const [passwordResetStep, setPasswordResetStep] = useState('password')
  const [passwordResetForm, setPasswordResetForm] = useState({
    newPassword: '',
    passwordConfirmation: '',
    adminPassword: '',
  })
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordResetLoading, setPasswordResetLoading] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)

  function handleBackNavigation() {
    onNavigate('accounts')
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

  /**
   * Un élève archivé possède un dossier et un compte archivés ensemble.
   * La route Élève restaure les deux dans une unique transaction.
   */
  async function reactivateArchivedStudentAndAccount() {
    setActionLoading('reactivate-student')
    setActionError('')
    try {
      await reactivateStudent(account.profile.id)
      const updatedAccount = await getAccount(account.id)
      setAccount(updatedAccount)
      setActionMessage('L’élève et son compte ont été réactivés.')
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
    const archivedStudent = account.role === 'STUDENT' && account.profile?.archived_at
    setPendingAction({
      action: archivedStudent ? 'reactivate-student' : 'activate',
      message: archivedStudent
        ? 'Confirmer la réactivation de l’élève et de son compte ? L’élève ne sera pas automatiquement réinscrit dans une classe.'
        : 'Confirmer la réactivation de ce compte ?',
      confirmLabel: archivedStudent ? 'Réactiver l’élève' : 'Activer',
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
    if (selectedAction.action === 'reactivate-student') {
      reactivateArchivedStudentAndAccount()
      return
    }
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

  async function updateProfilePhoto(event) {
    const photo = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!photo) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) {
      setActionError('Choisissez une image JPG, PNG ou WebP.')
      return
    }
    if (photo.size > 5 * 1024 * 1024) {
      setActionError('La photo doit peser au maximum 5 Mo.')
      return
    }

    setPhotoUploading(true)
    setActionError('')
    try {
      await uploadAccountPhoto(account.id, photo)
      const updatedAccount = await getAccount(account.id)
      setAccount(updatedAccount)
      setActionMessage('La photo de profil a été mise à jour.')
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setPhotoUploading(false)
    }
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
  const profilePageByRole = {
    ADMIN: 'administrator-details',
    TEACHER: 'teacher-details',
    STUDENT: 'student-details',
    GUARDIAN: 'guardian-details',
  }

  function openProfile() {
    const profilePage = profilePageByRole[account.role]
    if (profilePage && profile.id) onNavigate(profilePage, profile.id)
  }

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
          <SummaryAvatar
            photoPath={profile?.photo_path}
            disabled={photoUploading}
            onPhotoChange={updateProfilePhoto}
          />
          <div>
            <h2>{fullName}</h2>
            {profilePageByRole[account.role] && profile.id && (
              <button type="button" className="details-summary-profile-link" onClick={openProfile}>
                Voir la fiche d’identité
              </button>
            )}
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

      <section aria-label="Informations du compte">
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
                    {account.archived_at && account.role === 'STUDENT' && account.profile?.archived_at
                      ? 'Réactiver l’élève et son compte'
                      : account.archived_at ? 'Désarchiver' : 'Activer'}
                  </button>
                )}
              </div>
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
      </section>

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

    </main>
  )
}
