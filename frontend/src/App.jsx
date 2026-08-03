import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import MainLayout from './layouts/main_layout.jsx'
import AccountDetailsPage from './pages/account_details_page.jsx'
import AccountCreatePage from './pages/account_create_page.jsx'
import AccountsPage from './pages/accounts_page.jsx'
import HomePage from './pages/home_page.jsx'
import GuardianDetailsPage from './pages/guardian_details_page.jsx'
import GuardiansPage from './pages/guardians_page.jsx'
import LoginPage from './pages/login_page.jsx'
import SchoolClassDetailsPage from './pages/school_class_details_page.jsx'
import SchoolClassesPage from './pages/school_classes_page.jsx'
import SchoolYearDetailsPage from './pages/school_year_details_page.jsx'
import SchoolYearsPage from './pages/school_years_page.jsx'
import StudentDetailsPage from './pages/student_details_page.jsx'
import StudentsPage from './pages/students_page.jsx'
import SubjectsPage from './pages/subjects_page.jsx'
import SubjectDetailsPage from './pages/subject_details_page.jsx'
import NotesPage from './pages/notes_page.jsx'
import AdministratorsPage from './pages/administrators_page.jsx'
import AdministratorDetailsPage from './pages/administrator_details_page.jsx'
import TeachersPage from './pages/teachers_page.jsx'
import TeacherDetailsPage from './pages/teacher_details_page.jsx'
import StudentGradesPage from './pages/student_grades_page.jsx'
import { getCurrentAccount } from './services/auth_service.js'

const PAGE_PATHS = {
  home: '/',
  accounts: '/accounts',
  'account-new': '/accounts/new',
  students: '/students',
  guardians: '/guardians',
  'school-years': '/school-years',
  'school-classes': '/school-classes',
  teachers: '/teachers',
  subjects: '/subjects',
  notes: '/notes',
  administrators: '/administrators',
  'student-grades': '/my-grades',
}

/**
 * Déduit la section active à partir de l'URL affichée par le navigateur.
 */
function getCurrentPage(pathname) {
  if (pathname === '/accounts/new') return 'account-new'
  if (/^\/accounts\/[^/]+$/.test(pathname)) return 'account-details'
  if (/^\/students\/[^/]+$/.test(pathname)) return 'student-details'
  if (/^\/guardians\/[^/]+$/.test(pathname)) return 'guardian-details'
  if (/^\/school-years\/[^/]+$/.test(pathname)) return 'school-year-details'
  if (/^\/school-classes\/[^/]+$/.test(pathname)) return 'school-class-details'
  if (/^\/teachers\/[^/]+$/.test(pathname)) return 'teacher-details'
  if (/^\/subjects\/[^/]+$/.test(pathname)) return 'subject-details'
  if (/^\/administrators\/[^/]+$/.test(pathname)) return 'administrator-details'
  if (pathname === '/accounts') return 'accounts'
  if (pathname === '/students') return 'students'
  if (pathname === '/guardians') return 'guardians'
  if (pathname === '/school-years') return 'school-years'
  if (pathname === '/school-classes') return 'school-classes'
  if (pathname === '/teachers') return 'teachers'
  if (pathname === '/subjects') return 'subjects'
  if (pathname === '/notes') return 'notes'
  if (pathname === '/administrators') return 'administrators'
  if (pathname === '/my-grades') return 'student-grades'
  return 'home'
}

/**
 * Construit une URL stable pour une page et son éventuelle ressource.
 */
function getNavigationPath(page, entity) {
  const entityId = typeof entity === 'string' ? entity : entity?.id
  if (page === 'account-details' && entityId) return `/accounts/${entityId}`
  if (page === 'student-details' && entityId) return `/students/${entityId}`
  if (page === 'guardian-details' && entityId) return `/guardians/${entityId}`
  if (page === 'school-year-details' && entityId) return `/school-years/${entityId}`
  if (page === 'school-class-details' && entityId) return `/school-classes/${entityId}`
  if (page === 'teacher-details' && entityId) return `/teachers/${entityId}`
  if (page === 'subject-details' && entityId) return `/subjects/${entityId}`
  if (page === 'administrator-details' && entityId) return `/administrators/${entityId}`
  return PAGE_PATHS[page] || '/'
}

/**
 * Extrait l'identifiant placé à la fin de l'URL.
 */
function getPathId(pathname) {
  const pathParts = pathname.split('/').filter(Boolean)
  return pathParts.at(-1) || null
}

/**
 * Composant racine de l'application React.
 */
