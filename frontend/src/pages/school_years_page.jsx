import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'

import {
  createSchoolYear,
  getSchoolYears,
} from '../services/school_year_service'

const PAGE_SIZE = 10

/** Formate une date ISO pour l'affichage français. */
function formatDate(dateValue) {
  if (!dateValue) return '—'

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('fr-FR')
}

/** Retourne le libellé correspondant à l'état de l'année. */
function getYearStatusLabel(schoolYear) {
  if (schoolYear.closed_at) return 'Clôturée'
  if (schoolYear.is_current) return 'Courante'
  return 'Ouverte'
}

/** Retourne la classe de couleur correspondant à l'état de l'année. */
function getYearStatusClassName(schoolYear) {
  if (schoolYear.closed_at) return 'details-badge-danger'
  if (schoolYear.is_current) return 'details-badge-success'
  return 'details-badge-info'
}

/** Affiche la liste des années scolaires administrables. */
export default function SchoolYearsPage({ onNavigate }) {
  const [schoolYears, setSchoolYears] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
  })

  /** Charge les années depuis FastAPI. */
  async function loadSchoolYears() {
    setIsLoading(true)
    setErrorMessage('')

    try {
      setSchoolYears(await getSchoolYears())
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(function loadSchoolYearsEffect() {
    Promise.resolve().then(loadSchoolYears)
    // Le chargement initial doit être effectué une seule fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Met à jour un champ du formulaire. */
  function handleFormFieldChange(event) {
    const { name, value } = event.target
    setFormData(function updateFormData(previousData) {
      return { ...previousData, [name]: value }
    })
  }

  /** Crée une année puis recharge la liste. */
  async function handleCreateSubmit(event) {
    event.preventDefault()
    setFormError('')
    setIsSubmitting(true)

    try {
      await createSchoolYear(formData)
      setFormData({ name: '', start_date: '', end_date: '' })
      setIsFormOpen(false)
      await loadSchoolYears()
    } catch (error) {
      setFormError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  /** Ouvre la fiche de l'année sélectionnée. */
  function handleSchoolYearSelection(schoolYearId) {
    onNavigate('school-year-details', schoolYearId)
  }

  /** Affiche la page précédente. */
  function handlePreviousPage() {
    setCurrentPage(function selectPreviousPage(page) {
      return Math.max(1, page - 1)
    })
  }

  /** Affiche la page suivante. */
  function handleNextPage() {
    setCurrentPage(function selectNextPage(page) {
      return Math.min(totalPages, page + 1)
    })
  }

  /** Ouvre ou ferme le formulaire de création. */
  function handleToggleCreateForm() {
    setIsFormOpen(function toggleForm(open) {
      return !open
    })
  }

  /** Retourne vers la page d'accueil. */
  function handleHomeNavigation() {
    onNavigate('home')
  }

  const totalPages = Math.max(1, Math.ceil(schoolYears.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE
  const visibleSchoolYears = schoolYears.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  )

  return (
    <main className="comptes-main">
      <header className="comptes-heading">
        <div>
          <h1 className="comptes-title">Années scolaires</h1>
          <nav className="comptes-breadcrumb" aria-label="Fil d’Ariane">
            <button type="button" onClick={handleHomeNavigation}>
              Accueil
            </button>
            <ChevronRight aria-hidden="true" size={14} />
            <span className="comptes-breadcrumb-current">
              Années scolaires
            </span>
          </nav>
          <p className="comptes-description">
            Consultez et organisez les années scolaires de l’établissement.
          </p>
        </div>

        <button
          type="button"
          className="details-action-primary"
          onClick={handleToggleCreateForm}
        >
          {isFormOpen
            ? <X aria-hidden="true" size={16} />
            : <Plus aria-hidden="true" size={16} />}
          {isFormOpen ? 'Annuler' : 'Ajouter une année'}
        </button>
      </header>

      {errorMessage && (
        <p className="comptes-error" role="alert">
          {errorMessage}
        </p>
      )}

      <section
        className="comptes-list"
        aria-label="Liste des années scolaires"
      >
        {isFormOpen && (
          <form
            className="details-form-grid school-years-create-form"
            onSubmit={handleCreateSubmit}
          >
            <div className="details-field">
              <label htmlFor="school-year-name">Nom</label>
              <input
                id="school-year-name"
                name="name"
                type="text"
                placeholder="2026-2027"
                value={formData.name}
                onChange={handleFormFieldChange}
                required
              />
            </div>

            <div className="details-field">
              <label htmlFor="school-year-start">Date de début</label>
              <input
                id="school-year-start"
                name="start_date"
                type="date"
                value={formData.start_date}
                onChange={handleFormFieldChange}
                required
              />
            </div>

            <div className="details-field">
              <label htmlFor="school-year-end">Date de fin</label>
              <input
                id="school-year-end"
                name="end_date"
                type="date"
                value={formData.end_date}
                onChange={handleFormFieldChange}
                required
              />
            </div>

            {formError && (
              <p className="comptes-error details-field-full" role="alert">
                {formError}
              </p>
            )}

            <div className="details-field-full">
              <button
                type="submit"
                className="details-action-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Création…' : 'Créer l’année'}
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <p className="comptes-table-status">Chargement des années…</p>
        ) : schoolYears.length === 0 ? (
          <div className="comptes-empty-state">
            <p>Aucune année scolaire enregistrée.</p>
          </div>
        ) : (
          <>
            <div className="comptes-table-wrapper">
              <table className="comptes-table">
                <thead>
                  <tr>
                    <th>Année</th>
                    <th>Date de début</th>
                    <th>Date de fin</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSchoolYears.map(function renderSchoolYear(schoolYear) {
                    return (
                      <tr
                        key={schoolYear.id}
                        className="comptes-table-row-clickable"
                        onClick={() =>
                          handleSchoolYearSelection(schoolYear.id)
                        }
                      >
                        <td>{schoolYear.name}</td>
                        <td>{formatDate(schoolYear.start_date)}</td>
                        <td>{formatDate(schoolYear.end_date)}</td>
                        <td>
                          <span className={getYearStatusClassName(schoolYear)}>
                            {getYearStatusLabel(schoolYear)}
                          </span>
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
                {schoolYears.length} années
              </p>

              <div className="comptes-pagination-controls">
                <button
                  type="button"
                  className="comptes-pagination-button"
                  onClick={handlePreviousPage}
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
                  onClick={handleNextPage}
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
    </main>
  )
}
