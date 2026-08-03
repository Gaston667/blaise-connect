import { useEffect, useState } from 'react'
import { BarChart3, BookOpen, CalendarClock, FileText } from 'lucide-react'

import { getMyGrades, getMyGradesSummary, getMyProfile } from '../services/student_grades_service.js'
import '../styles/student_grades_page.css'

function formatAverage(value) {
  return value === null || value === undefined ? '—' : `${value.toFixed(2)} /20`
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

function formatScore(grade) {
  if (grade.result_type === 'ABSENT') return 'Absent'
  if (grade.score === null || grade.score === undefined) return '—'
  return `${Number(grade.score).toFixed(2)} / ${Number(grade.maximum_score).toFixed(2)}`
}

export default function StudentGradesPage() {
  const [profile, setProfile] = useState(null)
  const [grades, setGrades] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

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

  const recentGrades = grades.slice(0, 5)

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
              <article className="sgp-stat sgp-stat--blue">
                <span>Moyenne générale</span>
                <strong>{formatAverage(summary.overall_average)}</strong>
                {summary.rank && summary.class_size && (
                  <small>Rang : {summary.rank} / {summary.class_size}</small>
                )}
              </article>
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
                    recentGrades.map((grade) => (
                      <tr key={grade.id}>
                        <td>{grade.subject_name}</td>
                        <td>{grade.assessment_title}</td>
                        <td>{formatDate(grade.assessment_date)}</td>
                        <td className={grade.result_type === 'ABSENT' ? 'sgp-score sgp-score--absent' : 'sgp-score'}>
                          {formatScore(grade)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {grades.length > recentGrades.length && (
              <p className="sgp-more">{grades.length - recentGrades.length} autre(s) note(s) non affichée(s) ici.</p>
            )}
          </section>

          <section className="sgp-section">
            <h2><BookOpen aria-hidden="true" size={18} /> Moyennes par matière</h2>
            <div className="sgp-subject-grid">
              {summary.subject_averages.length === 0 ? (
                <p className="sgp-empty">Aucune moyenne disponible pour le moment.</p>
              ) : (
                summary.subject_averages.map((subject) => (
                  <article key={subject.subject_id} className="sgp-subject-card">
                    <span>{subject.subject_name}</span>
                    <strong>{formatAverage(subject.average)}</strong>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="sgp-side-col">
          <section className="sgp-section">
            <h2><CalendarClock aria-hidden="true" size={18} /> Prochaines évaluations</h2>
            <ul className="sgp-upcoming-list">
              {summary.upcoming_assessments.length === 0 ? (
                <li className="sgp-empty">Aucune évaluation à venir.</li>
              ) : (
                summary.upcoming_assessments.map((assessment) => (
                  <li key={assessment.id}>
                    <strong>{assessment.subject_name}</strong>
                    <span>{assessment.title}</span>
                    <time>{formatDate(assessment.assessment_date)}</time>
                  </li>
                ))
              )}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  )
}
