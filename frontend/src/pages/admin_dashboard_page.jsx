import {
  BarChart3,
  CalendarClock,
  CircleHelp,
  ClipboardList,
  FileCheck2,
  PenLine,
  UserRoundX,
} from 'lucide-react'

import '../styles/admin_dashboard_page.css'

// Données de démonstration en attendant le branchement des vraies
// agrégations côté API (absences, évaluations, demandes, bulletins…).
const STAT_CARDS = [
  { key: 'absences', icon: UserRoundX, tone: 'orange', label: 'Absences en attente\nde justification', value: 28, linkLabel: 'Voir les absences', page: 'attendance' },
  { key: 'evaluations', icon: ClipboardList, tone: 'blue', label: 'Évaluations / notes\nincomplètes', value: 46, linkLabel: 'Voir les évaluations', page: 'notes' },
  { key: 'corrections', icon: CircleHelp, tone: 'violet', label: 'Demandes de correction\nen attente', value: 12, linkLabel: 'Voir les demandes', page: null },
  { key: 'bulletins', icon: FileCheck2, tone: 'green', label: 'Bulletins en attente\nde validation', value: 19, linkLabel: 'Voir les bulletins', page: null },
]

const CYCLE_PERFORMANCE = [
  { key: 'primaire', label: 'Moyenne Primaire', average: 13.8, weeks: [9, 11, 10, 13, 14] },
  { key: 'college', label: 'Moyenne Collège', average: 12.9, weeks: [8, 10, 9, 11, 13] },
  { key: 'lycee', label: 'Moyenne Lycée', average: 11.7, weeks: [7, 9, 8, 10, 12] },
]

const ATTENDANCE_WATCHLIST = [
  { name: 'Martin Lemaire', className: '4e B', count: 12, tone: 'blue' },
  { name: 'Sofia Da Silva', className: '5e A', count: 10, tone: 'green' },
  { name: 'Yanis Khaled', className: '3e C', count: 9, tone: 'violet' },
  { name: 'Alice Carpentier', className: '6e B', count: 8, tone: 'orange' },
  { name: 'Tom Benali', className: '2de A', count: 8, tone: 'blue' },
]

const RECENT_ACTIVITY = [
  { icon: FileCheck2, tone: 'green', text: 'Justificatif soumis par les parents de Martin Lemaire (4e B)', meta: 'Absence du 14/05/2025', when: 'Il y a 18 min' },
  { icon: CircleHelp, tone: 'violet', text: 'Demande de correction créée par Mme Durand', meta: 'Mathématiques – 3e C – Devoir du 13/05/2025', when: 'Il y a 1 h' },
  { icon: FileCheck2, tone: 'green', text: 'Bulletin validé par M. Bernard', meta: 'Classe de 2de A – 2e trimestre', when: 'Il y a 2 h' },
]

const GRADE_ENTRY_PROGRESS = { percent: 78, entered: 1248, total: 1600 }

function getInitials(name) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
}

