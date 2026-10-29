import { useEffect, useState } from 'react'
import {
  BookOpen, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Compass, ContactRound,
  FileText, FolderOpen, GraduationCap, House, LifeBuoy, NotebookPen, Presentation, ShieldCheck, UserRoundX,
  Users, X,
} from 'lucide-react'

import logo from '../assets/logo-blaise-connect.png.png'

function isAccountManagementPage(page) {
  return ['accounts', 'account-details', 'account-new', 'students', 'student-details',
    'teachers', 'teacher-details', 'administrators', 'administrator-details',
    'guardians', 'guardian-details'].includes(page)
}

function NavigationButton({ page, pages = [page], currentPage, onNavigate, icon, children, disabled = false }) {
  function navigate() { onNavigate(page) }
  return <button type="button" data-page={page} onClick={navigate} disabled={disabled} title={disabled ? 'Bientôt disponible' : undefined} className={pages.includes(currentPage) ? 'layout-navigation-item layout-navigation-item-active' : 'layout-navigation-item'}>{icon}{children}{disabled ? <small className="layout-navigation-soon">Bientôt</small> : null}</button>
}

function NavigationGroupButton({ label, icon, active, onOpen }) {
  return <button type="button" onClick={onOpen} aria-haspopup="true" className={active ? 'layout-navigation-item layout-navigation-item-active layout-navigation-group-toggle' : 'layout-navigation-item layout-navigation-group-toggle'}>
    {icon}<span>{label}</span><ChevronRight aria-hidden="true" size={18} />
  </button>
}

