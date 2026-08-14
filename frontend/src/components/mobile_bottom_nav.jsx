import { CalendarDays, House, NotebookPen, UserRoundX } from 'lucide-react'

const STUDENT_TABS = [
  { page: 'home', label: 'Accueil', icon: House },
  { page: 'student-timetable', label: 'Emploi du temps', icon: CalendarDays },
  { page: 'student-grades', label: 'Notes', icon: NotebookPen },
  { page: 'attendance', label: 'Absences', icon: UserRoundX },
]

/**
 * Barre de navigation fixée en bas de l'écran sur mobile, pour l'espace élève.
 */
export default function MobileBottomNav({ account, currentPage, onNavigate }) {
  if (account?.role !== 'STUDENT') return null

  return (
    <nav className="mobile-bottom-nav" aria-label="Navigation principale">
      {STUDENT_TABS.map(function renderTab(tab) {
        const TabIcon = tab.icon
        const isActive = currentPage === tab.page
        return (
          <button
            key={tab.page}
            type="button"
            className={isActive ? 'mobile-bottom-nav__item mobile-bottom-nav__item--active' : 'mobile-bottom-nav__item'}
            onClick={() => onNavigate(tab.page)}
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
