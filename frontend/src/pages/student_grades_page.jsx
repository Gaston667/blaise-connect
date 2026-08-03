import { useEffect, useState } from 'react'
import {
  Award,
  BarChart3,
  BookOpen,
  Calculator,
  CalendarClock,
  ChevronDown,
  FileText,
  FlaskConical,
  Globe2,
  Languages,
  Laptop2,
  Palette,
  TrendingUp,
} from 'lucide-react'

import { getMyGrades, getMyGradesSummary, getMyProfile } from '../services/student_grades_service.js'
import '../styles/student_grades_page.css'

const PALETTE = ['violet', 'green', 'blue', 'orange']

const SUBJECT_ICON_RULES = [
  [/math/i, Calculator],
  [/(fran[cç]ais|litt[ée]rature|lettres)/i, BookOpen],
  [/(sciences|physique|chimie|svt|biolog)/i, FlaskConical],
  [/(histoire|g[ée]o)/i, Globe2],
  [/(anglais|espagnol|allemand|langue)/i, Languages],
  [/(informatique|numérique|nsi)/i, Laptop2],
  [/(art|dessin|musique)/i, Palette],
]

function getSubjectIcon(subjectName) {
  const match = SUBJECT_ICON_RULES.find(([pattern]) => pattern.test(subjectName ?? ''))
  return match ? match[1] : BookOpen
}

