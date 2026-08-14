import { useEffect, useState } from 'react'
import {
  Award,
  BookOpen,
  Calculator,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Globe2,
  Languages,
  Laptop2,
  Palette,
  TrendingDown,
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

/** Initiales d'une matière pour le badge rond, à défaut d'une icône plus parlante. */
function getSubjectInitials(subjectName) {
  if (!subjectName) return '?'
  const words = subjectName.replace(/\(.*?\)/g, '').trim().split(/[\s-]+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2)
  return `${words[0][0]}${words[1][0]}`
}

function formatAverage(value) {
  return value === null || value === undefined ? '—' : value.toFixed(2).replace('.', ',')
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
  const [selectedPeriodId, setSelectedPeriodId] = useState(null)
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false)

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
        const lastPeriod = summaryData.period_averages[summaryData.period_averages.length - 1]
        setSelectedPeriodId(lastPeriod ? lastPeriod.period_id : null)
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

  const periodIndex = summary.period_averages.findIndex((period) => period.period_id === selectedPeriodId)
  const selectedPeriod = periodIndex >= 0 ? summary.period_averages[periodIndex] : null
  const previousPeriod = periodIndex > 0 ? summary.period_averages[periodIndex - 1] : null
  const headlineAverage = selectedPeriod ? selectedPeriod.average : summary.overall_average
  const trendDelta =
    selectedPeriod && previousPeriod && selectedPeriod.average !== null && previousPeriod.average !== null
      ? selectedPeriod.average - previousPeriod.average
      : null

  function toggleSubjectFilter(subjectId) {
    setSelectedSubjectId((current) => (current === subjectId ? null : subjectId))
  }

  function selectPeriod(periodId) {
    setSelectedPeriodId(periodId)
    setIsPeriodMenuOpen(false)
  }

  return (
    <main className="sgp-main">
      <div className="sgp-hero">
        <div className="sgp-hero__top">
          <h1>Mes notes</h1>
          <p>{profile.class_name ?? 'Aucune classe active'}{profile.school_year_name ? ` • Année scolaire ${profile.school_year_name}` : ''}</p>

          <div className="sgp-period-picker">
            <button
              type="button"
              className="sgp-period-picker__button"
              onClick={() => setIsPeriodMenuOpen((current) => !current)}
              aria-expanded={isPeriodMenuOpen}
            >
              <CalendarDays aria-hidden="true" size={16} />
              {selectedPeriod ? selectedPeriod.period_name : 'Toutes périodes'}
              <ChevronDown aria-hidden="true" size={16} />
            </button>
            {isPeriodMenuOpen && (
              <ul className="sgp-period-picker__menu">
                {summary.period_averages.map((period) => (
                  <li key={period.period_id}>
                    <button type="button" onClick={() => selectPeriod(period.period_id)}>
                      {period.period_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <article className="sgp-average-card">
          <span className="sgp-average-card__icon">
            <TrendingUp aria-hidden="true" size={22} />
          </span>
          <div className="sgp-average-card__body">
            <span>Moyenne générale</span>
            <strong>{formatAverage(headlineAverage)} <small>/20</small></strong>
          </div>
          {trendDelta !== null && (
            <span className={`sgp-average-card__trend ${trendDelta >= 0 ? 'sgp-average-card__trend--up' : 'sgp-average-card__trend--down'}`}>
              {trendDelta >= 0 ? <TrendingUp aria-hidden="true" size={14} /> : <TrendingDown aria-hidden="true" size={14} />}
              {trendDelta >= 0 ? '+' : ''}{trendDelta.toFixed(2).replace('.', ',')}
              <small>vs période précédente</small>
            </span>
          )}
          {summary.rank && summary.class_size && (
            <span className="sgp-average-card__rank">
              <Award aria-hidden="true" size={13} /> Rang : {summary.rank} / {summary.class_size}
            </span>
          )}
        </article>
      </div>

      <div className="sgp-layout">
        <div className="sgp-main-col">
          <section className="sgp-section">
            <h2><BookOpen aria-hidden="true" size={18} /> Moyennes par matière</h2>
            <div className="sgp-subject-list">
              {summary.subject_averages.length === 0 ? (
                <p className="sgp-empty">Aucune moyenne disponible pour le moment.</p>
              ) : (
                summary.subject_averages.map((subject) => {
                  const isSelected = subject.subject_id === selectedSubjectId
                  const color = subjectColorBySubjectId.get(subject.subject_id)
                  const subjectGrades = isSelected ? gradesForSelectedSubject : []
                  return (
                    <div key={subject.subject_id} className={`sgp-subject-row sgp-subject-row--${color}${isSelected ? ' sgp-subject-row--open' : ''}`}>
                      <button
                        type="button"
                        className="sgp-subject-row__head"
                        onClick={() => toggleSubjectFilter(subject.subject_id)}
                        aria-expanded={isSelected}
                      >
                        <span className="sgp-subject-row__badge">{getSubjectInitials(subject.subject_name)}</span>
                        <span className="sgp-subject-row__name">{subject.subject_name}</span>
                        <span className="sgp-subject-row__average">{formatAverage(subject.average)} <small>/20</small></span>
                        <span className="sgp-subject-row__coef">Coef. {subject.coefficient % 1 === 0 ? subject.coefficient : subject.coefficient.toFixed(1)}</span>
                        <ChevronRight aria-hidden="true" size={17} className="sgp-subject-row__chevron" />
                      </button>

                      {isSelected && (
                        <div className="sgp-subject-row__body">
                          {subjectGrades.length === 0 ? (
                            <p className="sgp-empty">Aucune note dans cette matière.</p>
                          ) : (
                            subjectGrades.map((grade) => (
                              <div key={grade.id} className="sgp-subject-row__grade">
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
            <div className="sgp-section-head">
              <h2><CalendarClock aria-hidden="true" size={18} /> Dernières évaluations</h2>
              {grades.length > 5 && (
                <button type="button" className="sgp-more__btn" onClick={() => setShowAllGrades((current) => !current)}>
                  {showAllGrades ? 'Voir moins' : 'Voir tout'} <ChevronRight aria-hidden="true" size={14} />
                </button>
              )}
            </div>
            <div className="sgp-evaluation-list">
              {recentGrades.length === 0 ? (
                <p className="sgp-empty">Aucune note pour le moment.</p>
              ) : (
                recentGrades.map((grade) => {
                  const SubjectIcon = getSubjectIcon(grade.subject_name)
                  const color = subjectColorBySubjectId.get(grade.subject_id) ?? 'violet'
                  return (
                    <div key={grade.id} className={`sgp-evaluation-row sgp-evaluation-row--${scoreTone(grade).replace('sgp-score--', '')}`}>
                      <span className={`sgp-evaluation-row__icon sgp-evaluation-row__icon--${color}`}>
                        <SubjectIcon aria-hidden="true" size={17} />
                      </span>
                      <div className="sgp-evaluation-row__info">
                        <strong>{grade.subject_name}</strong>
                        <span>{grade.assessment_title}</span>
                      </div>
                      <span className={`sgp-score ${scoreTone(grade)}`}>{formatScore(grade)}</span>
                      <span className="sgp-evaluation-row__date">
                        <CalendarDays aria-hidden="true" size={13} /> {formatDate(grade.assessment_date)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
            {hiddenGradeCount > 0 && (
              <p className="sgp-more">{hiddenGradeCount} autre(s) note(s) non affichée(s) ici.</p>
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