export default function AdminDashboardPage({ onNavigate }) {
  return (
    <main className="adp-main">
      <header className="adp-header">
        <div>
          <h1>Tableau de bord</h1>
          <p>Vue d'ensemble de l'établissement</p>
        </div>
      </header>

      <section className="adp-stats-grid">
        {STAT_CARDS.map(function renderStatCard(card) {
          const Icon = card.icon
          return (
            <article key={card.key} className="adp-stat-card">
              <span className={`adp-stat-card__icon adp-stat-card__icon--${card.tone}`}>
                <Icon aria-hidden="true" size={20} />
              </span>
              <p className="adp-stat-card__label">
                {card.label.split('\n').map((line) => <span key={line}>{line}</span>)}
              </p>
              <strong className="adp-stat-card__value">{card.value}</strong>
              <button
                type="button"
                className="adp-stat-card__link"
                onClick={() => card.page && onNavigate?.(card.page)}
                disabled={!card.page}
              >
                {card.linkLabel} <span aria-hidden="true">›</span>
              </button>
            </article>
          )
        })}
      </section>

      <section className="adp-row">
        <article className="adp-panel adp-panel--performance">
          <h2><BarChart3 aria-hidden="true" size={18} /> Performance de l'établissement</h2>
          <p className="adp-panel-hint">Moyenne générale par cycle</p>

          <div className="adp-performance-grid">
            {CYCLE_PERFORMANCE.map(function renderCycle(cycle) {
              const maxWeek = 20
              return (
                <div key={cycle.key} className="adp-performance-cell">
                  <span className="adp-performance-cell__label">{cycle.label}</span>
                  <strong className="adp-performance-cell__value">
                    {cycle.average.toFixed(1).replace('.', ',')} <small>/20</small>
                  </strong>
                  <div className="adp-mini-chart">
                    <span className="adp-mini-chart__axis">20</span>
                    {cycle.weeks.map((week, index) => (
                      <span
                        key={index}
                        className={`adp-mini-chart__bar${index === cycle.weeks.length - 1 ? ' adp-mini-chart__bar--current' : ''}`}
                        style={{ height: `${(week / maxWeek) * 100}%` }}
                      />
                    ))}
                    <span className="adp-mini-chart__axis adp-mini-chart__axis--bottom">0</span>
                  </div>
                </div>
              )
            })}
          </div>

          <button type="button" className="adp-panel-link" disabled>
            Voir le détail des performances <span aria-hidden="true">›</span>
          </button>
        </article>

        <article className="adp-panel adp-panel--attendance">
          <h2><CalendarClock aria-hidden="true" size={18} /> Suivi des absences</h2>
          <p className="adp-panel-hint">Élèves à surveiller (absences répétées)</p>

          <table className="adp-attendance-table">
            <thead>
              <tr><th>Élève</th><th>Absences</th></tr>
            </thead>
            <tbody>
              {ATTENDANCE_WATCHLIST.map((student) => (
                <tr key={student.name}>
                  <td>
                    <span className="adp-student">
                      <span className={`adp-student__avatar adp-student__avatar--${student.tone}`}>
                        {getInitials(student.name)}
                      </span>
                      <span className="adp-student__info">
                        <strong>{student.name}</strong>
                        <span>{student.className}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="adp-attendance-count">{student.count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" className="adp-panel-link" onClick={() => onNavigate?.('students')}>
            Voir tous les élèves <span aria-hidden="true">›</span>
          </button>
        </article>
      </section>

      <section className="adp-row">
        <article className="adp-panel adp-panel--progress">
          <h2><PenLine aria-hidden="true" size={18} /> Progression des notes</h2>
          <p className="adp-panel-hint">Avancement de la saisie des notes pour la période en cours</p>

          <div className="adp-progress-body">
            <div
              className="adp-progress-ring"
              style={{ '--progress': `${GRADE_ENTRY_PROGRESS.percent}%` }}
            >
              <span>{GRADE_ENTRY_PROGRESS.percent}%</span>
            </div>
            <div className="adp-progress-details">
              <span>Saisie des notes : <strong>{GRADE_ENTRY_PROGRESS.percent}%</strong></span>
              <div className="adp-progress-bar">
                <span style={{ width: `${GRADE_ENTRY_PROGRESS.percent}%` }} />
              </div>
              <span className="adp-progress-count">
                {GRADE_ENTRY_PROGRESS.entered} / {GRADE_ENTRY_PROGRESS.total} évaluations saisies
              </span>
            </div>
          </div>

          <button type="button" className="adp-panel-link" onClick={() => onNavigate?.('notes')}>
            Voir le détail par matière ou classe <span aria-hidden="true">›</span>
          </button>
        </article>

        <article className="adp-panel adp-panel--activity">
          <h2><ClipboardList aria-hidden="true" size={18} /> Activité récente</h2>

          <ul className="adp-activity-list">
            {RECENT_ACTIVITY.map((item, index) => {
              const Icon = item.icon
              return (
                <li key={index}>
                  <span className={`adp-activity-list__icon adp-activity-list__icon--${item.tone}`}>
                    <Icon aria-hidden="true" size={16} />
                  </span>
                  <span className="adp-activity-list__body">
                    <strong>{item.text}</strong>
                    <span>{item.meta}</span>
                  </span>
                  <span className="adp-activity-list__when">{item.when}</span>
                </li>
              )
            })}
          </ul>

          <button type="button" className="adp-panel-link" disabled>
            Voir toute l'activité <span aria-hidden="true">›</span>
          </button>
        </article>
      </section>
    </main>
  )
}
