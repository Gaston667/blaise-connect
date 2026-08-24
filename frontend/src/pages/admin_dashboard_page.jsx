import { useEffect, useState } from 'react'
import {
  BarChart3,
  CalendarClock,
  CircleHelp,
  ClipboardList,
  FileCheck2,
  PenLine,
  UserRoundX,
} from 'lucide-react'

import { getAdminDashboard } from '../services/admin_dashboard_service.js'
import '../styles/admin_dashboard_page.css'

const AVATAR_PALETTE = ['blue', 'green', 'violet', 'orange']

const ACTIVITY_META = {
  justification: { icon: UserRoundX, tone: 'orange' },
  correction_request: { icon: CircleHelp, tone: 'violet' },
  report_card_validated: { icon: FileCheck2, tone: 'green' },
}

function getInitials(name) {
  return (name ?? '?').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
}

function formatDate(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

function formatRelativeTime(value) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return "À l'instant"
  if (minutes < 60) return `Il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Il y a ${hours} h`
  const days = Math.round(hours / 24)
  return `Il y a ${days} j`
}

function getActivityText(item) {
  if (item.kind === 'justification') {
    return {
      text: `Justificatif soumis pour ${item.actor_name ?? 'un élève'} (${item.context_class ?? '—'})`,
      meta: item.context_date ? `Absence du ${formatDate(item.context_date)}` : null,
    }
  }
  if (item.kind === 'correction_request') {
    return {
      text: `Demande de correction créée par ${item.actor_name ?? 'un enseignant'}`,
      meta: [item.context_subject, item.context_class, item.context_date ? `du ${formatDate(item.context_date)}` : null]
        .filter(Boolean).join(' – '),
    }
  }
  return {
    text: `Bulletin validé par ${item.actor_name ?? 'un administrateur'}`,
    meta: [item.context_class && `Classe de ${item.context_class}`, item.context_subject].filter(Boolean).join(' – '),
  }
}

const STAT_CARD_DEFS = [
  { key: 'absences_pending', icon: UserRoundX, tone: 'orange', label: 'Absences en attente\nde justification', linkLabel: 'Voir les absences', page: 'attendance' },
  { key: 'evaluations_incomplete', icon: ClipboardList, tone: 'blue', label: 'Évaluations / notes\nincomplètes', linkLabel: 'Voir les évaluations', page: 'notes' },
  { key: 'correction_requests_pending', icon: CircleHelp, tone: 'violet', label: 'Demandes de correction\nen attente', linkLabel: 'Voir les demandes', page: null },
  { key: 'report_cards_pending', icon: FileCheck2, tone: 'green', label: 'Bulletins en attente\nde validation', linkLabel: 'Voir les bulletins', page: 'report-cards' },
]

