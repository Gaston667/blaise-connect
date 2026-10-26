import { useEffect, useState } from 'react'
import {
  BarChart3,
  CalendarClock,
  CircleHelp,
  ClipboardList,
  FileCheck2,
  Minus,
  PenLine,
  Plus,
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

const PERFORMANCE_COLORS = ['#0756c9', '#7c3aed', '#ea580c']
const PERFORMANCE_CHART = {
  width: 640,
  height: 190,
  left: 38,
  right: 18,
  top: 16,
  bottom: 36,
}

function getPerformancePeriods(cycles) {
  const periodNames = []
  cycles.forEach(function collectCyclePeriods(cycle) {
    cycle.periods.forEach(function collectPeriod(period) {
      if (!periodNames.includes(period.period_name)) periodNames.push(period.period_name)
    })
  })
  return periodNames
}

function roundDownToHalf(value) {
  return Math.floor(value * 2) / 2
}

function roundUpToHalf(value) {
  return Math.ceil(value * 2) / 2
}

function formatScore(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
}

function getPerformanceScale(cycles, zoomLevel) {
  if (zoomLevel <= -2) return { min: 0, max: 20 }

  const values = cycles.flatMap(function getCycleAverages(cycle) {
    return cycle.periods.map(function getPeriodAverage(period) { return period.average })
  })
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const lowerPadding = Math.max(0.25, 1 - zoomLevel * 0.5)
  const upperPadding = Math.max(0.5, 1.5 - zoomLevel * 0.5)
  const min = Math.max(0, roundDownToHalf(minimum - lowerPadding))
  const max = Math.min(20, roundUpToHalf(maximum + upperPadding))

  return { min, max: max > min ? max : Math.min(20, min + 1) }
}

function getChartPoint(periodIndex, periodCount, average, scale) {
  const chartWidth = PERFORMANCE_CHART.width - PERFORMANCE_CHART.left - PERFORMANCE_CHART.right
  const chartHeight = PERFORMANCE_CHART.height - PERFORMANCE_CHART.top - PERFORMANCE_CHART.bottom
  const divisor = Math.max(periodCount - 1, 1)
  return {
    x: PERFORMANCE_CHART.left + (periodIndex / divisor) * chartWidth,
    y: PERFORMANCE_CHART.top + ((scale.max - average) / (scale.max - scale.min)) * chartHeight,
  }
}

function PerformanceLineChart({ cycles }) {
  const [zoomLevel, setZoomLevel] = useState(0)
  const periods = getPerformancePeriods(cycles)
  const scale = getPerformanceScale(cycles, zoomLevel)
  const chartBottom = PERFORMANCE_CHART.height - PERFORMANCE_CHART.bottom
  const chartRight = PERFORMANCE_CHART.width - PERFORMANCE_CHART.right
  const gridValues = Array.from({ length: 5 }, function getGridValue(_, index) {
    return scale.min + ((scale.max - scale.min) / 4) * index
  })

  return (
    <>
      <div className="adp-performance-chart-header">
        <ul className="adp-performance-legend" aria-label="Moyennes actuelles par cycle">
          {cycles.map(function renderLegend(cycle, index) {
            return (
              <li key={cycle.label}>
                <span style={{ backgroundColor: PERFORMANCE_COLORS[index % PERFORMANCE_COLORS.length] }} />
                <strong>{cycle.label}</strong>
                <em>{cycle.average.toFixed(1).replace('.', ',')} /20</em>
              </li>
            )
          })}
        </ul>
        <div className="adp-performance-zoom" aria-label="Zoom de la courbe">
          <button type="button" onClick={function zoomOut() { setZoomLevel(function decreaseZoom(current) { return Math.max(-2, current - 1) }) }} disabled={zoomLevel <= -2} aria-label="Dézoomer jusqu’à l’échelle 0 à 20">
            <Minus aria-hidden="true" size={15} />
          </button>
          <button type="button" onClick={function zoomIn() { setZoomLevel(function increaseZoom(current) { return Math.min(3, current + 1) }) }} disabled={zoomLevel >= 3} aria-label="Zoomer">
            <Plus aria-hidden="true" size={15} />
          </button>
        </div>
      </div>

      <div className="adp-performance-chart-wrap">
        <svg
          className="adp-performance-chart"
          viewBox={`0 0 ${PERFORMANCE_CHART.width} ${PERFORMANCE_CHART.height}`}
          role="img"
          aria-label="Évolution des moyennes par cycle et par période, sur 20"
        >
          {gridValues.map(function renderGridLine(value) {
            const point = getChartPoint(0, periods.length, value, scale)
            return (
              <g key={value}>
                <line x1={PERFORMANCE_CHART.left} x2={chartRight} y1={point.y} y2={point.y} className="adp-performance-chart__grid" />
                <text x={PERFORMANCE_CHART.left - 9} y={point.y + 4} className="adp-performance-chart__axis">{formatScore(value)}</text>
              </g>
            )
          })}

          {cycles.map(function renderCycleLine(cycle, cycleIndex) {
            const color = PERFORMANCE_COLORS[cycleIndex % PERFORMANCE_COLORS.length]
            const points = cycle.periods.map(function buildPoint(period) {
              const periodIndex = periods.indexOf(period.period_name)
              return { ...getChartPoint(periodIndex, periods.length, period.average, scale), period }
            })
            return (
              <g key={cycle.label}>
                <polyline
                  points={points.map(function formatPoint(point) { return `${point.x},${point.y}` }).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {points.map(function renderPoint(point) {
                  return (
                    <circle key={point.period.period_name} cx={point.x} cy={point.y} r="4.5" fill={color} className="adp-performance-chart__point">
                      <title>{`${cycle.label} — ${point.period.period_name} : ${point.period.average.toFixed(1).replace('.', ',')}/20`}</title>
                    </circle>
                  )
                })}
              </g>
            )
          })}

          {periods.map(function renderPeriodLabel(periodName, index) {
            const point = getChartPoint(index, periods.length, scale.min, scale)
            return <text key={periodName} x={point.x} y={chartBottom + 24} textAnchor="middle" className="adp-performance-chart__period">{periodName}</text>
          })}
        </svg>
      </div>
    </>
  )
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
            <PerformanceLineChart cycles={cyclePerformance} />
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
