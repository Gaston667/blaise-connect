import { useEffect, useState } from 'react'
import SchoolClassesPage from './pages/school_classes_page.jsx'
import MainLayout from './layouts/main_layout.jsx'
import AccountsPage from './pages/accounts_page.jsx'
import AccountDetailsPage from './pages/account_details_page.jsx'
import HomePage from './pages/home_page.jsx'
import LoginPage from './pages/login_page.jsx'
import { getCurrentAccount } from './services/auth_service.js'
import SchoolYearsPage from './pages/school_years_page.jsx'
import SchoolYearDetailsPage from './pages/school_year_details_page.jsx'
import StudentsPage from './pages/students_page.jsx'
import StudentDetailsPage from './pages/student_details_page.jsx'
import SchoolClassDetailsPage from './pages/school_class_details_page.jsx'

/**
 * Composant racine de l'application React.
 */
export default function App() {
  const [currentAccount, setCurrentAccount] = useState(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('home')
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [selectedSchoolClass, setSelectedSchoolClass] = useState(null)
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState(null)

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
    const pagesReservedToAdmin = [
      'accounts',
      'account-details',
      'school-years',
      'school-year-details',
      'school-classes',
    ]
    if (page === 'school-class-details') {
      setSelectedSchoolClass(account)
    } 
    if (pagesReservedToAdmin.includes(page) && currentAccount?.role !== 'ADMIN') {
      setCurrentPage('home')
      return
    }

    if (page === 'account-details') {
      setSelectedAccount(account)
    }

    if (page === 'student-details') {
      setSelectedAccount(account)
    }
    

    if (page === 'school-year-details') {
      setSelectedSchoolYearId(account)
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
    if (currentPage === 'students') {
      pageContent = <StudentsPage onNavigate={handleNavigate} />
    } else if (currentPage === 'student-details' && selectedAccount) {
      pageContent = (
        <StudentDetailsPage student={selectedAccount} onNavigate={handleNavigate} />
      )
    }
    if (shouldDisplayAccounts) {
      pageContent = <AccountsPage onNavigate={handleNavigate} />
    } else if (shouldDisplayAccountDetails) {
      pageContent = (
        <AccountDetailsPage
          account={selectedAccount}
          onNavigate={handleNavigate}
        />
      )
    } else if (currentPage === 'school-classes' && canManageAccounts) {
      pageContent = <SchoolClassesPage onNavigate={handleNavigate} />
    } else if (currentPage === 'school-class-details' && canManageAccounts && selectedSchoolClass) {
      pageContent = <SchoolClassDetailsPage schoolClass={selectedSchoolClass} onNavigate={handleNavigate} />
    } else if (currentPage === 'school-years' && canManageAccounts) {
      pageContent = <SchoolYearsPage onNavigate={handleNavigate} />
    } else if (
      currentPage === 'school-year-details' &&
      canManageAccounts &&
      selectedSchoolYearId
    ) {
      pageContent = (
        <SchoolYearDetailsPage
          schoolYearId={selectedSchoolYearId}
          onNavigate={handleNavigate}
        />
      )
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
