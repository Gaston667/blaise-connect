import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import MainLayout from './layouts/main_layout.jsx'
import AccountDetailsPage from './pages/account_details_page.jsx'
import AccountCreatePage from './pages/account_create_page.jsx'
import AccountsPage from './pages/accounts_page.jsx'
import HomePage from './pages/home_page.jsx'
import AdminDashboardPage from './pages/admin_dashboard_page.jsx'
import GuardianDetailsPage from './pages/guardian_details_page.jsx'
import GuardiansPage from './pages/guardians_page.jsx'
import LoginPage from './pages/login_page.jsx'
import AboutPage from './pages/about_page.jsx'
import TuitionFeesPage from './pages/tuition_fees_page.jsx'
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
import StudentTimetablePage from './pages/student_timetable_page.jsx'
import TeacherTimetablePage from './pages/teacher_timetable_page.jsx'
import TimetableManagementPage from './pages/timetable_management_page.jsx'
import AttendancePage from './pages/attendance_page.jsx'
import AttendanceRecordDetailsPage from './pages/attendance_record_details_page.jsx'
import AppreciationsPage from './pages/appreciations_page.jsx'
import ReportCardsPage from './pages/report_cards_page.jsx'
import ReportCardDetailsPage from './pages/report_card_details_page.jsx'
import GuidedTour from './components/guided_tour.jsx'
import { ADMIN_TOUR_STEPS } from './tour/admin_tour_steps.js'
import { getCurrentAccount } from './services/auth_service.js'
import './styles/guided_tour.css'

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
  'student-timetable': '/my-timetable',
  'teacher-timetable': '/my-teaching-schedule',
  timetables: '/timetables',
  attendance: '/attendance',
  appreciations: '/appreciations',
  'report-cards': '/report-cards',
}

/**
 * Déduit la section active à partir de l'URL affichée par le navigateur.
 */
