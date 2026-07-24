import { LogOut, UserRound } from 'lucide-react'
import { useState } from 'react'

import logo from '../assets/logo-blaise-connect.png.png'
import { logout } from '../services/auth_service.js'

/**
 * Traduit le rôle technique pour l'interface utilisateur.
 */
function getRoleLabel(role) {
  if (role === 'ADMIN') {
    return 'Administrateur'
  }

  if (role === 'TEACHER') {
    return 'Enseignant'
  }

  return role
}

/**
 * Affiche le premier écran après une authentification réussie.
 */
export default function HomePage({ account, onLogoutSuccess }) {
  const [isLogoutLoading, setIsLogoutLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  /**
   * Ferme la session côté backend puis retourne à la connexion.
   */
  async function handleLogout() {
    setErrorMessage('')
    setIsLogoutLoading(true)

    try {
      await logout()
      onLogoutSuccess()
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'La déconnexion a échoué.'

      setErrorMessage(message)
    } finally {
      setIsLogoutLoading(false)
    }
  }

  return (
    <div className="accueil-page">
      <header className="accueil-header">
        <img
          className="accueil-logo"
          src={logo}
          alt="Logo BlaiseConnect"
        />

        <button
          className="accueil-logout"
          type="button"
          onClick={handleLogout}
          disabled={isLogoutLoading}
        >
          <LogOut aria-hidden="true" size={20} />
          {isLogoutLoading ? 'Déconnexion…' : 'Se déconnecter'}
        </button>
      </header>

      <main className="accueil-main">
        <section
          className="accueil-card"
          aria-labelledby="accueil-title"
        >
          <div className="accueil-account-icon">
            <UserRound aria-hidden="true" size={34} />
          </div>

          <p className="accueil-eyebrow">Espace personnel</p>

          <h1
            id="accueil-title"
            className="accueil-title"
          >
            Bienvenue sur BlaiseConnect
          </h1>

          <p className="accueil-description">
            Votre authentification a réussi. Vous pouvez maintenant accéder
            aux fonctionnalités autorisées par votre rôle.
          </p>

          <dl className="accueil-account">
            <div className="accueil-account-row">
              <dt>Matricule</dt>
              <dd>{account.registration_number}</dd>
            </div>

            <div className="accueil-account-row">
              <dt>Rôle</dt>
              <dd>{getRoleLabel(account.role)}</dd>
            </div>
          </dl>

          {errorMessage ? (
            <p
              className="accueil-error"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  )
}
