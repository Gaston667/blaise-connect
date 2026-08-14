import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'

import { getSchoolClassesOverview } from '../services/school_classes_overview_service.js'
import { getReportingPeriods, getSchoolYears } from '../services/school_year_service.js'
import { getReportCards } from '../services/report_cards_service.js'
import '../styles/report_cards_page.css'

function formatAverage(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue.toFixed(2).replace('.', ',') : '—'
}

function getStatusLabel(status) {
  return status === 'VALIDATED' ? 'Validé' : 'Brouillon'
}

export default function ReportCardsPage() {
  const [schoolYears, setSchoolYears] = useState([])
  const [schoolClasses, setSchoolClasses] = useState([])
  const [periods, setPeriods] = useState([])
  const [filters, setFilters] = useState({ schoolYearId: '', schoolClassId: '', reportingPeriodId: '' })
  const [reportCards, setReportCards] = useState([])
  const [errorMessage, setErrorMessage] = useState('')

  async function loadReportCards(nextFilters) {
    try {
      setErrorMessage('')
      setReportCards(await getReportCards(nextFilters))
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  useEffect(function loadInitialData() {
    async function load() {
      try {
        const [years, classes] = await Promise.all([getSchoolYears(), getSchoolClassesOverview({ limit: 100 })])
        setSchoolYears(years)
        setSchoolClasses(classes)
        const currentYear = years.find(function findCurrentYear(year) { return year.is_current }) || years[0]
        if (currentYear) {
          const nextFilters = { schoolYearId: currentYear.id, schoolClassId: '', reportingPeriodId: '' }
          setFilters(nextFilters)
          setPeriods(await getReportingPeriods(currentYear.id))
          await loadReportCards(nextFilters)
        }
      } catch (error) {
        setErrorMessage(error.message)
      }
    }
    load()
  }, [])

  async function changeYear(event) {
    const schoolYearId = event.target.value
    const nextFilters = { schoolYearId, schoolClassId: '', reportingPeriodId: '' }
    setFilters(nextFilters)
    setPeriods(schoolYearId ? await getReportingPeriods(schoolYearId) : [])
    loadReportCards(nextFilters)
  }

  function changeFilter(field, value) {
    const nextFilters = { ...filters, [field]: value }
    setFilters(nextFilters)
    loadReportCards(nextFilters)
  }

  const visibleClasses = schoolClasses.filter(function belongsToYear(schoolClass) {
    return !filters.schoolYearId || schoolClass.school_year_id === filters.schoolYearId
  })
  const validatedCount = reportCards.filter(function isValidated(reportCard) { return reportCard.status === 'VALIDATED' }).length

  return <main className="rcp-main">
    <h1 className="rcp-title">Gestion des bulletins</h1>
    <nav className="rcp-breadcrumb" aria-label="Fil d’Ariane"><span>Accueil</span><span>›</span><span>Bulletins</span></nav>
    <p className="rcp-intro">Consultez les bulletins générés et leur état de validation.</p>

    <section className="rcp-summary" aria-label="Résumé des bulletins">
      <article><FileText aria-hidden="true" /><strong>{reportCards.length}</strong><span>Bulletins générés</span></article>
      <article><strong>{validatedCount}</strong><span>Bulletins validés</span></article>
      <article><strong>{reportCards.length - validatedCount}</strong><span>Brouillons à contrôler</span></article>
    </section>

    <section className="rcp-filters" aria-label="Filtres des bulletins">
      <label>Année scolaire<select value={filters.schoolYearId} onChange={changeYear}><option value="">Toutes les années</option>{schoolYears.map(function renderYear(year) { return <option key={year.id} value={year.id}>{year.name}</option> })}</select></label>
      <label>Classe<select value={filters.schoolClassId} onChange={function selectClass(event) { changeFilter('schoolClassId', event.target.value) }}><option value="">Toutes les classes</option>{visibleClasses.map(function renderClass(schoolClass) { return <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.level_name} {schoolClass.group_label}</option> })}</select></label>
      <label>Période<select value={filters.reportingPeriodId} onChange={function selectPeriod(event) { changeFilter('reportingPeriodId', event.target.value) }}><option value="">Toutes les périodes</option>{periods.map(function renderPeriod(period) { return <option key={period.id} value={period.id}>{period.name}</option> })}</select></label>
    </section>

    {errorMessage ? <p className="rcp-error">{errorMessage}</p> : null}
    <section className="rcp-table-wrap">
      <table className="rcp-table"><thead><tr><th>Élève</th><th>Classe</th><th>Période</th><th>Moyenne générale</th><th>Statut</th><th>Généré le</th></tr></thead><tbody>
        {reportCards.map(function renderReportCard(reportCard) { return <tr key={reportCard.id}><td><strong>{reportCard.student_name}</strong><small>{reportCard.registration_number}</small></td><td>{reportCard.class_name}</td><td>{reportCard.reporting_period_name}</td><td>{formatAverage(reportCard.general_average)} /20</td><td><span className={`rcp-status rcp-status--${reportCard.status.toLowerCase()}`}>{getStatusLabel(reportCard.status)}</span></td><td>{new Date(reportCard.generated_at).toLocaleDateString('fr-FR')}</td></tr> })}
        {reportCards.length === 0 ? <tr><td colSpan="6" className="rcp-empty">Aucun bulletin généré avec ces filtres.</td></tr> : null}
      </tbody></table>
    </section>
  </main>
}
