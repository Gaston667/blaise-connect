import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarClock, ChevronRight, Plus } from 'lucide-react'
import {
  createReportingPeriod,
  getReportingPeriods,
  getSchoolYear,
} from '../services/school_year_service'

function formatDate(dateValue) {
  if (!dateValue) return '—'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR')
}

/** Affiche le détail d'une année scolaire et ses périodes de bulletin. */
export default function SchoolYearDetailsPage({ schoolYearId, onNavigate }) {
  const [schoolYear, setSchoolYear] = useState(null)
  const [periods, setPeriods] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', end_date: '' })
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(function loadDetailsEffect() {
    if (schoolYearId) loadDetails()
  }, [schoolYearId])

  async function loadDetails() {
    setIsLoading(true)
    try {
      const [yearData, periodsData] = await Promise.all([
        getSchoolYear(schoolYearId),
        getReportingPeriods(schoolYearId),
      ])
      setSchoolYear(yearData)
      setPeriods(periodsData)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleFormFieldChange(event) {
    const { name, value } = event.target
    setFormData((previous) => ({ ...previous, [name]: value }))
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    setFormError('')
    setIsSubmitting(true)

    try {
      await createReportingPeriod(schoolYearId, formData)
      setFormData({ name: '', end_date: '' })
      setIsFormOpen(false)
      const periodsData = await getReportingPeriods(schoolYearId)
      setPeriods(periodsData)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleBackNavigation() {
    onNavigate('school-years')
  }

  if (isLoading) {
    return (
      <main className="comptes-main">
        <p className="comptes-table-status">Chargement de l’année scolaire…</p>
      </main>
    )
  }

  if (errorMessage && !schoolYear) {
    return (
      <main className="comptes-main">
        <p className="comptes-error" role="alert">{errorMessage}</p>
      </main>
    )
  }

  const isClosed = schoolYear.closed_at !== null

  return (
    <main className="comptes-main">
      <header className="details-heading">
        <div className="details-heading-top">
          <button
            type="button"
            className="details-back-button"
            onClick={handleBackNavigation}
            aria-label="Retour"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
          <div>
            <h1 className="comptes-title">{schoolYear.name}</h1>
            <nav className="comptes-breadcrumb" aria-label="Fil d’Ariane">
              <button type="button" onClick={() => onNavigate('home')}>Accueil</button>
              <ChevronRight aria-hidden="true" size={14} />
              <button type="button" onClick={handleBackNavigation}>Années scolaires</button>
              <ChevronRight aria-hidden="true" size={14} />
              <span className="comptes-breadcrumb-current">{schoolYear.name}</span>
            </nav>
          </div>
        </div>
      </header>

      <section className="details-summary-card">
        <dl className="details-summary-facts" style={{ width: '100%' }}>
          <div>
            <dt>Dates</dt>
            <dd>{formatDate(schoolYear.start_date)} → {formatDate(schoolYear.end_date)}</dd>
          </div>
          <div>
            <dt>Statut</dt>
            <dd>
              {schoolYear.is_current && <span className="details-badge-success">Courante</span>}
              {isClosed && <span className="details-badge-danger">Clôturée</span>}
              {!schoolYear.is_current && !isClosed && 'Ouverte'}
            </dd>
          </div>
          {isClosed && (
            <div>
              <dt>Clôturée le</dt>
              <dd>{formatDate(schoolYear.closed_at)}</dd>
            </div>
          )}
        </dl>
      </section>

      {errorMessage && (
        <p className="comptes-error" role="alert">{errorMessage}</p>
      )}

      <section className="details-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ margin: 0 }}>Périodes de bulletin</h3>
          {!isClosed && (
            <button
              type="button"
              className="details-mini-button"
              style={{ cursor: 'pointer' }}
              onClick={() => setIsFormOpen((open) => !open)}
            >
              <Plus aria-hidden="true" size={14} style={{ verticalAlign: 'middle' }} />
              {' '}Ajouter
            </button>
          )}
        </div>

        {isFormOpen && (
          <form className="details-form-grid" onSubmit={handleCreateSubmit} style={{ marginBottom: 'var(--space-5)' }}>
            <div className="details-field">
              <label htmlFor="period-name">Nom</label>
              <input
                id="period-name"
                name="name"
                type="text"
                placeholder="Trimestre 1"
                value={formData.name}
                onChange={handleFormFieldChange}
                required
              />
            </div>
            <div className="details-field">
              <label htmlFor="period-end">Date de fin</label>
              <input
                id="period-end"
                name="end_date"
                type="date"
                value={formData.end_date}
                onChange={handleFormFieldChange}
                required
              />
            </div>
            <p className="details-field details-field-full" style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
              La date de début sera calculée automatiquement (début de l'année, ou lendemain de la période précédente).
            </p>

            {formError && (
              <p className="comptes-error details-field-full" role="alert">{formError}</p>
            )}

            <div className="details-field-full">
              <button
                type="submit"
                className="details-action-primary"
                disabled={isSubmitting}
                style={{ cursor: isSubmitting ? 'wait' : 'pointer' }}
              >
                {isSubmitting ? 'Création…' : 'Créer la période'}
              </button>
            </div>
          </form>
        )}

        {periods.length === 0 ? (
          <div className="comptes-empty-state">
            <CalendarClock aria-hidden="true" size={28} />
            <p>Aucune période définie pour cette année.</p>
          </div>
        ) : (
          <div className="comptes-table-wrapper">
            <table className="comptes-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Début</th>
                  <th>Fin</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id}>
                    <td>{period.name}</td>
                    <td>{formatDate(period.start_date)}</td>
                    <td>{formatDate(period.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}