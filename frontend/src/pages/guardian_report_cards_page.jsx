import { useEffect, useState } from 'react'
import { ChevronRight, FileText } from 'lucide-react'

import { useGuardianChild } from '../context/guardian_child_context.js'
import { getChildReportCards } from '../services/guardian_portal_service.js'
import ReportCardDetailsPage from './report_card_details_page.jsx'
import '../styles/guardian_portal.css'

function formatAverage(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue.toFixed(2).replace('.', ',') : '—'
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '—'
}

function getTone(value) {
  const average = Number(value)
  if (!Number.isFinite(average) || average < 10) return 'red'
  if (average < 12) return 'orange'
  if (average < 15) return 'blue'
  return 'green'
}

/** Détail d'un bulletin validé, en lecture seule, pour l'enfant consulté. */
export function GuardianReportCardDetails({ reportCardId, onNavigate }) {
  const { selectedChild } = useGuardianChild()
  return <ReportCardDetailsPage reportCardId={reportCardId} onNavigate={onNavigate} childId={selectedChild.id} />
}

/** Liste des bulletins validés de l'enfant consulté. */
export default function GuardianReportCardsPage({ onNavigate }) {
  const { selectedChild } = useGuardianChild()
  const [reportCards, setReportCards] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(function loadReportCardsEffect() {
    let cancelled = false
    async function load() {
      try {
        const data = await getChildReportCards(selectedChild.id)
        if (!cancelled) setReportCards(data)
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message)
      }
    }
    load()
    return function cancelLoad() { cancelled = true }
  }, [selectedChild.id])

  return (
    <main className="gph-main">
      <header className="gph-page-header">
        <h1>Bulletins</h1>
        <p>Bulletins validés de {selectedChild.first_name}.</p>
      </header>

      {errorMessage ? <p className="gph-error" role="alert">{errorMessage}</p> : null}
      {!errorMessage && reportCards === null ? <p className="gph-muted">Chargement des bulletins…</p> : null}
      {reportCards && reportCards.length === 0 ? (
        <div className="gph-empty">
          <FileText aria-hidden="true" size={32} />
          <strong>Aucun bulletin disponible</strong>
          <span>Les bulletins apparaissent ici une fois validés par l'établissement.</span>
        </div>
      ) : null}

      <div className="grc-list">
        {(reportCards ?? []).map(function renderReportCard(card) {
          return (
            <button
              key={card.id}
              type="button"
              className="grc-card"
              onClick={() => onNavigate('guardian-report-card-details', { id: card.id })}
            >
              <span className="grc-card__icon"><FileText aria-hidden="true" size={22} /></span>
              <span className="grc-card__info">
                <strong>{card.reporting_period_name}</strong>
                <span>{card.class_name} · {card.school_year_name}</span>
                <small>Validé le {formatDate(card.validated_at)}</small>
              </span>
              <span className={`grc-card__average grc-card__average--${getTone(card.general_average)}`}>
                {formatAverage(card.general_average)}<small>/20</small>
              </span>
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          )
        })}
      </div>
    </main>
  )
}
