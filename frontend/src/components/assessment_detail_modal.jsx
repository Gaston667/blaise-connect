import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import { getMyAssessmentDetail } from '../services/student_grades_service.js'
import { formatAverage, formatDate, formatScore } from '../utils/grades_format.js'

/** Fenêtre de détail d'une évaluation : charge elle-même les données de l'évaluation. */
export default function AssessmentDetailModal({ assessmentId, childId, onClose }) {
  const [detail, setDetail] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(function loadDetailEffect() {
    let cancelled = false
    async function load() {
      try {
        const data = await getMyAssessmentDetail(assessmentId, childId)
        if (!cancelled) setDetail(data)
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message)
      }
    }
    load()
    return function cancelLoad() { cancelled = true }
  }, [assessmentId, childId])

  return (
    <div className="sgp-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="sgp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sgp-assessment-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="sgp-modal__close" onClick={onClose} aria-label="Fermer">
          <X aria-hidden="true" size={20} />
        </button>
        {!detail && !errorMessage && <p>Chargement du détail de l'évaluation…</p>}
        {errorMessage && <p className="sgp-error">{errorMessage}</p>}
        {detail && (
          <>
            <h2 id="sgp-assessment-detail-title">{detail.title}</h2>
            <p className="sgp-modal__subtitle">
              {detail.subject_name} · {detail.class_name} · {formatDate(detail.assessment_date)}
            </p>
            {detail.description && <p>{detail.description}</p>}
            <div className="sgp-detail-grid">
              <article><span>Votre note</span><strong>{formatScore(detail)}</strong></article>
              <article><span>Meilleure note</span><strong>{formatAverage(detail.highest_score)} /20</strong></article>
              <article><span>Note la plus basse</span><strong>{formatAverage(detail.lowest_score)} /20</strong></article>
              <article><span>Moyenne de classe</span><strong>{formatAverage(detail.class_average)} /20</strong><small>{detail.class_appreciation ?? 'Non disponible'}</small></article>
              <article><span>Rang</span><strong>{detail.rank ? `${detail.rank} / ${detail.ranked_students_count}` : 'Non classé'}</strong></article>
              <article><span>Coefficient</span><strong>{detail.coefficient}</strong><small>Barème : {detail.maximum_score}</small></article>
            </div>
            <section className="sgp-detail-comment">
              <h3>Appréciation de l'enseignant</h3>
              <p>{detail.comment || 'Aucune appréciation renseignée.'}</p>
            </section>
          </>
        )}
      </section>
    </div>
  )
}
