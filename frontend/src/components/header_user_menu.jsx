import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import LogoutButton from '../pages/logout_button.jsx'
import '../styles/header_user_menu.css'

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
 * Identité du compte connecté, en haut à droite : un clic ouvre un petit menu
 * avec le rôle et le bouton de déconnexion.
 */
export default function HeaderUserMenu({ account, onLogoutSuccess }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const meta = ROLE_META[account.role] ?? { label: account.role, accent: 'admin' }
  const displayName = getDisplayName(account)

  useEffect(function closeOnOutsideClickOrEscape() {
    if (!isOpen) return undefined

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return function removeListeners() {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className={`header-user header-user--${meta.accent}`}>
      <button
        type="button"
        className="header-user__trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Compte de ${displayName}`}
      >
        <span className="header-user__avatar" aria-hidden="true">{getInitials(account)}</span>
        <span className="header-user__identity">
          <strong className="header-user__name">{displayName}</strong>
          <span className="header-user__role">{meta.label}</span>
        </span>
        <ChevronDown className="header-user__chevron" aria-hidden="true" size={16} />
      </button>

      {isOpen ? (
        <div className="header-user__menu" role="menu">
          <div className="header-user__menu-identity">
            <strong>{displayName}</strong>
            <span>{meta.label}</span>
          </div>
          <LogoutButton onLogoutSuccess={onLogoutSuccess} variant="menu" />
        </div>
      ) : null}
    </div>
  )
}
