import { CalendarDays, FileText, GraduationCap, House, Menu, NotebookPen, UserRoundX } from 'lucide-react'

const STUDENT_TABS = [
  { page: 'home', label: 'Accueil', icon: House },
  { page: 'student-timetable', label: 'Emploi du temps', icon: CalendarDays },
  { page: 'student-grades', label: 'Notes', icon: NotebookPen },
  { page: 'attendance', label: 'Absences', icon: UserRoundX },
]

const GUARDIAN_TABS = [
  { page: 'home', label: 'Accueil', icon: House },
  { page: 'student-timetable', label: 'Emploi du temps', icon: CalendarDays },
  { page: 'student-grades', label: 'Notes', icon: NotebookPen },
  { page: 'attendance', label: 'Absences', icon: UserRoundX },
  { page: 'guardian-report-cards', label: 'Bulletins', icon: FileText },
]

// Le dernier onglet « Plus » ouvre le menu complet : l'admin a trop de sections pour tenir en bas.
const MORE_TAB = { page: '__menu__', label: 'Menu', icon: Menu }

const ADMIN_TABS = [
  { page: 'home', label: 'Accueil', icon: House },
  { page: 'students', label: 'Élèves', icon: GraduationCap, matches: ['students', 'student-details'] },
  { page: 'notes', label: 'Notes', icon: NotebookPen },
  { page: 'attendance', label: 'Absences', icon: UserRoundX },
  MORE_TAB,
]

const TEACHER_TABS = [
  { page: 'home', label: 'Accueil', icon: House },
  { page: 'students', label: 'Élèves', icon: GraduationCap, matches: ['students', 'student-details'] },
  { page: 'notes', label: 'Notes', icon: NotebookPen },
  { page: 'teacher-timetable', label: 'Emploi du temps', icon: CalendarDays },
  MORE_TAB,
]

const TABS_BY_ROLE = {
  STUDENT: STUDENT_TABS,
  GUARDIAN: GUARDIAN_TABS,
  ADMIN: ADMIN_TABS,
  TEACHER: TEACHER_TABS,
}

/**
 * Barre de navigation fixée en bas de l'écran sur mobile, pour tous les rôles.
 */
export default function MobileBottomNav({ account, currentPage, onNavigate, onMenuOpen }) {
  const tabs = TABS_BY_ROLE[account?.role] ?? null
  if (!tabs) return null

  return (
    <nav className="mobile-bottom-nav" aria-label="Navigation principale">
      {tabs.map(function renderTab(tab) {
        const TabIcon = tab.icon
        const isActive = (tab.matches ?? [tab.page]).includes(currentPage)
        return (
          <button
            key={tab.page}
            type="button"
            className={isActive ? 'mobile-bottom-nav__item mobile-bottom-nav__item--active' : 'mobile-bottom-nav__item'}
            onClick={() => (tab.page === MORE_TAB.page ? onMenuOpen() : onNavigate(tab.page))}
          >
            <span className="mobile-bottom-nav__icon">
              <TabIcon aria-hidden="true" size={22} />
            </span>
            <span className="mobile-bottom-nav__label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
