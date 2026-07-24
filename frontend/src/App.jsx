import { useEffect, useState } from 'react'

import HomePage from './pages/home_page.jsx'
import LoginPage from './pages/login_page.jsx'
import { getCurrentAccount } from './services/auth_service.js'

/**
 * Composant racine de l'application React.
 */
export default function App() {
  const [currentAccount, setCurrentAccount] = useState(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)

  /**
   * Recherche une session existante au premier affichage.
   */
  useEffect(function restoreSessionEffect() {
    async function restoreSession() {
      try {
        const account = await getCurrentAccount()
        setCurrentAccount(account)
      } catch {
        setCurrentAccount(null)
      } finally {
        setIsSessionLoading(false)
      }
    }

    restoreSession()
  }, [])

  /**
   * Enregistre le compte retourné après une connexion réussie.
   */
  function handleLoginSuccess(account) {
    setCurrentAccount(account)
  }

  /**
   * Retourne à la page de connexion après la déconnexion.
   */
  function handleLogoutSuccess() {
    setCurrentAccount(null)
  }

  if (isSessionLoading) {
    return (
      <main className="application-loading">
        Vérification de la session…
      </main>
    )
  }

  if (currentAccount) {
    return (
      <HomePage
        account={currentAccount}
        onLogoutSuccess={handleLogoutSuccess}
      />
    )
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />
}