export default function Sidebar({ account, currentPage, isOpen, onClose, onNavigate, onStartTour }) {
  const isAdmin = account.role === 'ADMIN'
  const isTeacher = account.role === 'TEACHER'
  const isStudent = account.role === 'STUDENT'
  const isGuardian = account.role === 'GUARDIAN'
  const [activeSection, setActiveSection] = useState(
    isAccountManagementPage(currentPage) ? 'accounts' : null,
  )
  const isHelpSection = activeSection === 'help'

  useEffect(function revealCurrentAccountSection() {
    if (isAccountManagementPage(currentPage)) setActiveSection('accounts')
  }, [currentPage])

  function navigate(page) { onNavigate(page); onClose() }
  function openAccountsSection() { setActiveSection('accounts') }
  function openHelpSection() { setActiveSection('help') }
  function returnToMainNavigation() { setActiveSection(null) }
  function startTour() { onStartTour?.(); onClose() }

  return <aside className={isOpen ? 'layout-sidebar layout-sidebar-open' : 'layout-sidebar'}>
    <div className="layout-sidebar-brand"><img className="layout-logo" src={logo} alt="Logo BlaiseConnect" /><button className="layout-sidebar-close" type="button" onClick={onClose} aria-label="Fermer le menu"><X size={22} /></button></div>
    <nav className="layout-navigation" aria-label="Navigation principale">
      {isHelpSection ? <>
        <button type="button" className="layout-navigation-back" onClick={returnToMainNavigation}>
          <ChevronLeft aria-hidden="true" size={18} /> Aide
        </button>
        <button type="button" className="layout-navigation-item" onClick={startTour}>
          <Compass size={20} /> Visite guidée
        </button>
      </> : activeSection === 'accounts' ? <>
        <button type="button" className="layout-navigation-back" onClick={returnToMainNavigation}>
          <ChevronLeft aria-hidden="true" size={18} /> Gestion des comptes
        </button>
        <NavigationButton page="accounts" pages={['accounts', 'account-details', 'account-new']} currentPage={currentPage} onNavigate={navigate} icon={<ContactRound size={20} />}>Comptes</NavigationButton>
        <NavigationButton page="students" pages={['students', 'student-details']} currentPage={currentPage} onNavigate={navigate} icon={<GraduationCap size={20} />}>Élèves</NavigationButton>
        <NavigationButton page="teachers" pages={['teachers', 'teacher-details']} currentPage={currentPage} onNavigate={navigate} icon={<Presentation size={20} />}>Enseignants</NavigationButton>
        <NavigationButton page="administrators" pages={['administrators', 'administrator-details']} currentPage={currentPage} onNavigate={navigate} icon={<ShieldCheck size={20} />}>Administrateurs</NavigationButton>
        <NavigationButton page="guardians" pages={['guardians', 'guardian-details']} currentPage={currentPage} onNavigate={navigate} icon={<Users size={20} />}>Responsables légaux</NavigationButton>
      </> : <>
        <NavigationButton page="home" currentPage={currentPage} onNavigate={navigate} icon={<House size={20} />}>Tableau de bord</NavigationButton>
        {isAdmin ? <NavigationGroupButton label="Gestion des comptes" icon={<ContactRound size={20} />} active={isAccountManagementPage(currentPage)} onOpen={openAccountsSection} /> : null}
        {(isAdmin || isTeacher) ? <>
          {!isAdmin ? <NavigationButton page="students" currentPage={currentPage} onNavigate={navigate} icon={<GraduationCap size={20} />}>Élèves</NavigationButton> : null}
          <NavigationButton page="school-classes" currentPage={currentPage} onNavigate={navigate} icon={<Users size={20} />}>Classes</NavigationButton>
          <NavigationButton page="subjects" currentPage={currentPage} onNavigate={navigate} icon={<BookOpen size={20} />}>Matières</NavigationButton>
          <NavigationButton page="notes" currentPage={currentPage} onNavigate={navigate} icon={<NotebookPen size={20} />}>Notes</NavigationButton>
          {isAdmin ? <NavigationButton page="attendance" currentPage={currentPage} onNavigate={navigate} icon={<UserRoundX size={20} />}>Absences</NavigationButton> : null}
        </> : null}
        {isAdmin ? <>
          <NavigationButton page="report-cards" currentPage={currentPage} onNavigate={navigate} icon={<FileText size={20} />} disabled>Bulletins</NavigationButton>
          <NavigationButton page="timetables" currentPage={currentPage} onNavigate={navigate} icon={<CalendarDays size={20} />}>Emploi du temps</NavigationButton>
          <NavigationButton page="school-years" currentPage={currentPage} onNavigate={navigate} icon={<CalendarRange size={20} />}>Années scolaires</NavigationButton>
          <NavigationGroupButton label="Aide" icon={<LifeBuoy size={20} />} active={false} onOpen={openHelpSection} />
        </> : null}
        {isStudent ? <>
          <NavigationButton page="student-grades" currentPage={currentPage} onNavigate={navigate} icon={<NotebookPen size={20} />}>Mes notes</NavigationButton>
          <NavigationButton page="student-timetable" currentPage={currentPage} onNavigate={navigate} icon={<CalendarDays size={20} />}>Mon emploi du temps</NavigationButton>
          <NavigationButton page="attendance" currentPage={currentPage} onNavigate={navigate} icon={<UserRoundX size={20} />}>Mes absences</NavigationButton>
        </> : null}
        {isGuardian ? <>
          <NavigationButton page="student-grades" currentPage={currentPage} onNavigate={navigate} icon={<NotebookPen size={20} />}>Notes</NavigationButton>
          <NavigationButton page="student-timetable" currentPage={currentPage} onNavigate={navigate} icon={<CalendarDays size={20} />}>Emploi du temps</NavigationButton>
          <NavigationButton page="attendance" currentPage={currentPage} onNavigate={navigate} icon={<UserRoundX size={20} />}>Absences et retards</NavigationButton>
          <NavigationButton page="guardian-child-record" currentPage={currentPage} onNavigate={navigate} icon={<FolderOpen size={20} />}>Dossier de l’enfant</NavigationButton>
          <NavigationButton page="guardian-report-cards" currentPage={currentPage} onNavigate={navigate} icon={<FileText size={20} />} disabled>Bulletins</NavigationButton>
        </> : null}
        {isTeacher ? <NavigationButton page="teacher-timetable" currentPage={currentPage} onNavigate={navigate} icon={<CalendarDays size={20} />}>Mon emploi du temps</NavigationButton> : null}
      </>}
    </nav>
  </aside>
}
