import { useState } from 'react'
import {
  Activity,
  ArrowLeft,
  Ban,
  ChevronRight,
  Clock,
  FileClock,
  Key,
  Mail,
  Pencil,
  Phone,
  Trash2,
} from 'lucide-react'

const ROLE_LABELS = {
  ADMIN: 'Administrateur',
  TEACHER: 'Enseignant',
}

const ROLE_BADGE_CLASSES = {
  ADMIN: 'comptes-role-badge-admin',
  TEACHER: 'comptes-role-badge-teacher',
}

const GENDER_LABELS = {
  MALE: 'Masculin',
  FEMALE: 'Féminin',
}

const TABS = [
  { key: 'personal', label: 'Informations personnelles' },
  { key: 'roles', label: 'Rôles et permissions' },
  { key: 'classes', label: 'Classes et matières' },
  { key: 'activity', label: 'Activité récente' },
  { key: 'journal', label: 'Journal des actions' },
]

function isInactive(account) {
  return !account.is_active || account.archived_at !== null
}

function isLocked(account) {
  if (!account.locked_until) return false
  return new Date(account.locked_until).getTime() > Date.now()
}

function getInitials(firstName, lastName) {
  const first = firstName?.[0] || ''
  const last = lastName?.[0] || ''
  return (first + last).toUpperCase() || '?'
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

/** Affiche les détails complets d'un compte (US suivante). */
export default function AccountDetailsPage({ account, onNavigate }) {
  const [activeTab, setActiveTab] = useState('personal')

  function handleBackNavigation() {
    onNavigate('accounts')
  }

  if (!account) {
    return (
      <main className="comptes-main">
        <p className="comptes-error" role="alert">
          Compte introuvable.
        </p>
      </main>
    )
  }

  const profile = account.profile || {}
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Non renseigné'
  const inactive = isInactive(account)
  const locked = isLocked(account)
  const qualificationLabel = account.role === 'TEACHER' ? 'Spécialité / Qualification' : 'Fonction'
  const qualificationValue =
    account.role === 'TEACHER' ? profile.qualification : profile.job_title

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

        <div className="details-heading-actions">
          <button type="button" className="details-action-secondary" disabled>
            <Key aria-hidden="true" size={16} />
            Réinitialiser le mot de passe
          </button>
          <button type="button" className="details-action-secondary" disabled>
            <Ban aria-hidden="true" size={16} />
            Désactiver le compte
          </button>
          <button type="button" className="details-action-primary" disabled>
            <Pencil aria-hidden="true" size={16} />
            Modifier
          </button>
        </div>
      </header>

      <section className="details-summary-card">
        <div className="details-summary-identity">
          <span className="details-summary-avatar">
            {getInitials(profile.first_name, profile.last_name)}
          </span>
          <div>
            <h2>{fullName}</h2>
            <span className={`comptes-role-badge ${ROLE_BADGE_CLASSES[account.role] || ''}`}>
              {ROLE_LABELS[account.role] || account.role}
            </span>
            <p className="details-summary-line">
              <Mail aria-hidden="true" size={15} />
              {profile.email || '—'}
            </p>
            <p className="details-summary-line">
              <Phone aria-hidden="true" size={15} />
              {profile.phone || '—'}
            </p>
            <p className="details-summary-line">
              <Clock aria-hidden="true" size={15} />
              Date de création : {formatDateTime(account.created_at)}
            </p>
            <p className="details-summary-line">
              <Activity aria-hidden="true" size={15} />
              Dernière connexion : {formatDateTime(account.last_login_at)}
            </p>
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
            <dt>Identifiant (matricule)</dt>
            <dd>{account.registration_number}</dd>
          </div>
          <div>
            <dt>Rôle</dt>
            <dd>{ROLE_LABELS[account.role] || account.role}</dd>
          </div>
          <div>
            <dt>Statut</dt>
            <dd>
              <span className={inactive ? 'details-badge-danger' : 'details-badge-success'}>
                {inactive ? 'Inactif' : 'Actif'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Compte</dt>
            <dd>
              <span className={inactive ? 'details-badge-danger' : 'details-badge-success'}>
                {inactive ? 'Inactif' : 'Actif'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{profile.email || '—'}</dd>
          </div>
        </dl>
      </section>

      <nav className="details-tabs" aria-label="Sections du compte">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`details-tab ${activeTab === tab.key ? 'details-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            aria-current={activeTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'personal' && (
        <section className="details-panels">
          <div className="details-panel details-panel-form">
            <h3>Informations personnelles</h3>
            <div className="details-form-grid">
              <div className="details-field">
                <label>Prénom</label>
                <input type="text" value={profile.first_name || ''} disabled readOnly />
              </div>
              <div className="details-field">
                <label>Nom</label>
                <input type="text" value={profile.last_name || ''} disabled readOnly />
              </div>
              <div className="details-field">
                <label>Date de naissance</label>
                <input type="text" value={formatDate(profile.birth_date)} disabled readOnly />
              </div>
              <div className="details-field">
                <label>Genre</label>
                <input
                  type="text"
                  value={GENDER_LABELS[profile.gender] || 'Non renseigné'}
                  disabled
                  readOnly
                />
              </div>
              <div className="details-field">
                <label>Téléphone</label>
                <input type="text" value={profile.phone || ''} disabled readOnly />
              </div>
              <div className="details-field">
                <label>Email personnel</label>
                <input type="text" value={profile.personal_email || 'Non renseigné'} disabled readOnly />
              </div>
              <div className="details-field details-field-full">
                <label>Adresse</label>
                <input type="text" value={profile.address || ''} disabled readOnly />
              </div>
              <div className="details-field">
                <label>{qualificationLabel}</label>
                <input type="text" value={qualificationValue || ''} disabled readOnly />
              </div>
              <div className="details-field">
                <label>Date d'embauche</label>
                <input type="text" value={formatDate(profile.hire_date)} disabled readOnly />
              </div>
            </div>
          </div>

          <div className="details-panel-side">
            <div className="details-panel">
              <h3>Sécurité du compte</h3>
              <ul className="details-security-list">
                <li>
                  <span>Mot de passe</span>
                  <span className="details-security-value">
                    <span className="details-password-dots">••••••••••••</span>
                    <button type="button" className="details-mini-button" disabled>
                      Réinitialiser
                    </button>
                  </span>
                </li>
                <li>
                  <span>Authentification à deux facteurs</span>
                  <span className="details-security-value">
                    {account.two_factor_enabled ? 'Activée' : 'Non activée'}
                    <button type="button" className="details-mini-button" disabled>
                      {account.two_factor_enabled ? 'Désactiver' : 'Activer'}
                    </button>
                  </span>
                </li>
                <li>
                  <span>Tentatives de connexion échouées</span>
                  <span>{account.failed_login_attempts ?? 0}</span>
                </li>
                <li>
                  <span>Compte verrouillé</span>
                  <span>{locked ? 'Oui' : 'Non'}</span>
                </li>
              </ul>
            </div>

            <div className="details-panel">
              <h3>Actions rapides</h3>
              <ul className="details-quick-actions">
                <li>
                  <button type="button" disabled>
                    <Ban aria-hidden="true" size={16} />
                    Désactiver le compte
                    <ChevronRight aria-hidden="true" size={16} className="details-quick-action-arrow" />
                  </button>
                </li>
                <li>
                  <button type="button" disabled>
                    <FileClock aria-hidden="true" size={16} />
                    Archiver le compte
                    <ChevronRight aria-hidden="true" size={16} className="details-quick-action-arrow" />
                  </button>
                </li>
                <li>
                  <button type="button" className="details-quick-action-danger" disabled>
                    <Trash2 aria-hidden="true" size={16} />
                    Supprimer le compte
                    <ChevronRight aria-hidden="true" size={16} className="details-quick-action-arrow" />
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}

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
