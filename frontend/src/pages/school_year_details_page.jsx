import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  closeSchoolYear,
  createReportingPeriod,
  deleteSchoolYear,
  getReportingPeriods,
  getSchoolYear,
  getSchoolYearDeletionPreview,
  setCurrentSchoolYear,
  updateReportingPeriod,
  updateSchoolYearDetails,
} from '../services/school_year_service'

function formatDate(dateValue) {
  if (!dateValue) return '—'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR')
}

function formatDateTime(dateValue) {
  if (!dateValue) return '—'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR')
}

/** Prépare une période pour le formulaire global de modification. */
function createPeriodEdit(period) {
  return {
    id: period.id,
    name: period.name,
    start_date: period.start_date,
    end_date: period.end_date,
    is_locked: period.is_locked,
  }
}

/** Conserve uniquement les champs acceptés par la modification globale. */
function createPeriodUpdatePayload(period) {
  return {
    id: period.id,
    name: period.name,
    end_date: period.end_date,
  }
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
  const [editingPeriodId, setEditingPeriodId] = useState(null)
  const [isYearActionPending, setIsYearActionPending] = useState(false)
  const [isEditingYear, setIsEditingYear] = useState(false)
  const [yearEdit, setYearEdit] = useState({
    name: '',
    start_date: '',
    end_date: '',
  })
  const [periodEdits, setPeriodEdits] = useState([])
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletionPreview, setDeletionPreview] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const loadDetails = useCallback(async function loadDetails() {
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
  }, [schoolYearId])

  useEffect(function loadDetailsEffect() {
    if (schoolYearId) {
      Promise.resolve().then(loadDetails)
    }
  }, [loadDetails, schoolYearId])

  function handleFormFieldChange(event) {
    const { name, value } = event.target
    setFormData((previous) => ({ ...previous, [name]: value }))
  }

  async function handleCreateSubmit(event) {
    event.preventDefault()
    setFormError('')
    setIsSubmitting(true)

    try {
      if (editingPeriodId) {
        await updateReportingPeriod(schoolYearId, editingPeriodId, formData)
      } else {
        await createReportingPeriod(schoolYearId, formData)
      }
      setFormData({ name: '', end_date: '' })
      setEditingPeriodId(null)
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

  function handleHomeNavigation() {
    onNavigate('home')
  }

  function handleStartYearEditing() {
    setYearEdit({
      name: schoolYear.name,
      start_date: schoolYear.start_date,
      end_date: schoolYear.end_date,
    })
    setPeriodEdits(periods.map(createPeriodEdit))
    setErrorMessage('')
    setIsEditingYear(true)
  }

  function handleYearEditChange(event) {
    const { name, value } = event.target
    setYearEdit(function updateYear(previousYear) {
      return { ...previousYear, [name]: value }
    })
  }

  function handlePeriodEditChange(event) {
    const periodIndex = Number(event.target.dataset.periodIndex)
    const { name, value } = event.target

    setPeriodEdits(function updateSelectedPeriod(previousPeriods) {
      return previousPeriods.map(function updatePeriod(period, index) {
        if (index !== periodIndex) return period
        return { ...period, [name]: value }
      })
    })
  }

  function handleCancelYearEditing() {
    setIsEditingYear(false)
  }

  async function handleYearFormSubmit(event) {
    event.preventDefault()
    setIsYearActionPending(true)
    setErrorMessage('')

    try {
      await updateSchoolYearDetails(schoolYearId, {
        ...yearEdit,
        periods: periodEdits.map(createPeriodUpdatePayload),
      })

      setIsEditingYear(false)
      await loadDetails()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsYearActionPending(false)
    }
  }

  function handlePeriodSelection(period) {
    if (period.is_locked) return
    setEditingPeriodId(period.id)
    setFormData({ name: period.name, end_date: period.end_date })
    setIsFormOpen(true)
  }

  async function handleSetCurrentYear() {
    setIsYearActionPending(true)
    try {
      await setCurrentSchoolYear(schoolYearId)
      await loadDetails()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsYearActionPending(false)
    }
  }

  async function handleCloseCurrentYear() {
    setIsYearActionPending(true)
    try {
      await closeSchoolYear(schoolYearId)
      await loadDetails()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsYearActionPending(false)
    }
  }

  async function handleOpenDeleteDialog() {
    setErrorMessage('')
    setIsYearActionPending(true)
    try {
      const preview = await getSchoolYearDeletionPreview(schoolYearId)
      setDeletionPreview(preview)
      setDeleteConfirmation('')
      setIsDeleteDialogOpen(true)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsYearActionPending(false)
    }
  }

  function handleCloseDeleteDialog() {
    if (isDeleting) return
    setIsDeleteDialogOpen(false)
  }

  function handleDeleteConfirmationChange(event) {
    setDeleteConfirmation(event.target.value)
  }

  async function handleDeleteSchoolYear(event) {
    event.preventDefault()
    setIsDeleting(true)
    setErrorMessage('')
    try {
      await deleteSchoolYear(schoolYearId, deleteConfirmation)
      onNavigate('school-years')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsDeleting(false)
    }
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
            <h1 className="comptes-title">Année scolaire</h1>
            <nav className="comptes-breadcrumb" aria-label="Fil d’Ariane">
              <button type="button" onClick={handleHomeNavigation}>Accueil</button>
              <ChevronRight aria-hidden="true" size={14} />
              <button type="button" onClick={handleBackNavigation}>Années scolaires</button>
              <ChevronRight aria-hidden="true" size={14} />
              <span className="comptes-breadcrumb-current">{schoolYear.name}</span>
            </nav>
          </div>
        </div>

        {!isEditingYear && (
          <div className="school-year-header-actions" aria-label="Actions sur l’année">
            <button
              type="button"
              className="details-mini-button"
              disabled={isClosed}
              onClick={handleStartYearEditing}
            >
              <Pencil aria-hidden="true" size={16} />
              Modifier
            </button>

            {!isClosed && !schoolYear.is_current && (
              <button
                type="button"
                className="details-mini-button"
                disabled={isYearActionPending}
                onClick={handleSetCurrentYear}
              >
                Définir comme courante
              </button>
            )}

            {!isClosed && (
              <button
                type="button"
                className="details-mini-button"
                disabled={isYearActionPending}
                onClick={handleCloseCurrentYear}
              >
                Clôturer
              </button>
            )}

            <button
              type="button"
              className="details-mini-button details-mini-button-danger"
              disabled={isClosed || isYearActionPending}
              onClick={handleOpenDeleteDialog}
              title={
                isClosed
                  ? 'Une année clôturée ne peut jamais être supprimée.'
                  : 'Supprimer définitivement cette année et ses données.'
              }
            >
              <Trash2 aria-hidden="true" size={16} />
              Supprimer
            </button>
          </div>
        )}
      </header>

      {!isEditingYear && (
      <section className="details-summary-card">
        <dl className="details-summary-facts">
          <div>
            <dt>Nom</dt>
            <dd>{schoolYear.name}</dd>
          </div>
          <div>
            <dt>Date de début</dt>
            <dd>{formatDate(schoolYear.start_date)}</dd>
          </div>
          <div>
            <dt>Date de fin</dt>
            <dd>{formatDate(schoolYear.end_date)}</dd>
          </div>
          <div>
            <dt>Statut</dt>
            <dd>
              {schoolYear.is_current && <span className="details-badge-success">Courante</span>}
              {isClosed && <span className="details-badge-danger">Clôturée</span>}
              {!schoolYear.is_current && !isClosed && (
                <span className="details-badge-info">Ouverte</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Clôturée le</dt>
            <dd>{formatDateTime(schoolYear.closed_at)}</dd>
          </div>
          <div>
            <dt>Clôturée par</dt>
            <dd className="details-technical-value">
              {schoolYear.closed_by_account_id ?? '—'}
            </dd>
          </div>
          <div>
            <dt>Date de création</dt>
            <dd>{formatDateTime(schoolYear.created_at)}</dd>
          </div>
          <div>
            <dt>Date de modification</dt>
            <dd>{formatDateTime(schoolYear.updated_at)}</dd>
          </div>
        </dl>
      </section>
      )}

      {isEditingYear && (
        <form className="school-year-global-form" onSubmit={handleYearFormSubmit}>
          <section className="details-panel">
            <h2>Informations de l’année</h2>
            <div className="details-form-grid">
              <div className="details-field">
                <label htmlFor="school-year-edit-name">Nom</label>
                <input
                  id="school-year-edit-name"
                  name="name"
                  value={yearEdit.name}
                  onChange={handleYearEditChange}
                  required
                />
              </div>
              <div className="details-field">
                <label htmlFor="school-year-edit-start">Date de début</label>
                <input
                  id="school-year-edit-start"
                  name="start_date"
                  type="date"
                  value={yearEdit.start_date}
                  onChange={handleYearEditChange}
                  required
                />
              </div>
              <div className="details-field">
                <label htmlFor="school-year-edit-end">Date de fin</label>
                <input
                  id="school-year-edit-end"
                  name="end_date"
                  type="date"
                  value={yearEdit.end_date}
                  onChange={handleYearEditChange}
                  required
                />
              </div>
            </div>
          </section>

          <section className="details-panel">
            <h2>Périodes</h2>
            <div className="school-year-period-edit-list">
              {periodEdits.map((period, index) => (
                <fieldset key={period.id} disabled={period.is_locked}>
                  <legend>
                    {period.is_locked && <Lock aria-hidden="true" size={14} />}
                    {period.name}
                  </legend>
                  <div className="details-form-grid">
                    <div className="details-field">
                      <label htmlFor={`period-edit-name-${period.id}`}>Nom</label>
                      <input
                        id={`period-edit-name-${period.id}`}
                        name="name"
                        data-period-index={index}
                        value={period.name}
                        onChange={handlePeriodEditChange}
                        required
                      />
                    </div>
                    <div className="details-field">
                      <label htmlFor={`period-edit-start-${period.id}`}>Date de début</label>
                      <input
                        id={`period-edit-start-${period.id}`}
                        type="date"
                        value={period.start_date}
                        disabled
                      />
                    </div>
                    <div className="details-field">
                      <label htmlFor={`period-edit-end-${period.id}`}>Date de fin</label>
                      <input
                        id={`period-edit-end-${period.id}`}
                        name="end_date"
                        type="date"
                        data-period-index={index}
                        value={period.end_date}
                        onChange={handlePeriodEditChange}
                        required
                      />
                    </div>
                  </div>
                </fieldset>
              ))}
            </div>
          </section>

          {errorMessage && <p className="comptes-error" role="alert">{errorMessage}</p>}

          <div className="school-year-global-form-actions">
            <button
              type="button"
              className="details-action-secondary"
              onClick={handleCancelYearEditing}
              disabled={isYearActionPending}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="details-action-primary"
              disabled={isYearActionPending}
            >
              {isYearActionPending ? 'Enregistrement…' : 'Valider les modifications'}
            </button>
          </div>
        </form>
      )}

      {!isEditingYear && (
        <>
      {errorMessage && (
        <p className="comptes-error" role="alert">{errorMessage}</p>
      )}

      <section className="details-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ margin: 0 }}>Périodes de l’année</h3>
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
              {isSubmitting
                ? 'Enregistrement…'
                : editingPeriodId
                  ? 'Modifier la période'
                  : 'Créer la période'}
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
                  <th>Date de création</th>
                  <th>Date de modification</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr
                    key={period.id}
                    className={
                      period.is_locked
                        ? 'comptes-table-row-locked'
                        : 'comptes-table-row-clickable'
                    }
                    onClick={() => handlePeriodSelection(period)}
                  >
                    <td>
                      {period.is_locked && <Lock aria-hidden="true" size={14} />}
                      {period.name}
                    </td>
                    <td>{formatDate(period.start_date)}</td>
                    <td>{formatDate(period.end_date)}</td>
                    <td>{formatDateTime(period.created_at)}</td>
                    <td>{formatDateTime(period.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
        </>
      )}

      {isDeleteDialogOpen && deletionPreview && (
        <div className="school-year-delete-overlay" role="presentation">
          <section
            className="school-year-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="school-year-delete-title"
          >
            <AlertTriangle
              className="school-year-delete-warning-icon"
              aria-hidden="true"
              size={32}
            />
            <h2 id="school-year-delete-title">Supprimer définitivement l’année ?</h2>
            <p>
              Cette action supprimera l’année <strong>{schoolYear.name}</strong> et
              toutes les données scolaires qui lui sont rattachées.
            </p>
            <ul>
              <li>{deletionPreview.reporting_periods} période(s)</li>
              <li>{deletionPreview.classes} classe(s)</li>
              <li>{deletionPreview.student_enrollments} inscription(s)</li>
              <li>{deletionPreview.class_subjects} association(s) classe-matière</li>
            </ul>
            <p className="school-year-delete-warning">
              Cette suppression est irréversible. Saisissez exactement
              <strong> {schoolYear.name}</strong> pour continuer.
            </p>

            <form onSubmit={handleDeleteSchoolYear}>
              <label htmlFor="school-year-delete-confirmation">
                Nom de l’année
              </label>
              <input
                id="school-year-delete-confirmation"
                value={deleteConfirmation}
                onChange={handleDeleteConfirmationChange}
                autoComplete="off"
                required
              />
              {errorMessage && (
                <p className="comptes-error" role="alert">{errorMessage}</p>
              )}
              <div className="school-year-delete-dialog-actions">
                <button
                  type="button"
                  className="details-action-secondary"
                  onClick={handleCloseDeleteDialog}
                  disabled={isDeleting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="school-year-delete-confirm-button"
                  disabled={
                    isDeleting || deleteConfirmation !== schoolYear.name
                  }
                >
                  {isDeleting ? 'Suppression…' : 'Valider la suppression'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
