import { LogOut } from 'lucide-react'
import { useState } from 'react'

import { logout } from '../services/auth_service.js'

/**
 * Ferme la session de l'utilisateur connecté.
 */
export default function LogoutButton({
  onLogoutSuccess,
  variant = 'sidebar',
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const buttonClassName = variant === 'menu'
    ? 'user-menu-logout'
    : 'layout-logout'

  /**
   * Révoque la session côté backend puis retourne à la connexion.
   */
  async function handleLogout() {
    setErrorMessage('')
    setIsLoading(true)

    try {
      await logout()
      onLogoutSuccess()
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'La déconnexion a échoué.'

      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="layout-logout-wrapper">
      {errorMessage ? (
        <p
          className="layout-logout-error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <button
        className={buttonClassName}
        type="button"
        onClick={handleLogout}
        disabled={isLoading}
      >
        <LogOut aria-hidden="true" size={20} />
        {isLoading ? 'Déconnexion…' : 'Déconnexion'}
      </button>
    </div>
  )
}
