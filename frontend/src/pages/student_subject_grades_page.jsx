import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays } from 'lucide-react'

import AssessmentDetailModal from '../components/assessment_detail_modal.jsx'
import { useGuardianChild } from '../context/guardian_child_context.js'
import { getMyGrades, getMyGradesSummary } from '../services/student_grades_service.js'
import { formatAverage, formatDate, formatScore, scoreTone } from '../utils/grades_format.js'
import '../styles/student_grades_page.css'

/** Page d'une matière : sa moyenne et toutes ses évaluations. */
export default function StudentSubjectGradesPage({ subjectId, onNavigate }) {
  const { childId } = useGuardianChild()
  const [subject, setSubject] = useState(null)
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [openAssessmentId, setOpenAssessmentId] = useState(null)

  useEffect(function loadSubjectEffect() {
    let cancelled = false
    async function load() {
      try {
        const [gradesData, summaryData] = await Promise.all([getMyGrades(childId), getMyGradesSummary(childId)])
        if (cancelled) return
        setGrades(gradesData.filter((grade) => grade.subject_id === subjectId))
        setSubject(summaryData.subject_averages.find((item) => item.subject_id === subjectId) ?? null)
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return function cancelLoad() { cancelled = true }
  }, [childId, subjectId])

  if (loading) return <main className="sgp-main"><p>Chargement de la matière…</p></main>
  if (errorMessage) return <main className="sgp-main"><p className="sgp-error">{errorMessage}</p></main>

  const subjectName = subject?.subject_name ?? grades[0]?.subject_name ?? 'Matière'

  return (
    <main className="sgp-main">
      <button type="button" className="sgp-back" onClick={() => onNavigate('student-grades')}>
        <ArrowLeft aria-hidden="true" size={18} /> Notes
      </button>

      <header className="sgp-subject-header">
        <h1>{subjectName}</h1>
        {subject && (
          <p>
            Moyenne <strong>{formatAverage(subject.average)} /20</strong> · Coef.{' '}
            {subject.coefficient % 1 === 0 ? subject.coefficient : subject.coefficient.toFixed(1)}
          </p>
        )}
      </header>

      <section className="sgp-section">
        <h2>Évaluations</h2>
        <div className="sgp-evaluation-list">
          {grades.length === 0 ? (
            <p className="sgp-empty">Aucune note dans cette matière.</p>
          ) : (
            grades.map((grade) => (
              <button
                key={grade.id}
                type="button"
                className={`sgp-evaluation-row sgp-evaluation-row--${scoreTone(grade).replace('sgp-score--', '')}`}
                onClick={() => setOpenAssessmentId(grade.assessment_id)}
              >
                <div className="sgp-evaluation-row__info">
                  <strong>{grade.assessment_title}</strong>
                  <span>
                    <CalendarDays aria-hidden="true" size={13} /> {formatDate(grade.assessment_date)}
                  </span>
                </div>
                <span className={`sgp-score ${scoreTone(grade)}`}>{formatScore(grade)}</span>
              </button>
            ))
          )}
        </div>
      </section>

      {openAssessmentId && (
        <AssessmentDetailModal
          assessmentId={openAssessmentId}
          childId={childId}
          onClose={() => setOpenAssessmentId(null)}
        />
      )}
    </main>
  )
}
