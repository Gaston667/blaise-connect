import { useEffect, useState } from 'react'

import MainLayout from './layouts/main_layout.jsx'
import AccountsPage from './pages/accounts_page.jsx'
import AccountDetailsPage from './pages/account_details_page.jsx'
import HomePage from './pages/home_page.jsx'
import LoginPage from './pages/login_page.jsx'
import { getCurrentAccount } from './services/auth_service.js'
import SchoolYearsPage from './pages/school_years_page.jsx'
import SchoolYearDetailsPage from './pages/school_year_details_page.jsx'

/**
 * Composant racine de l'application React.
 */
export default function App() {
  const [currentAccount, setCurrentAccount] = useState(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('home')
  const [selectedAccount, setSelectedAccount] = useState(null)

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
   * Le second paramètre est optionnel : il transporte le compte
   * sélectionné quand on navigue vers 'account-details'.
   */
  function handleNavigate(page, account) {
    const pagesReservedToAdmin = ['accounts', 'account-details', 'school-years']

    if (pagesReservedToAdmin.includes(page) && currentAccount?.role !== 'ADMIN') {
      setCurrentPage('home')
      return
    }

    if (page === 'account-details') {
      setSelectedAccount(account)
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
    const shouldDisplayAccountDetails =
      currentPage === 'account-details' && canManageAccounts && selectedAccount

    let pageContent = <HomePage account={currentAccount} />
    if (shouldDisplayAccounts) {
      pageContent = <AccountsPage onNavigate={handleNavigate} />
    } else if (shouldDisplayAccountDetails) {
      pageContent = (
        <AccountDetailsPage
          account={selectedAccount}
          onNavigate={handleNavigate}
        />
      )
    }else if (currentPage === 'school-years' && canManageAccounts) {
      pageContent = <SchoolYearsPage onNavigate={handleNavigate} />
    }

    return (
      <MainLayout
        account={currentAccount}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogoutSuccess={handleLogoutSuccess}
      >
        {pageContent}
      </MainLayout>
    )
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />
}
