import { useEffect, useState } from 'react'
import {
  Ban,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Plus,
  Star,
} from 'lucide-react'
import {
  closeSchoolYear,
  createReportingPeriod,
  createSchoolYear,
  getReportingPeriods,
  getSchoolYears,
  setCurrentSchoolYear,
} from '../services/school_year_service'

const PAGE_SIZE = 10

function formatDate(dateValue) {
  if (!dateValue) return '—'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR')
}

function getYearStatusLabel(schoolYear) {
  if (schoolYear.closed_at !== null) return 'Clôturée'
  return 'En cours'
}

/** Affiche la gestion des années scolaires et de leurs périodes de bulletin. */
export default function SchoolYearsPage({ onNavigate }) {
  const [schoolYears, setSchoolYears] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState('years')
  const [currentPage, setCurrentPage] = useState(1)

  const [isYearFormOpen, setIsYearFormOpen] = useState(false)
  const [yearFormData, setYearFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
  })
  const [yearFormError, setYearFormError] = useState('')
  const [isYearSubmitting, setIsYearSubmitting] = useState(false)
  const [pendingActionId, setPendingActionId] = useState(null)

  const [selectedYearId, setSelectedYearId] = useState(null)
  const [periods, setPeriods] = useState([])
  const [isPeriodsLoading, setIsPeriodsLoading] = useState(false)
  const [isPeriodFormOpen, setIsPeriodFormOpen] = useState(false)
  const [periodFormData, setPeriodFormData] = useState({ name: '', end_date: '' })
  const [periodFormError, setPeriodFormError] = useState('')
  const [isPeriodSubmitting, setIsPeriodSubmitting] = useState(false)

  useEffect(function loadSchoolYearsEffect() {
    reloadSchoolYears()
  }, [])

  useEffect(
    function loadPeriodsForSelectedYearEffect() {
      if (selectedYearId) loadPeriods(selectedYearId)
    },
    [selectedYearId],
  )

  async function reloadSchoolYears() {
    try {
      const data = await getSchoolYears()
      setSchoolYears(data)

      const currentYear = data.find((year) => year.is_current)
      setSelectedYearId((previous) => previous || currentYear?.id || data[0]?.id || null)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadPeriods(yearId) {
    setIsPeriodsLoading(true)
    try {
      setPeriods(await getReportingPeriods(yearId))
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsPeriodsLoading(false)
    }
  }

  function handleYearFormFieldChange(event) {
    const { name, value } = event.target
    setYearFormData((previous) => ({ ...previous, [name]: value }))
  }

  async function handleCreateYearSubmit(event) {
    event.preventDefault()
    setYearFormError('')
    setIsYearSubmitting(true)

    try {
      await createSchoolYear(yearFormData)
      setYearFormData({ name: '', start_date: '', end_date: '' })
      setIsYearFormOpen(false)
      await reloadSchoolYears()
    } catch (error) {
      setYearFormError(error.message)
    } finally {
      setIsYearSubmitting(false)
    }
  }

  async function handleSetCurrent(schoolYearId) {
    setPendingActionId(schoolYearId)
    setErrorMessage('')

    try {
      await setCurrentSchoolYear(schoolYearId)
      await reloadSchoolYears()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleCloseYear(schoolYearId) {
    setPendingActionId(schoolYearId)
    setErrorMessage('')

    try {
      await closeSchoolYear(schoolYearId)
      await reloadSchoolYears()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setPendingActionId(null)
    }
  }

  function handleViewYearPeriods(schoolYearId) {
    setSelectedYearId(schoolYearId)
    setActiveTab('periods')
  }

  function handlePeriodFormFieldChange(event) {
    const { name, value } = event.target
    setPeriodFormData((previous) => ({ ...previous, [name]: value }))
  }

  async function handleCreatePeriodSubmit(event) {
    event.preventDefault()
    setPeriodFormError('')
    setIsPeriodSubmitting(true)

    try {
      await createReportingPeriod(selectedYearId, periodFormData)
      setPeriodFormData({ name: '', end_date: '' })
      setIsPeriodFormOpen(false)
      await loadPeriods(selectedYearId)
    } catch (error) {
      setPeriodFormError(error.message)
    } finally {
      setIsPeriodSubmitting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(schoolYears.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE
  const paginatedYears = schoolYears.slice(pageStart, pageStart + PAGE_SIZE)
  const selectedYear = schoolYears.find((year) => year.id === selectedYearId)
  const isSelectedYearClosed = selectedYear?.closed_at != null

  return (
    <main className="comptes-main">
      <header className="comptes-heading">
        <div>
          <nav className="comptes-breadcrumb" aria-label="Fil d’Ariane">
            <button type="button" onClick={() => onNavigate('home')}>
              Accueil
            </button>
            <ChevronRight aria-hidden="true" size={14} />
            <span className="comptes-breadcrumb-current">Années et périodes scolaires</span>
          </nav>
          <h1 className="comptes-title">Années et périodes scolaires</h1>
        </div>
      </header>

      {errorMessage && (
        <p className="comptes-error" role="alert">
          {errorMessage}
        </p>
      )}

      <nav className="details-tabs" aria-label="Sections">
        <button
          type="button"
          className={`details-tab ${activeTab === 'years' ? 'details-tab-active' : ''}`}
          onClick={() => setActiveTab('years')}
        >
          <Calendar aria-hidden="true" size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Années scolaires
        </button>
        <button
          type="button"
          className={`details-tab ${activeTab === 'periods' ? 'details-tab-active' : ''}`}
          onClick={() => setActiveTab('periods')}
        >
          <CalendarClock aria-hidden="true" size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Périodes scolaires
        </button>
      </nav>

      {activeTab === 'years' && (
        <>
          <section className="comptes-list" aria-label="Liste des années scolaires">
            <div className="comptes-toolbar" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Années scolaires</h3>
              <button
                type="button"
                className="details-action-primary"
                style={{ cursor: 'pointer' }}
                onClick={() => setIsYearFormOpen((open) => !open)}
              >
                <Plus aria-hidden="true" size={16} />
                {isYearFormOpen ? 'Annuler' : 'Ajouter une année scolaire'}
              </button>
            </div>

            {isYearFormOpen && (
              <form
                className="details-form-grid"
                onSubmit={handleCreateYearSubmit}
                style={{ padding: 'var(--space-4)', borderBottom: 'var(--border-default)' }}
              >
                <div className="details-field">
                  <label htmlFor="school-year-name">Nom</label>
                  <input
                    id="school-year-name"
                    name="name"
                    type="text"
                    placeholder="2026-2027"
                    value={yearFormData.name}
                    onChange={handleYearFormFieldChange}
                    required
                  />
                </div>
                <div className="details-field">
                  <label htmlFor="school-year-start">Date de début</label>
                  <input
                    id="school-year-start"
                    name="start_date"
                    type="date"
                    value={yearFormData.start_date}
                    onChange={handleYearFormFieldChange}
                    required
                  />
                </div>
                <div className="details-field">
                  <label htmlFor="school-year-end">Date de fin</label>
                  <input
                    id="school-year-end"
                    name="end_date"
                    type="date"
                    value={yearFormData.end_date}
                    onChange={handleYearFormFieldChange}
                    required
                  />
                </div>

                {yearFormError && (
                  <p className="comptes-error details-field-full" role="alert">
                    {yearFormError}
                  </p>
                )}

                <div className="details-field-full">
                  <button
                    type="submit"
                    className="details-action-primary"
                    disabled={isYearSubmitting}
                    style={{ cursor: isYearSubmitting ? 'wait' : 'pointer' }}
                  >
                    {isYearSubmitting ? 'Création…' : 'Créer l’année scolaire'}
                  </button>
                </div>

              </form>
            )}

            {isLoading ? (
              <p className="comptes-table-status">Chargement des années scolaires…</p>
            ) : schoolYears.length === 0 ? (
              <div className="comptes-empty-state">
                <Calendar aria-hidden="true" size={28} />
                <p>Aucune année scolaire pour le moment.</p>
              </div>
            ) : (
              <>
                <div className="comptes-table-wrapper">
                  <table className="comptes-table">
                    <thead>
                      <tr>
                        <th>Nom de l'année</th>
                        <th>Date de début</th>
                        <th>Date de fin</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedYears.map((schoolYear) => {
                        const isClosed = schoolYear.closed_at !== null
                        const isPending = pendingActionId === schoolYear.id

                        return (
                          <tr key={schoolYear.id}>
                            <td>
                              <div className="comptes-table-identity">
                                {schoolYear.is_current && (
                                  <span
                                    className="comptes-role-badge comptes-role-badge-admin"
                                    style={{ marginRight: 'var(--space-2)' }}
                                  >
                                    Actuelle
                                  </span>
                                )}
                                <span>{schoolYear.name}</span>
                              </div>
                            </td>
                            <td>{formatDate(schoolYear.start_date)}</td>
                            <td>{formatDate(schoolYear.end_date)}</td>
                            <td>
                              <span
                                className={
                                  isClosed
                                    ? 'details-badge-danger'
                                    : 'details-badge-success'
                                }
                              >
                                {getYearStatusLabel(schoolYear)}
                              </span>
                            </td>
                            <td>
                              <div className="comptes-actions">
                                <button
                                  type="button"
                                  className="comptes-action-button comptes-action-edit"
                                  title="Voir les périodes"
                                  onClick={() => handleViewYearPeriods(schoolYear.id)}
                                >
                                  <Eye aria-hidden="true" size={16} />
                                </button>
                                {!isClosed && !schoolYear.is_current && (
                                  <button
                                    type="button"
                                    className="comptes-action-button comptes-action-edit"
                                    title="Définir comme année courante"
                                    disabled={isPending}
                                    onClick={() => handleSetCurrent(schoolYear.id)}
                                  >
                                    <Star aria-hidden="true" size={16} />
                                  </button>
                                )}
                                {!isClosed && (
                                  <button
                                    type="button"
                                    className="comptes-action-button comptes-action-delete"
                                    title="Clôturer l'année"
                                    disabled={isPending}
                                    onClick={() => handleCloseYear(schoolYear.id)}
                                  >
                                    <Ban aria-hidden="true" size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="comptes-pagination">
                  <p className="comptes-pagination-info">
                    Affichage de {pageStart + 1} à{' '}
                    {Math.min(pageStart + PAGE_SIZE, schoolYears.length)} sur{' '}
                    {schoolYears.length} années scolaires
                  </p>
                  <div className="comptes-pagination-controls">
                    <button
                      type="button"
                      className="comptes-pagination-button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={safeCurrentPage === 1}
                      aria-label="Page précédente"
                    >
                      <ChevronLeft aria-hidden="true" size={16} />
                    </button>
                    <span className="comptes-pagination-button comptes-pagination-button-active">
                      {safeCurrentPage}
                    </span>
                    <button
                      type="button"
                      className="comptes-pagination-button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={safeCurrentPage === totalPages}
                      aria-label="Page suivante"
                    >
                      <ChevronRight aria-hidden="true" size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
          <section className="comptes-list" aria-label="Périodes de l'année courante" style={{ marginTop: 'var(--space-5)' }}>
            <div className="comptes-toolbar" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>
                Périodes {selectedYear ? `de l'année ${selectedYear.is_current ? 'en cours ' : ''}(${selectedYear.name})` : ''}
              </h3>
              {!isSelectedYearClosed && selectedYearId && (
                <button
                  type="button"
                  className="details-action-primary"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setIsPeriodFormOpen((open) => !open)}
                >
                  <Plus aria-hidden="true" size={16} />
                  {isPeriodFormOpen ? 'Annuler' : 'Ajouter une période'}
                </button>
              )}
            </div>

            {isPeriodFormOpen && (
              <form
                className="details-form-grid"
                onSubmit={handleCreatePeriodSubmit}
                style={{ padding: 'var(--space-4)', borderBottom: 'var(--border-default)' }}
              >
                <div className="details-field">
                  <label htmlFor="period-name-years-tab">Nom</label>
                  <input
                    id="period-name-years-tab"
                    name="name"
                    type="text"
                    placeholder="1er Trimestre"
                    value={periodFormData.name}
                    onChange={handlePeriodFormFieldChange}
                    required
                  />
                </div>
                <div className="details-field">
                  <label htmlFor="period-end-years-tab">Date de fin</label>
                  <input
                    id="period-end-years-tab"
                    name="end_date"
                    type="date"
                    value={periodFormData.end_date}
                    onChange={handlePeriodFormFieldChange}
                    required
                  />
                </div>

                {periodFormError && (
                  <p className="comptes-error details-field-full" role="alert">
                    {periodFormError}
                  </p>
                )}

                <div className="details-field-full">
                  <button
                    type="submit"
                    className="details-action-primary"
                    disabled={isPeriodSubmitting}
                    style={{ cursor: isPeriodSubmitting ? 'wait' : 'pointer' }}
                  >
                    {isPeriodSubmitting ? 'Création…' : 'Créer la période'}
                  </button>
                </div>
              </form>
            )}

            {isPeriodsLoading ? (
              <p className="comptes-table-status">Chargement des périodes…</p>
            ) : periods.length === 0 ? (
              <div className="comptes-empty-state">
                <CalendarClock aria-hidden="true" size={28} />
                <p>Aucune période définie pour cette année.</p>
              </div>
            ) : (
              <div className="comptes-table-wrapper">
                <table className="comptes-table">
                  <thead>
                    <tr>
                      <th>Nom de la période</th>
                      <th>Date de début</th>
                      <th>Date de fin</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period) => (
                      <tr key={period.id}>
                        <td>{period.name}</td>
                        <td>{formatDate(period.start_date)}</td>
                        <td>{formatDate(period.end_date)}</td>
                        <td>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                margin: 'var(--space-4)',
                background: 'var(--color-primary-lighter)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              <Info aria-hidden="true" size={18} />
              Les périodes permettent d'organiser les évaluations et la génération des bulletins.
            </div>
          </section>
        </>
      )}

      {activeTab === 'periods' && (
        <section className="comptes-list" aria-label="Périodes de l'année sélectionnée">
          <div className="comptes-toolbar" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h3 style={{ margin: 0 }}>
                Périodes {selectedYear ? `de l'année ${selectedYear.is_current ? 'en cours ' : ''}(${selectedYear.name})` : ''}
              </h3>
              {schoolYears.length > 1 && (
                <select
                  className="comptes-filter-select"
                  style={{ marginTop: 'var(--space-2)' }}
                  value={selectedYearId || ''}
                  onChange={(event) => setSelectedYearId(event.target.value)}
                >
                  {schoolYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {!isSelectedYearClosed && selectedYearId && (
              <button
                type="button"
                className="details-action-primary"
                style={{ cursor: 'pointer' }}
                onClick={() => setIsPeriodFormOpen((open) => !open)}
              >
                <Plus aria-hidden="true" size={16} />
                {isPeriodFormOpen ? 'Annuler' : 'Ajouter une période'}
              </button>
            )}
          </div>

          {isPeriodFormOpen && (
            <form
              className="details-form-grid"
              onSubmit={handleCreatePeriodSubmit}
              style={{ padding: 'var(--space-4)', borderBottom: 'var(--border-default)' }}
            >
              <div className="details-field">
                <label htmlFor="period-name">Nom</label>
                <input
                  id="period-name"
                  name="name"
                  type="text"
                  placeholder="1er Trimestre"
                  value={periodFormData.name}
                  onChange={handlePeriodFormFieldChange}
                  required
                />
              </div>
              <div className="details-field">
                <label htmlFor="period-end">Date de fin</label>
                <input
                  id="period-end"
                  name="end_date"
                  type="date"
                  value={periodFormData.end_date}
                  onChange={handlePeriodFormFieldChange}
                  required
                />
              </div>
              <p
                className="details-field details-field-full"
                style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}
              >
                La date de début sera calculée automatiquement (début de l'année, ou lendemain de la période précédente).
              </p>

              {periodFormError && (
                <p className="comptes-error details-field-full" role="alert">
                  {periodFormError}
                </p>
              )}

              <div className="details-field-full">
                <button
                  type="submit"
                  className="details-action-primary"
                  disabled={isPeriodSubmitting}
                  style={{ cursor: isPeriodSubmitting ? 'wait' : 'pointer' }}
                >
                  {isPeriodSubmitting ? 'Création…' : 'Créer la période'}
                </button>
              </div>
            </form>
          )}

          {isPeriodsLoading ? (
            <p className="comptes-table-status">Chargement des périodes…</p>
          ) : periods.length === 0 ? (
            <div className="comptes-empty-state">
              <CalendarClock aria-hidden="true" size={28} />
              <p>Aucune période définie pour cette année.</p>
            </div>
          ) : (
            <div className="comptes-table-wrapper">
              <table className="comptes-table">
                <thead>
                  <tr>
                    <th>Nom de la période</th>
                    <th>Date de début</th>
                    <th>Date de fin</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => (
                    <tr key={period.id}>
                      <td>{period.name}</td>
                      <td>{formatDate(period.start_date)}</td>
                      <td>{formatDate(period.end_date)}</td>
                      <td>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-4)',
              margin: 'var(--space-4)',
              background: 'var(--color-primary-lighter)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            <Info aria-hidden="true" size={18} />
            Les périodes permettent d'organiser les évaluations et la génération des bulletins.
          </div>
        </section>
      )}
    </main>
  )
}