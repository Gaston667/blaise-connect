import { useState } from 'react'
import {
  Activity,
  ArrowLeft,
  Ban,
  ChevronRight,
  FileClock,
  Pencil,
} from 'lucide-react'

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
  const [activeTab, setActiveTab] = useState('account')
  const [editingPersonal, setEditingPersonal] = useState(false)
  const [personalForm, setPersonalForm] = useState(account?.profile || {})

  function handleBackNavigation() {
    onNavigate('accounts')
  }

  function startPersonalEditing() {
    setPersonalForm(account.profile || {})
    setEditingPersonal(true)
  }

  function cancelPersonalEditing() {
    setPersonalForm(account.profile || {})
    setEditingPersonal(false)
  }

  function updatePersonalField(event) {
    const field = event.currentTarget.name
    const value = event.currentTarget.value
    setPersonalForm((currentForm) => ({ ...currentForm, [field]: value }))
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
          <span className="details-summary-avatar">
            {getInitials(profile.first_name, profile.last_name)}
          </span>
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
          <div>
            <dt>Créé par</dt>
            <dd>{account.created_by_name || '—'}</dd>
          </div>
          <div>
            <dt>Dernière connexion</dt>
            <dd>{formatDateTime(account.last_login_at)}</dd>
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
                <div><dt>Créé par</dt><dd>{account.created_by_name || '—'}</dd></div>
                <div><dt>Dernière connexion</dt><dd>{formatDateTime(account.last_login_at)}</dd></div>
              </dl>
            </article>

            <article className="details-account-column">
              <h3>Statut du compte</h3>
              <dl>
                <div><dt>Compte verrouillé</dt><dd>{locked ? 'Oui' : 'Non'}</dd></div>
                <div><dt>Verrouillé jusqu’au</dt><dd>{formatDateTime(account.locked_until)}</dd></div>
                <div><dt>Compte archivé</dt><dd>{account.archived_at ? 'Oui' : 'Non'}</dd></div>
                <div><dt>Archivé le</dt><dd>{formatDateTime(account.archived_at)}</dd></div>
              </dl>
            </article>

            <article className="details-account-column details-account-actions">
              <h3>Actions</h3>
              <button type="button" className="details-account-action-danger" disabled>
                <Ban aria-hidden="true" size={18} />
                <span>Désactiver<small>Empêche la connexion</small></span>
              </button>
              <button type="button" className="details-account-action-warning" disabled>
                <FileClock aria-hidden="true" size={18} />
                <span>Archiver<small>Conserve les données sans accès</small></span>
              </button>
              <button type="button" className="details-account-action-success" disabled>
                <Activity aria-hidden="true" size={18} />
                <span>Activer<small>Rétablit l’accès au compte</small></span>
              </button>
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
                <button type="button" className="sdp-btn-primary" disabled>Enregistrer</button>
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
