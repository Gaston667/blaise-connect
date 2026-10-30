import { useEffect, useState } from 'react'
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CircleHelp,
  NotebookPen,
  Palmtree,
  Send,
} from 'lucide-react'

import { getTeacherDashboard } from '../services/teacher_dashboard_service.js'
import '../styles/teacher_dashboard.css'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

function formatTime(value) {
  return value ? value.slice(0, 5) : ''
}

function formatDate(value) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00`))
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T00:00:00`))
}

function formatDayLabel(value, today) {
  return value === today ? "aujourd'hui" : formatLongDate(value)
}

/** Tableau de bord de l'enseignant : sa journée, ses notes à terminer et ses corrections. */
export default function TeacherDashboardPage({ account, onNavigate }) {
  const [dashboard, setDashboard] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(function loadDashboardEffect() {
    let cancelled = false
    async function load() {
      try {
        const data = await getTeacherDashboard()
        if (!cancelled) setDashboard(data)
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message)
      }
    }
    load()
    return function cancelLoad() { cancelled = true }
  }, [])

  if (errorMessage) return <main className="tdb-main"><p className="tdb-error" role="alert">{errorMessage}</p></main>
  if (!dashboard) return <main className="tdb-main"><p className="tdb-muted">Chargement de votre tableau de bord…</p></main>

  const {
    today, holiday_today: holidayToday, next_holiday: nextHoliday, today_courses: todayCourses,
    next_course: nextCourse, incomplete_evaluations: incompleteEvaluations,
    incomplete_evaluations_count: incompleteCount, to_review_count: toReviewCount,
    my_waiting_count: myWaitingCount,
  } = dashboard

  const stats = [
    { key: 'courses', icon: CalendarClock, tone: 'blue', label: "Cours aujourd'hui", value: todayCourses.length, page: 'teacher-timetable', link: 'Mon emploi du temps' },
    { key: 'incomplete', icon: ClipboardList, tone: 'orange', label: 'Évaluations à terminer', value: incompleteCount, page: 'notes', link: 'Saisir les notes' },
    { key: 'review', icon: CircleHelp, tone: 'violet', label: 'Corrections à valider', value: toReviewCount, page: 'notes', link: 'Voir les demandes' },
    { key: 'waiting', icon: Send, tone: 'green', label: 'Mes demandes en attente', value: myWaitingCount, page: 'notes', link: 'Suivre mes demandes' },
  ]

  return (
    <main className="tdb-main">
      <header className="tdb-header">
        <div>
          <h1>{getGreeting()}, {account.first_name ?? 'bienvenue'} !</h1>
          <p>{formatLongDate(today)}</p>
        </div>
        <button type="button" className="tdb-primary-action" onClick={() => onNavigate('attendance')}>
          <CalendarCheck aria-hidden="true" size={18} /> Faire l’appel
        </button>
      </header>

      {holidayToday ? (
        <p className="tdb-holiday" role="status"><Palmtree aria-hidden="true" size={16} /> Vacances scolaires : {holidayToday}. Pas de cours aujourd’hui.</p>
      ) : nextHoliday ? (
        <p className="tdb-holiday tdb-holiday--upcoming" role="status">
          <Palmtree aria-hidden="true" size={16} /> Prochaines vacances : {nextHoliday.name} (du {formatDate(nextHoliday.start_date)} au {formatDate(nextHoliday.end_date)}).
        </p>
      ) : null}

      <section className="tdb-stats" aria-label="Indicateurs">
        {stats.map(function renderStat(stat) {
          const Icon = stat.icon
          return (
            <article key={stat.key} className="tdb-stat">
              <span className={`tdb-stat__icon tdb-stat__icon--${stat.tone}`}><Icon aria-hidden="true" size={20} /></span>
              <small>{stat.label}</small>
              <strong>{stat.value}</strong>
              <button type="button" className="tdb-link" onClick={() => onNavigate(stat.page)}>
                {stat.link} <ChevronRight aria-hidden="true" size={14} />
              </button>
            </article>
          )
        })}
      </section>

      <div className="tdb-columns">
        <section className="tdb-panel" aria-labelledby="tdb-today-title">
          <h2 id="tdb-today-title"><CalendarClock aria-hidden="true" size={18} /> Aujourd’hui</h2>
          {todayCourses.length === 0 ? (
            <p className="tdb-empty">{holidayToday ? 'Vacances scolaires.' : 'Aucun cours aujourd’hui.'}</p>
          ) : (
            <ul className="tdb-courses">
              {todayCourses.map(function renderCourse(course) {
                return (
                  <li key={`${course.start_time}-${course.class_name}`}>
                    <span className="tdb-courses__time">{formatTime(course.start_time)}<small>{formatTime(course.end_time)}</small></span>
                    <span className="tdb-courses__info">
                      <strong>{course.subject_name}</strong>
                      <span>{course.class_name}{course.room_name ? ` · ${course.room_name}` : ''}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {nextCourse ? (
            <p className="tdb-next">
              <strong>Prochain cours :</strong> {nextCourse.subject_name}, {nextCourse.class_name}, {formatDayLabel(nextCourse.date, today)} à {formatTime(nextCourse.start_time)}.
            </p>
          ) : null}
        </section>

        <section className="tdb-panel" aria-labelledby="tdb-evaluations-title">
          <h2 id="tdb-evaluations-title"><NotebookPen aria-hidden="true" size={18} /> Notes à terminer</h2>
          {incompleteEvaluations.length === 0 ? (
            <p className="tdb-empty"><CheckCircle2 aria-hidden="true" size={18} /> Toutes vos notes sont saisies.</p>
          ) : (
            <>
              <p className="tdb-hint">Les élèves et leurs parents ne voient une note que lorsque toute la classe est saisie.</p>
              <ul className="tdb-evaluations">
                {incompleteEvaluations.map(function renderEvaluation(evaluation) {
                  return (
                    <li key={evaluation.id}>
                      <button type="button" onClick={() => onNavigate('notes')}>
                        <span className="tdb-evaluations__info">
                          <strong>{evaluation.title}</strong>
                          <span>{evaluation.subject_name} · {evaluation.class_name} · {formatDate(evaluation.assessment_date)}</span>
                        </span>
                        <span className="tdb-evaluations__count">{evaluation.entered_count}/{evaluation.expected_count}</span>
                        <ChevronRight aria-hidden="true" size={16} />
                      </button>
                    </li>
                  )
                })}
              </ul>
              {incompleteCount > incompleteEvaluations.length ? (
                <p className="tdb-hint">et {incompleteCount - incompleteEvaluations.length} autre(s)…</p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
