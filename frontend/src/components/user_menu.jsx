import { UserRound } from 'lucide-react'
import { useState } from 'react'

import LogoutButton from './logout_button.jsx'

/**
 * Traduit le rôle technique pour l'interface utilisateur.
 */
function getRoleLabel(role) {
  if (role === 'ADMIN') {
    return 'Administrateur'
  }

  return 'Enseignant'
}

/**
 * Retourne le nom disponible sans inventer de donnée personnelle.
 */
function getDisplayName(account) {
  if (account.display_name) {
    return account.display_name
  }

  return account.registration_number
}

/**
 * Affiche les actions liées au compte connecté.
 */
export default function UserMenu({ account, onLogoutSuccess }) {
  const [isOpen, setIsOpen] = useState(false)

  /**
   * Ouvre ou ferme le menu utilisateur.
   */
  function handleMenuVisibility() {
    setIsOpen(!isOpen)
  }

  return (
    <div className="user-menu">
      <button
        className="user-menu-trigger"
        type="button"
        onClick={handleMenuVisibility}
        aria-label="Ouvrir le menu utilisateur"
        aria-expanded={isOpen}
      >
        <UserRound aria-hidden="true" size={20} />
      </button>

      {isOpen ? (
        <div className="user-menu-panel">
          <div className="user-menu-identity">
            <strong>{getDisplayName(account)}</strong>
            <span>{getRoleLabel(account.role)}</span>
          </div>

          <button
            className="user-menu-profile"
            type="button"
            disabled
            title="Le profil sera disponible dans un prochain incrément"
          >
            Accéder au profil
          </button>

          <LogoutButton
            onLogoutSuccess={onLogoutSuccess}
            variant="menu"
          />
        </div>
      ) : null}
    </div>
  )
}