export default function AdminDashboardPage({ onNavigate }) {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(function loadDashboardEffect() {
    getAdminDashboard()
      .then(setDashboard)
      .catch((error) => setErrorMessage(error.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <main className="adp-main"><p>Chargement du tableau de bord…</p></main>
  if (errorMessage) return <main className="adp-main"><p className="adp-error">{errorMessage}</p></main>

  const { stats, cycle_performance: cyclePerformance, attendance_watchlist: attendanceWatchlist, grade_entry_progress: gradeEntryProgress, recent_activity: recentActivity } = dashboard

  return (
    <main className="adp-main">
      <header className="adp-header">
        <div>
          <h1>Tableau de bord</h1>
          <p>Vue d'ensemble de l'établissement</p>
        </div>
      </header>

      <section className="adp-stats-grid">
        {STAT_CARD_DEFS.map(function renderStatCard(card) {
          const Icon = card.icon
          return (
            <article key={card.key} className="adp-stat-card">
              <span className={`adp-stat-card__icon adp-stat-card__icon--${card.tone}`}>
                <Icon aria-hidden="true" size={20} />
              </span>
              <p className="adp-stat-card__label">
                {card.label.split('\n').map((line) => <span key={line}>{line}</span>)}
              </p>
              <strong className="adp-stat-card__value">{stats[card.key]}</strong>
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

      <section className="adp-columns">
      <div className="adp-column">
        <article className="adp-panel adp-panel--performance">
          <h2><BarChart3 aria-hidden="true" size={18} /> Performance de l'établissement</h2>
          <p className="adp-panel-hint">Moyenne générale par cycle</p>

          {cyclePerformance.length === 0 ? (
            <p className="adp-empty">Aucune note saisie pour le moment.</p>
          ) : (
            <div className="adp-performance-grid">
              {cyclePerformance.map(function renderCycle(cycle) {
                const maxScore = 20
                return (
                  <div key={cycle.label} className="adp-performance-cell">
                    <span className="adp-performance-cell__label">Moyenne {cycle.label}</span>
                    <strong className="adp-performance-cell__value">
                      {cycle.average.toFixed(1).replace('.', ',')} <small>/20</small>
                    </strong>
                    <div className="adp-mini-chart">
                      <span className="adp-mini-chart__axis">20</span>
                      {cycle.periods.map((period, index) => (
                        <span
                          key={period.period_name}
                          title={`${period.period_name} : ${period.average.toFixed(1)}/20`}
                          className={`adp-mini-chart__bar${index === cycle.periods.length - 1 ? ' adp-mini-chart__bar--current' : ''}`}
                          style={{ height: `${(period.average / maxScore) * 100}%` }}
                        />
                      ))}
                      <span className="adp-mini-chart__axis adp-mini-chart__axis--bottom">0</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <button type="button" className="adp-panel-link" disabled>
            Voir le détail des performances <span aria-hidden="true">›</span>
          </button>
        </article>

        <article className="adp-panel adp-panel--progress">
          <h2><PenLine aria-hidden="true" size={18} /> Progression des notes</h2>
          <p className="adp-panel-hint">Avancement de la saisie des notes pour l'année en cours</p>

          <div className="adp-progress-body">
            <div
              className="adp-progress-ring"
              style={{ '--progress': `${gradeEntryProgress.percent}%` }}
            >
              <span>{gradeEntryProgress.percent}%</span>
            </div>
            <div className="adp-progress-details">
              <span>Saisie des notes : <strong>{gradeEntryProgress.percent}%</strong></span>
              <div className="adp-progress-bar">
                <span style={{ width: `${gradeEntryProgress.percent}%` }} />
              </div>
              <span className="adp-progress-count">
                {gradeEntryProgress.entered} / {gradeEntryProgress.total} notes saisies
              </span>
            </div>
          </div>

          <button type="button" className="adp-panel-link" onClick={() => onNavigate?.('notes')}>
            Voir le détail par matière ou classe <span aria-hidden="true">›</span>
          </button>
        </article>
      </div>

      <div className="adp-column">
        <article className="adp-panel adp-panel--attendance">
          <h2><CalendarClock aria-hidden="true" size={18} /> Suivi des absences</h2>
          <p className="adp-panel-hint">Élèves à surveiller (absences répétées)</p>

          {attendanceWatchlist.length === 0 ? (
            <p className="adp-empty">Aucune absence enregistrée pour le moment.</p>
          ) : (
            <table className="adp-attendance-table">
              <thead>
                <tr><th>Élève</th><th>Absences</th></tr>
              </thead>
              <tbody>
                {attendanceWatchlist.map((student, index) => (
                  <tr key={student.student_name + student.class_name}>
                    <td>
                      <span className="adp-student">
                        <span className={`adp-student__avatar adp-student__avatar--${AVATAR_PALETTE[index % AVATAR_PALETTE.length]}`}>
                          {getInitials(student.student_name)}
                        </span>
                        <span className="adp-student__info">
                          <strong>{student.student_name}</strong>
                          <span>{student.class_name}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="adp-attendance-count">{student.absence_count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <button type="button" className="adp-panel-link" onClick={() => onNavigate?.('students')}>
            Voir tous les élèves <span aria-hidden="true">›</span>
          </button>
        </article>

        <article className="adp-panel adp-panel--activity">
          <h2><ClipboardList aria-hidden="true" size={18} /> Activité récente</h2>

          {recentActivity.length === 0 ? (
            <p className="adp-empty">Aucune activité récente.</p>
          ) : (
            <ul className="adp-activity-list">
              {recentActivity.map(function renderActivity(item, index) {
                const meta = ACTIVITY_META[item.kind] ?? ACTIVITY_META.report_card_validated
                const Icon = meta.icon
                const { text, meta: metaText } = getActivityText(item)
                return (
                  <li key={index}>
                    <span className={`adp-activity-list__icon adp-activity-list__icon--${meta.tone}`}>
                      <Icon aria-hidden="true" size={16} />
                    </span>
                    <span className="adp-activity-list__body">
                      <strong>{text}</strong>
                      {metaText && <span>{metaText}</span>}
                    </span>
                    <span className="adp-activity-list__when">{formatRelativeTime(item.happened_at)}</span>
                  </li>
                )
              })}
            </ul>
          )}

          <button type="button" className="adp-panel-link" disabled>
            Voir toute l'activité <span aria-hidden="true">›</span>
          </button>
        </article>
      </div>
      </section>
    </main>
  )
}