export default function App() {
  const [currentAccount, setCurrentAccount] = useState(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()
  const currentPage = getCurrentPage(location.pathname)
  const selectedEntity = location.state?.entity || null
  const pathId = getPathId(location.pathname)

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
   * Enregistre la session et remplace la page de connexion par l'accueil.
   */
  function handleLoginSuccess(account) {
    setCurrentAccount(account)
    navigate('/', { replace: true })
  }

  /**
   * Supprime la session locale et affiche la page de connexion.
   */
  function handleLogoutSuccess() {
    setCurrentAccount(null)
    navigate('/login', { replace: true })
  }

  /**
   * Traduit l'ancien contrat de navigation des composants en navigation URL.
   */
  function handleNavigate(page, entity) {
    const pagesReservedToAdmin = [
      'accounts',
      'account-details',
      'account-new',
      'students',
      'student-details',
      'school-years',
      'school-year-details',
      'guardians',
      'guardian-details',
      'school-classes',
      'school-class-details',
      'teachers',
      'teacher-details',
      'subjects',
      'subject-details',
      'notes',
      'administrators',
      'administrator-details',
    ]

    if (pagesReservedToAdmin.includes(page) && currentAccount?.role !== 'ADMIN') {
      navigate('/')
      return
    }

    navigate(getNavigationPath(page, entity), {
      state: entity ? { entity } : null,
    })
  }

  if (isSessionLoading) {
    return <main className="application-loading">Vérification de la session…</main>
  }

  if (!currentAccount) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  const canManageSchool = currentAccount.role === 'ADMIN'
  let pageContent = <HomePage account={currentAccount} />

  if (currentPage === 'students' && canManageSchool) {
    pageContent = <StudentsPage onNavigate={handleNavigate} />
  } else if (currentPage === 'guardians' && canManageSchool) {
    pageContent = <GuardiansPage onNavigate={handleNavigate} />
  } else if (currentPage === 'student-details' && canManageSchool) {
    pageContent = (
      <StudentDetailsPage
        student={selectedEntity || { id: pathId }}
        onNavigate={handleNavigate}
      />
    )
  } else if (currentPage === 'guardian-details' && canManageSchool) {
    pageContent = (
      <GuardianDetailsPage
        guardian={selectedEntity || { id: pathId }}
        onNavigate={handleNavigate}
      />
    )
  } else if (currentPage === 'accounts' && canManageSchool) {
    pageContent = <AccountsPage onNavigate={handleNavigate} />
  } else if (currentPage === 'account-new' && canManageSchool) {
    pageContent = <AccountCreatePage onNavigate={handleNavigate} />
  } else if (currentPage === 'account-details' && canManageSchool) {
    pageContent = (
      <AccountDetailsPage
        account={selectedEntity || { id: pathId }}
        onNavigate={handleNavigate}
      />
    )
  } else if (currentPage === 'school-classes' && canManageSchool) {
    pageContent = <SchoolClassesPage onNavigate={handleNavigate} />
  } else if (currentPage === 'school-class-details' && canManageSchool) {
    pageContent = (
      <SchoolClassDetailsPage
        schoolClass={selectedEntity || { id: pathId }}
        onNavigate={handleNavigate}
      />
    )
  } else if (currentPage === 'school-years' && canManageSchool) {
    pageContent = <SchoolYearsPage onNavigate={handleNavigate} />
  } else if (currentPage === 'school-year-details' && canManageSchool) {
    pageContent = (
      <SchoolYearDetailsPage
        schoolYearId={selectedEntity?.id || selectedEntity || pathId}
        onNavigate={handleNavigate}
      />
    )
  }
  else if (currentPage === 'teachers' && canManageSchool) {
    pageContent = <TeachersPage onNavigate={handleNavigate} />
  }
  else if (currentPage === 'teacher-details' && canManageSchool) {
    pageContent = (
      <TeacherDetailsPage
        teacher={selectedEntity || { id: pathId }}
        onNavigate={handleNavigate}
      />
    )
  }
  else if (currentPage === 'subjects' && canManageSchool) {
    pageContent = <SubjectsPage onNavigate={handleNavigate} />
  }
  else if (currentPage === 'subject-details' && canManageSchool) {
    pageContent = (
      <SubjectDetailsPage
        subject={selectedEntity || { id: pathId }}
        onNavigate={handleNavigate}
      />
    )
  }
  else if (currentPage === 'notes' && canManageSchool) {
    pageContent = <NotesPage onNavigate={handleNavigate} />
  }
  else if (currentPage === 'administrators' && canManageSchool) {
    pageContent = <AdministratorsPage onNavigate={handleNavigate} />
  }
  else if (currentPage === 'administrator-details' && canManageSchool) {
    pageContent = (
      <AdministratorDetailsPage
        administrator={selectedEntity || { id: pathId }}
        onNavigate={handleNavigate}
      />
    )
  }
  else if (currentPage === 'student-grades' && currentAccount.role === 'STUDENT') {
    pageContent = <StudentGradesPage />
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
