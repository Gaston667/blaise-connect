import { useEffect, useState } from 'react'
import { CheckCircle2, Download, Printer } from 'lucide-react'

import {
  getReportCard,
  getReportCardTestPdf,
} from '../services/report_cards_service.js'
import '../styles/report_card_details_page.css'

function formatAverage(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue)
    ? numericValue.toFixed(2).replace('.', ',')
    : '—'
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR')
}

function getStatusLabel(status) {
  return status === 'VALIDATED' ? 'Validé' : 'Brouillon'
}

function getAverageTone(value) {
  const average = Number(value)
  if (!Number.isFinite(average) || average < 10) return 'red'
  if (average < 12) return 'orange'
  if (average < 15) return 'blue'
  return 'green'
}

function printReportCard() {
  window.print()
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Affiche un bulletin dans une mise en page prête pour l'impression. */
export default function ReportCardDetailsPage({ reportCardId, onNavigate }) {
  const [reportCard, setReportCard] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  useEffect(function loadReportCardEffect() {
    async function loadReportCard() {
      try {
        setErrorMessage('')
        setReportCard(await getReportCard(reportCardId))
      } catch (error) {
        const code = error?.code || 'UNKNOWN_ERROR'
        const reference = error?.errorId ? ` Référence : ${error.errorId}.` : ''
        setErrorMessage(`[${code}] ${error?.message || 'Impossible de charger ce bulletin.'}${reference}`)
      }
    }

    loadReportCard()
  }, [reportCardId])

  if (errorMessage) {
    return <main className="rcd-main"><p className="rcd-error" role="alert">{errorMessage}</p></main>
  }

  if (!reportCard) {
    return <main className="rcd-main"><p>Chargement du bulletin…</p></main>
  }

  async function downloadTestPdf() {
    setIsGeneratingPdf(true)
    setErrorMessage('')
    try {
      const pdfBlob = await getReportCardTestPdf(reportCardId)
      downloadBlob(pdfBlob, `bulletin-test-${reportCard.registration_number}.pdf`)
    } catch (error) {
      const code = error?.code || 'UNKNOWN_ERROR'
      setErrorMessage(`[${code}] ${error?.message || 'Impossible de générer le PDF de test.'}`)
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return <main className="rcd-main">
    <header className="rcd-page-header">
      <div>
        <nav className="rcd-breadcrumb" aria-label="Fil d’Ariane">
          <button type="button" onClick={function goHome() { onNavigate('home') }}>Accueil</button>
          <span>›</span>
          <button type="button" onClick={function goToReportCards() { onNavigate('report-cards') }}>Bulletins</button>
          <span>›</span><span>Détail du bulletin</span>
        </nav>
        <h1>Détail du bulletin</h1>
      </div>
      <div className="rcd-actions rcd-no-print">
        <button type="button" className="rcd-button rcd-button--secondary" onClick={printReportCard}><Printer size={17} /> Imprimer</button>
        <button type="button" className="rcd-button rcd-button--secondary" onClick={downloadTestPdf} disabled={isGeneratingPdf}><Download size={17} /> {isGeneratingPdf ? 'Génération…' : 'Télécharger PDF test'}</button>
        <button type="button" className="rcd-button rcd-button--primary" disabled title="La validation sera ajoutée après la génération des bulletins."><CheckCircle2 size={17} /> Valider le bulletin</button>
      </div>
    </header>

    <article className="rcd-paper">
      <section className="rcd-letterhead">
        <strong>ESPACE RÉSERVÉ POUR L’EN-TÊTE DE L’ÉTABLISSEMENT</strong>
        <span>Logo, nom de l’établissement, adresse, contacts</span>
      </section>

      <section className="rcd-identity">
        <div className="rcd-photo">
          <img
            src={reportCard.photo_path || '/api/media/accounts/default-photo'}
            alt="Photo de l’élève"
            onError={function showDefaultPhoto(event) { event.currentTarget.src = '/api/media/accounts/default-photo' }}
          />
        </div>
        <dl>
          <div><dt>Élève</dt><dd>{reportCard.student_name}</dd></div>
          <div><dt>Matricule</dt><dd>{reportCard.registration_number}</dd></div>
          <div><dt>Classe</dt><dd>{reportCard.class_name}</dd></div>
          <div><dt>Né(e) le</dt><dd>{formatDate(reportCard.birth_date)}</dd></div>
          <div><dt>Effectif de la classe</dt><dd>{reportCard.class_student_count || '—'}</dd></div>
        </dl>
        <dl>
          <div><dt>Période</dt><dd>{reportCard.reporting_period_name}</dd></div>
          <div><dt>Du</dt><dd>{formatDate(reportCard.period_start_date)}</dd></div>
          <div><dt>Au</dt><dd>{formatDate(reportCard.period_end_date)}</dd></div>
        </dl>
      </section>

      <section className="rcd-subjects">
        <div className="rcd-table-wrap"><table><colgroup><col className="rcd-col-number" /><col className="rcd-col-subject" /><col className="rcd-col-coefficient" /><col className="rcd-col-average" /><col className="rcd-col-average" /><col className="rcd-col-range" /><col className="rcd-col-comment" /></colgroup><thead><tr><th rowSpan="2">N°</th><th rowSpan="2">Matières</th><th rowSpan="2">Coefficient</th><th colSpan="3">Moyennes</th><th rowSpan="2">Appréciations</th></tr><tr><th>Élève</th><th>Classe</th><th>+ / −</th></tr></thead><tbody>
          {reportCard.subjects.map(function renderSubject(subject, index) {
            return <tr key={subject.subject_name}><td>{index + 1}</td><td>{subject.subject_name}</td><td>{formatAverage(subject.applied_coefficient)}</td><td>{formatAverage(subject.subject_average)}</td><td>{formatAverage(subject.class_average)}</td><td>{formatAverage(subject.highest_average)} / {formatAverage(subject.lowest_average)}</td><td>{subject.teacher_comment || '—'}</td></tr>
          })}
          {reportCard.subjects.length === 0 ? <tr><td colSpan="7" className="rcd-empty">Aucune matière figée dans ce bulletin.</td></tr> : null}
        </tbody></table></div>
      </section>

      <section className="rcd-summary">
        <div><span>Moyenne générale</span><strong className={`rcd-average--${getAverageTone(reportCard.general_average)}`}>{formatAverage(reportCard.general_average)} <small>/20</small></strong><em>Classe : {formatAverage(reportCard.class_general_average)} /20</em></div>
        <div><span>Rang</span><strong>{reportCard.class_rank || '—'} / {reportCard.class_student_count || '—'}</strong></div>
        <div className="rcd-attendance-summary"><span>Absences & retards</span><dl><div><dt>Absences justifiées :</dt><dd>{reportCard.justified_absence_count}</dd></div><div><dt>Absences non justifiées :</dt><dd>{reportCard.unjustified_absence_count}</dd></div>{reportCard.pending_absence_count > 0 ? <div><dt>Absences en attente :</dt><dd>{reportCard.pending_absence_count}</dd></div> : null}<div><dt>Retards :</dt><dd>{reportCard.late_minutes} min</dd></div></dl></div>
        <div><span>Décision</span><strong className={`rcd-decision rcd-decision--${reportCard.status.toLowerCase()}`}>{getStatusLabel(reportCard.status)}</strong><em>Après validation</em></div>
      </section>

      <section className="rcd-comment"><h2>Appréciation générale</h2><p>{reportCard.overall_comment || 'Aucune appréciation générale renseignée.'}</p></section>
      <footer className="rcd-signatures"><div><strong>Professeur principal</strong><span>Appréciation et visa</span></div><div><strong>CPE</strong><span>Bon comportement</span></div><div><strong>Chef d’établissement</strong><span>Visa et décision</span></div></footer>
    </article>
  </main>
}
