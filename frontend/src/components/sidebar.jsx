import { useEffect, useState } from 'react'
import {
  BookOpen, CalendarDays, CalendarRange, ChevronDown, ContactRound,
  GraduationCap, House, NotebookPen, Presentation, ShieldCheck, UserRoundX,
  Users, X,
} from 'lucide-react'

import logo from '../assets/logo-blaise-connect.png.png'
import LogoutButton from '../pages/logout_button.jsx'
import SidebarProfile from './sidebar_profile.jsx'

function isAccountManagementPage(page) {
  return ['accounts', 'account-details', 'account-new', 'students', 'student-details',
    'teachers', 'teacher-details', 'administrators', 'administrator-details',
    'guardians', 'guardian-details'].includes(page)
}

function NavigationButton({ page, currentPage, onNavigate, icon, children }) {
  function navigate() { onNavigate(page) }
  return <button type="button" data-page={page} onClick={navigate} className={currentPage === page ? 'layout-navigation-item layout-navigation-item-active' : 'layout-navigation-item'}>{icon}{children}</button>
}

function AccountSubitem({ pages, page, label, icon, currentPage, onNavigate }) {
  function navigate() { onNavigate(page) }
  return <button type="button" data-page={page} onClick={navigate} className={pages.includes(currentPage) ? 'layout-navigation-subitem layout-navigation-subitem-active' : 'layout-navigation-subitem'}>{icon}<span>{label}</span></button>
}

function AccountNavigation({ currentPage, onNavigate, open, onToggle }) {
  return <div className="layout-navigation-group">
    <button type="button" onClick={onToggle} aria-expanded={open} className={isAccountManagementPage(currentPage) ? 'layout-navigation-item layout-navigation-item-active layout-navigation-group-toggle' : 'layout-navigation-item layout-navigation-group-toggle'}>
      <ContactRound size={20} /><span>Gestion des comptes</span><ChevronDown size={17} className={open ? 'layout-navigation-chevron layout-navigation-chevron-open' : 'layout-navigation-chevron'} />
    </button>
    {open ? <div className="layout-navigation-submenu">
      <AccountSubitem pages={['accounts', 'account-details', 'account-new']} page="accounts" label="Comptes" icon={<ContactRound size={17} />} currentPage={currentPage} onNavigate={onNavigate} />
      <AccountSubitem pages={['students', 'student-details']} page="students" label="Élèves" icon={<GraduationCap size={17} />} currentPage={currentPage} onNavigate={onNavigate} />
      <AccountSubitem pages={['teachers', 'teacher-details']} page="teachers" label="Enseignants" icon={<Presentation size={17} />} currentPage={currentPage} onNavigate={onNavigate} />
      <AccountSubitem pages={['administrators', 'administrator-details']} page="administrators" label="Administrateurs" icon={<ShieldCheck size={17} />} currentPage={currentPage} onNavigate={onNavigate} />
      <AccountSubitem pages={['guardians', 'guardian-details']} page="guardians" label="Responsables légaux" icon={<Users size={17} />} currentPage={currentPage} onNavigate={onNavigate} />
    </div> : null}
  </div>
}

export default function Sidebar({ account, currentPage, isOpen, onClose, onNavigate, onLogoutSuccess }) {
  const isAdmin = account.role === 'ADMIN'
  const isTeacher = account.role === 'TEACHER'
  const isStudent = account.role === 'STUDENT'
  const [accountsOpen, setAccountsOpen] = useState(isAccountManagementPage(currentPage))

  useEffect(function openAccountGroupOnNavigation() {
    if (isAccountManagementPage(currentPage)) setAccountsOpen(true)
  }, [currentPage])

  function navigate(page) { onNavigate(page); onClose() }
  function toggleAccounts() { setAccountsOpen(function invert(current) { return !current }) }

  return <aside className={isOpen ? 'layout-sidebar layout-sidebar-open' : 'layout-sidebar'}>
    <div className="layout-sidebar-brand"><img className="layout-logo" src={logo} alt="Logo BlaiseConnect" /><button className="layout-sidebar-close" type="button" onClick={onClose} aria-label="Fermer le menu"><X size={22} /></button></div>
    <nav className="layout-navigation" aria-label="Navigation principale">
      <NavigationButton page="home" currentPage={currentPage} onNavigate={navigate} icon={<House size={20} />}>Tableau de bord</NavigationButton>
      {isAdmin ? <AccountNavigation currentPage={currentPage} onNavigate={navigate} open={accountsOpen} onToggle={toggleAccounts} /> : null}
      {(isAdmin || isTeacher) ? <>
        {!isAdmin ? <NavigationButton page="students" currentPage={currentPage} onNavigate={navigate} icon={<GraduationCap size={20} />}>Élèves</NavigationButton> : null}
        <NavigationButton page="school-classes" currentPage={currentPage} onNavigate={navigate} icon={<Users size={20} />}>Classes</NavigationButton>
        <NavigationButton page="subjects" currentPage={currentPage} onNavigate={navigate} icon={<BookOpen size={20} />}>Matières</NavigationButton>
        <NavigationButton page="notes" currentPage={currentPage} onNavigate={navigate} icon={<NotebookPen size={20} />}>Notes</NavigationButton>
        {isAdmin ? <NavigationButton page="attendance" currentPage={currentPage} onNavigate={navigate} icon={<UserRoundX size={20} />}>Absences</NavigationButton> : null}
      </> : null}
      {isAdmin ? <>
        <NavigationButton page="timetables" currentPage={currentPage} onNavigate={navigate} icon={<CalendarDays size={20} />}>Emploi du temps</NavigationButton>
        <NavigationButton page="school-years" currentPage={currentPage} onNavigate={navigate} icon={<CalendarRange size={20} />}>Années scolaires</NavigationButton>
      </> : null}
      {isStudent ? <>
        <NavigationButton page="student-grades" currentPage={currentPage} onNavigate={navigate} icon={<NotebookPen size={20} />}>Mes notes</NavigationButton>
        <NavigationButton page="student-timetable" currentPage={currentPage} onNavigate={navigate} icon={<CalendarDays size={20} />}>Mon emploi du temps</NavigationButton>
        <NavigationButton page="attendance" currentPage={currentPage} onNavigate={navigate} icon={<UserRoundX size={20} />}>Mes absences</NavigationButton>
      </> : null}
      {isTeacher ? <NavigationButton page="teacher-timetable" currentPage={currentPage} onNavigate={navigate} icon={<CalendarDays size={20} />}>Mon emploi du temps</NavigationButton> : null}
    </nav>
    <div className="sidebar-bottom-card"><SidebarProfile account={account} /><LogoutButton onLogoutSuccess={onLogoutSuccess} /></div>
  </aside>
}
