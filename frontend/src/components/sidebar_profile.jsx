const ROLE_META = {
  ADMIN: { label: 'Administrateur', accent: 'admin' },
  TEACHER: { label: 'Enseignant', accent: 'teacher' },
  STUDENT: { label: 'Élève', accent: 'student' },
  GUARDIAN: { label: 'Responsable légal', accent: 'student' },
}

/**
 * Retourne le nom disponible sans inventer de donnée personnelle.
 */
function getDisplayName(account) {
  if (account.first_name && account.last_name) {
    return `${account.first_name} ${account.last_name}`
  }
  return account.registration_number
}

/**
 * Initiales utilisées dans l'avatar, à défaut d'une photo de profil.
 */
function getInitials(account) {
  if (account.first_name && account.last_name) {
    return `${account.first_name[0]}${account.last_name[0]}`.toUpperCase()
  }
  const source = account.registration_number || '?'
  return source.trim().slice(0, 2).toUpperCase()
}

/**
 * Carte d'identité de l'utilisateur connecté, affichée en haut de la sidebar.
 */
export default function SidebarProfile({ account }) {
  const meta = ROLE_META[account.role] ?? { label: account.role, accent: 'admin' }

  return (
    <div className={`sidebar-profile sidebar-profile--${meta.accent}`}>
      <span className="sidebar-profile__avatar">{getInitials(account)}</span>
      <div className="sidebar-profile__identity">
        <strong className="sidebar-profile__name" title={getDisplayName(account)}>
          {getDisplayName(account)}
        </strong>
        <span className="sidebar-profile__role">
          <span className="sidebar-profile__role-dot" aria-hidden="true" />
          {meta.label}
        </span>
      </div>
    </div>
  )
}