function getCurrentPage(pathname) {
  if (/^\/attendance\/records\/[^/]+$/.test(pathname)) return 'attendance-record-details'
  if (/^\/report-cards\/[^/]+$/.test(pathname)) return 'report-card-details'
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
  if (pathname === '/my-timetable') return 'student-timetable'
  if (pathname === '/my-teaching-schedule') return 'teacher-timetable'
  if (pathname === '/timetables') return 'timetables'
  if (pathname === '/attendance') return 'attendance'
  if (pathname === '/appreciations') return 'appreciations'
  if (pathname === '/report-cards') return 'report-cards'
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
  if (page === 'attendance-record-details' && entityId) return `/attendance/records/${entityId}`
  if (page === 'report-card-details' && entityId) return `/report-cards/${entityId}`
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
  const [isTourActive, setIsTourActive] = useState(false)
  const [tourStepIndex, setTourStepIndex] = useState(0)
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
   * Démarre ou reprend la visite guidée administrateur depuis le début.
   */
  function handleStartTour() {
    setTourStepIndex(0)
    setIsTourActive(true)
  }

  function handleTourNext() {
    setTourStepIndex(function increment(current) {
      return Math.min(current + 1, ADMIN_TOUR_STEPS.length - 1)
    })
  }

  function handleTourPrev() {
    setTourStepIndex(function decrement(current) {
      return Math.max(current - 1, 0)
    })
  }

  function handleTourClose() {
    setIsTourActive(false)
  }

  /**
   * Traduit l'ancien contrat de navigation des composants en navigation URL.
   */
  function handleNavigate(page, entity) {
    const pagesReservedToAdmin = [
      'accounts',
      'account-details',
      'account-new',
      'school-years',
      'school-year-details',
      'guardians',
      'guardian-details',
      'teachers',
      'teacher-details',
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

  if (location.pathname === '/about') {
    return <AboutPage />
  }

  if (location.pathname === '/tuition-fees') {
    return <TuitionFeesPage />
  }

  if (isSessionLoading) {
    return <main className="application-loading">Vérification de la session…</main>
  }

  if (!currentAccount) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  const canManageSchool = currentAccount.role === 'ADMIN'
  const canViewSchoolDirectory = ['ADMIN', 'TEACHER'].includes(currentAccount.role)
  const canManageNotes = ['ADMIN', 'TEACHER'].includes(currentAccount.role)
  let pageContent = canManageSchool
    ? <AdminDashboardPage account={currentAccount} onNavigate={handleNavigate} />
    : <HomePage account={currentAccount} onNavigate={handleNavigate} />

  if (currentPage === 'students' && canViewSchoolDirectory) {
    pageContent = <StudentsPage onNavigate={handleNavigate} />
  } else if (currentPage === 'guardians' && canManageSchool) {
    pageContent = <GuardiansPage onNavigate={handleNavigate} />
  } else if (currentPage === 'student-details' && canViewSchoolDirectory) {
    pageContent = (
      <StudentDetailsPage
        student={selectedEntity || { id: pathId }}
        onNavigate={handleNavigate}
        account={currentAccount}
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
  } else if (currentPage === 'school-classes' && canViewSchoolDirectory) {
    pageContent = <SchoolClassesPage account={currentAccount} onNavigate={handleNavigate} />
  } else if (currentPage === 'school-class-details' && canViewSchoolDirectory) {
    pageContent = (
      <SchoolClassDetailsPage
        account={currentAccount}
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
    pageContent = <TeachersPage account={currentAccount} onNavigate={handleNavigate} />
  }
  else if (currentPage === 'teacher-details' && canManageSchool) {
    pageContent = (
      <TeacherDetailsPage
        account={currentAccount}
        teacher={selectedEntity || { id: pathId }}
        onNavigate={handleNavigate}
      />
    )
  }
  else if (currentPage === 'subjects' && canViewSchoolDirectory) {
    pageContent = <SubjectsPage account={currentAccount} onNavigate={handleNavigate} />
  }
  else if (currentPage === 'subject-details' && canViewSchoolDirectory) {
    pageContent = (
      <SubjectDetailsPage
        account={currentAccount}
        subject={selectedEntity || { id: pathId }}
        onNavigate={handleNavigate}
      />
    )
  }
  else if (currentPage === 'notes' && canManageNotes) {
    pageContent = <NotesPage account={currentAccount} onNavigate={handleNavigate} initialAssessmentId={selectedEntity?.assessmentId} />
  }
  else if (currentPage === 'appreciations' && currentAccount.role === 'TEACHER') {
    pageContent = <AppreciationsPage />
  }
  else if (currentPage === 'report-cards' && canManageSchool) {
    pageContent = <ReportCardsPage onNavigate={handleNavigate} />
  }
  else if (currentPage === 'report-card-details' && canManageSchool) {
    pageContent = (
      <ReportCardDetailsPage
        reportCardId={selectedEntity?.id || selectedEntity || pathId}
        onNavigate={handleNavigate}
      />
    )
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
  else if (currentPage === 'student-timetable' && currentAccount.role === 'STUDENT') {
    pageContent = <StudentTimetablePage />
  }
  else if (currentPage === 'teacher-timetable' && currentAccount.role === 'TEACHER') {
    pageContent = <TeacherTimetablePage />
  }
  else if (currentPage === 'timetables' && canManageSchool) {
    pageContent = <TimetableManagementPage />
  }
  else if (
    currentPage === 'attendance'
    && ['ADMIN', 'STUDENT'].includes(currentAccount.role)
  ) {
    pageContent = <AttendancePage account={currentAccount} onNavigate={handleNavigate} />
  }
  else if (
    currentPage === 'attendance-record-details'
    && ['ADMIN', 'STUDENT'].includes(currentAccount.role)
  ) {
    pageContent = (
      <AttendanceRecordDetailsPage
        recordId={pathId}
        account={currentAccount}
        onNavigate={handleNavigate}
      />
    )
  }
  return (
    <>
      <MainLayout
        account={currentAccount}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogoutSuccess={handleLogoutSuccess}
        onStartTour={handleStartTour}
        isTourActive={isTourActive}
      >
        {pageContent}
      </MainLayout>

      {isTourActive && (
        <GuidedTour
          steps={ADMIN_TOUR_STEPS}
          stepIndex={tourStepIndex}
          onNavigate={handleNavigate}
          onNext={handleTourNext}
          onPrev={handleTourPrev}
          onClose={handleTourClose}
        />
      )}
    </>
  )
}
