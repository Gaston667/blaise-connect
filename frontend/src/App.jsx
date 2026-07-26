import { useEffect, useState } from 'react'

import MainLayout from './layouts/main_layout.jsx'
import AccountsPage from './pages/accounts_page.jsx'
import HomePage from './pages/home_page.jsx'
import LoginPage from './pages/login_page.jsx'
import { getCurrentAccount } from './services/auth_service.js'

/**
 * Composant racine de l'application React.
 */
export default function App() {
  const [currentAccount, setCurrentAccount] = useState(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('home')

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
    setCurrentPage('home')
  }

  /**
   * Retourne à la page de connexion après la déconnexion.
   */
  function handleLogoutSuccess() {
    setCurrentAccount(null)
    setCurrentPage('home')
  }

  /**
   * Change la page affichée dans l'espace connecté.
   */
  function handleNavigate(page) {
    if (page === 'accounts' && currentAccount?.role !== 'ADMIN') {
      setCurrentPage('home')
      return
    }

    setCurrentPage(page)
  }

  if (isSessionLoading) {
    return (
      <main className="application-loading">
        Vérification de la session…
      </main>
    )
  }

  if (currentAccount) {
    const canManageAccounts = currentAccount.role === 'ADMIN'
    const shouldDisplayAccounts =
      currentPage === 'accounts' && canManageAccounts

    return (
      <MainLayout
        account={currentAccount}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogoutSuccess={handleLogoutSuccess}
      >
        {shouldDisplayAccounts ? (
          <AccountsPage onNavigate={handleNavigate} />
        ) : (
          <HomePage account={currentAccount} />
        )}
      </MainLayout>
    )
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />
}