function formatAverage(value) {
  return value === null || value === undefined ? '—' : `${value.toFixed(2)} /20`
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

function formatDay(value) {
  if (!value) return { day: '—', month: '' }
  const date = new Date(`${value}T00:00:00`)
  return {
    day: date.getDate(),
    month: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase(),
  }
}

function formatScore(grade) {
  if (grade.result_type === 'ABSENT') return 'Absent'
  if (grade.score === null || grade.score === undefined) return '—'
  return `${Number(grade.score).toFixed(2)} / ${Number(grade.maximum_score).toFixed(2)}`
}

function scoreTone(grade) {
  if (grade.result_type === 'ABSENT') return 'sgp-score--absent'
  const ratio = Number(grade.score) / Number(grade.maximum_score)
  if (ratio >= 0.7) return 'sgp-score--good'
  if (ratio >= 0.5) return 'sgp-score--average'
  return 'sgp-score--low'
}

export default function StudentGradesPage() {
  const [profile, setProfile] = useState(null)
  const [grades, setGrades] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [showAllGrades, setShowAllGrades] = useState(false)
  const [selectedSubjectId, setSelectedSubjectId] = useState(null)

  useEffect(function loadDashboardEffect() {
    async function load() {
      try {
        const [profileData, gradesData, summaryData] = await Promise.all([
          getMyProfile(),
          getMyGrades(),
          getMyGradesSummary(),
        ])
        setProfile(profileData)
        setGrades(gradesData)
        setSummary(summaryData)
      } catch (error) {
        setErrorMessage(error.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <main className="sgp-main"><p>Chargement de vos notes…</p></main>
  if (errorMessage) return <main className="sgp-main"><p className="sgp-error">{errorMessage}</p></main>

  const subjectColorBySubjectId = new Map(
    summary.subject_averages.map((subject, index) => [subject.subject_id, PALETTE[index % PALETTE.length]])
  )
  const gradesForSelectedSubject = selectedSubjectId
    ? grades.filter((grade) => grade.subject_id === selectedSubjectId)
    : []
  const recentGrades = showAllGrades ? grades : grades.slice(0, 5)
  const hiddenGradeCount = grades.length - recentGrades.length

  function toggleSubjectFilter(subjectId) {
    setSelectedSubjectId((current) => (current === subjectId ? null : subjectId))
  }

  return (
    <main className="sgp-main">
      <header className="sgp-header">
        <div>
          <h1>Bonjour, {profile.first_name} {profile.last_name} !</h1>
          <p>{profile.class_name ? `Élève en ${profile.class_name}` : 'Aucune classe active'}</p>
        </div>
      </header>

      <div className="sgp-layout">
        <div className="sgp-main-col">
          <section className="sgp-section">
            <h2><BarChart3 aria-hidden="true" size={18} /> Synthèse des performances</h2>
            <div className="sgp-stats-grid">
              <article className="sgp-stat sgp-stat--violet">
                <span className="sgp-stat__icon"><TrendingUp aria-hidden="true" size={18} /></span>
                <div>
                  <span>Moyenne générale</span>
                  <strong>{formatAverage(summary.overall_average)}</strong>
                  {summary.rank && summary.class_size && (
                    <small><Award aria-hidden="true" size={13} /> Rang : {summary.rank} / {summary.class_size}</small>
                  )}
                </div>
              </article>

              {summary.period_averages.map((period, index) => (
                <article key={period.period_id} className={`sgp-stat sgp-stat--${PALETTE[(index + 1) % PALETTE.length]}`}>
                  <span className="sgp-stat__icon"><TrendingUp aria-hidden="true" size={18} /></span>
                  <div>
                    <span>Moyenne — {period.period_name}</span>
                    <strong>{formatAverage(period.average)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="sgp-section">
            <h2><BookOpen aria-hidden="true" size={18} /> Mes matières</h2>
            <p className="sgp-section-hint">Touchez une matière pour voir ses notes juste en dessous.</p>
            <div className="sgp-subject-accordion">
              {summary.subject_averages.length === 0 ? (
                <p className="sgp-empty">Aucune moyenne disponible pour le moment.</p>
              ) : (
                summary.subject_averages.map((subject, index) => {
                  const SubjectIcon = getSubjectIcon(subject.subject_name)
                  const isSelected = subject.subject_id === selectedSubjectId
                  const color = PALETTE[index % PALETTE.length]
                  const subjectGrades = isSelected ? gradesForSelectedSubject : []
                  return (
                    <div key={subject.subject_id} className={`sgp-subject-item sgp-subject-item--${color}${isSelected ? ' sgp-subject-item--open' : ''}`}>
                      <button
                        type="button"
                        className="sgp-subject-item__head"
                        onClick={() => toggleSubjectFilter(subject.subject_id)}
                        aria-expanded={isSelected}
                      >
                        <span className="sgp-subject-item__icon"><SubjectIcon aria-hidden="true" size={16} /></span>
                        <span className="sgp-subject-item__name">{subject.subject_name}</span>
                        <strong>{formatAverage(subject.average)}</strong>
                        <ChevronDown aria-hidden="true" size={16} className="sgp-subject-item__chevron" />
                      </button>

                      {isSelected && (
                        <div className="sgp-subject-item__body">
                          {subjectGrades.length === 0 ? (
                            <p className="sgp-empty">Aucune note dans cette matière.</p>
                          ) : (
                            subjectGrades.map((grade) => (
                              <div key={grade.id} className="sgp-subject-item__grade">
                                <div>
                                  <strong>{grade.assessment_title}</strong>
                                  <span>{formatDate(grade.assessment_date)}</span>
                                </div>
                                <span className={`sgp-score ${scoreTone(grade)}`}>{formatScore(grade)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <section className="sgp-section">
            <h2><FileText aria-hidden="true" size={18} /> Mes dernières notes</h2>
            <div className="sgp-table-wrapper">
              <table className="sgp-table">
                <thead>
                  <tr>
                    <th>Matière</th>
                    <th>Évaluation</th>
                    <th>Date</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGrades.length === 0 ? (
                    <tr><td colSpan={4} className="sgp-empty">Aucune note pour le moment.</td></tr>
                  ) : (
                    recentGrades.map((grade) => {
                      const SubjectIcon = getSubjectIcon(grade.subject_name)
                      const color = subjectColorBySubjectId.get(grade.subject_id) ?? 'violet'
                      return (
                      <tr key={grade.id}>
                        <td>
                          <span className="sgp-row-subject">
                            <span className={`sgp-row-subject__icon sgp-row-subject__icon--${color}`}>
                              <SubjectIcon aria-hidden="true" size={15} />
                            </span>
                            {grade.subject_name}
                          </span>
                        </td>
                        <td>{grade.assessment_title}</td>
                        <td>{formatDate(grade.assessment_date)}</td>
                        <td className={`sgp-score ${scoreTone(grade)}`}>
                          {formatScore(grade)}
                        </td>
                      </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {grades.length > 5 && (
              <p className="sgp-more">
                {showAllGrades
                  ? `${grades.length} note(s) affichée(s) au total.`
                  : `${hiddenGradeCount} autre(s) note(s) non affichée(s) ici.`}
                <button type="button" className="sgp-more__btn" onClick={() => setShowAllGrades((current) => !current)}>
                  {showAllGrades ? 'Voir moins' : 'Voir toutes mes notes'}
                </button>
              </p>
            )}
          </section>
        </div>

        <aside className="sgp-side-col">
          <section className="sgp-section">
            <h2><CalendarClock aria-hidden="true" size={18} /> Prochaines évaluations</h2>
            <ul className="sgp-upcoming-list">
              {summary.upcoming_assessments.length === 0 ? (
                <li className="sgp-empty">Aucune évaluation à venir.</li>
              ) : (
                summary.upcoming_assessments.map((assessment, index) => {
                  const { day, month } = formatDay(assessment.assessment_date)
                  return (
                    <li key={assessment.id}>
                      <span className={`sgp-upcoming-date sgp-upcoming-date--${PALETTE[index % PALETTE.length]}`}>
                        <strong>{day}</strong>
                        <small>{month}</small>
                      </span>
                      <span className="sgp-upcoming-info">
                        <strong>{assessment.subject_name}</strong>
                        <span>{assessment.title}</span>
                      </span>
                    </li>
                  )
                })
              )}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  )
}
