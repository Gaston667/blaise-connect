import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react'

import { useToast } from '../components/feedback/ToastProvider.jsx'
import { createGrade, getGradeOptions, listGrades } from '../services/notes_service.js'
import '../styles/notes_page.css'

const EMPTY_OPTIONS = {
  classes: [],
  subjects: [],
  periods: [],
  assessments: [],
  students: [],
}

const EMPTY_FORM = {
  class_id: '',
  subject_id: '',
  assessment_id: '',
  student_enrollment_id: '',
  result_type: 'SCORED',
  score: '',
  justification_status: 'UNJUSTIFIED',
  comment: '',
}

function formatNumber(value) {
  return Number(value).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatDate(value) {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

function formatDecimal(value) {
  return Number(value).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatGradeResult(grade) {
  if (grade.result_type === 'ABSENT') {
    return grade.justification_status === 'PENDING'
      ? 'Absent — justificatif en attente'
      : 'Absent — non justifié'
  }
  return `${formatNumber(grade.score)}/${formatNumber(grade.maximum_score)}`
}

export default function NotesPage({ onNavigate }) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [assessmentFilter, setAssessmentFilter] = useState('')
  const [resultTypeFilter, setResultTypeFilter] = useState('')
  const [filterOptions, setFilterOptions] = useState(EMPTY_OPTIONS)
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [createOptions, setCreateOptions] = useState(EMPTY_OPTIONS)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(function loadInitialOptionsEffect() {
    loadFilterOptions()
  }, [])

  useEffect(function loadGradesEffect() {
    refreshGrades()
  }, [query, classFilter, subjectFilter, periodFilter])

  useEffect(function keepAssessmentFilterValid() {
    if (!assessmentFilter) return
    const exists = grades.some((grade) => grade.assessment_id === assessmentFilter)
    if (!exists) setAssessmentFilter('')
  }, [grades, assessmentFilter])

  async function loadFilterOptions() {
    try {
      const options = await getGradeOptions()
      setFilterOptions(options)
    } catch (error) {
      setPageError(error.message)
      toast.error(error.message)
    }
  }

  async function refreshGrades() {
    setLoading(true)
    setPageError('')
    try {
      const loadedGrades = await listGrades({
        q: query,
        classId: classFilter,
        subjectId: subjectFilter,
        periodId: periodFilter,
      })
      setGrades(loadedGrades)
    } catch (error) {
      setGrades([])
      setPageError(error.message)
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setQuery('')
    setClassFilter('')
    setSubjectFilter('')
    setPeriodFilter('')
  }

  function handleHomeNavigation() {
    onNavigate?.('home')
  }

  function preventFilterSubmit(event) {
    event.preventDefault()
  }

  function handleQueryChange(event) {
    setQuery(event.target.value)
  }

  function handleClassFilterChange(event) {
    setClassFilter(event.target.value)
  }

  function handleSubjectFilterChange(event) {
    setSubjectFilter(event.target.value)
  }

  function handlePeriodFilterChange(event) {
    setPeriodFilter(event.target.value)
  }

  function handleAssessmentFilterChange(event) {
    setAssessmentFilter(event.target.value)
  }

  function handleResultTypeFilterChange(event) {
    setResultTypeFilter(event.target.value)
  }

  async function openCreateModal() {
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
    try {
      setCreateOptions(await getGradeOptions())
    } catch (error) {
      setFormError(error.message)
    }
  }

  function closeModal() {
    if (!formLoading) setShowModal(false)
  }

  function stopModalPropagation(event) {
    event.stopPropagation()
  }

  async function handleClassChange(event) {
    const classId = event.target.value
    setForm({ ...EMPTY_FORM, class_id: classId })
    setFormError('')
    try {
      setCreateOptions(await getGradeOptions({ classId }))
    } catch (error) {
      setFormError(error.message)
    }
  }

  async function handleSubjectChange(event) {
    const subjectId = event.target.value
    const nextForm = {
      ...form,
      subject_id: subjectId,
      assessment_id: '',
      student_enrollment_id: '',
    }
    setForm(nextForm)
    setFormError('')
    try {
      setCreateOptions(await getGradeOptions({
        classId: nextForm.class_id,
        subjectId,
      }))
    } catch (error) {
      setFormError(error.message)
    }
  }

  async function handleAssessmentChange(event) {
    const assessmentId = event.target.value
    const nextForm = {
      ...form,
      assessment_id: assessmentId,
      student_enrollment_id: '',
      score: '',
    }
    setForm(nextForm)
    setFormError('')
    try {
      setCreateOptions(await getGradeOptions({
        classId: nextForm.class_id,
        subjectId: nextForm.subject_id,
        assessmentId,
      }))
    } catch (error) {
      setFormError(error.message)
    }
  }

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleResultTypeChange(event) {
    const resultType = event.target.value
    setForm((current) => ({
      ...current,
      result_type: resultType,
      score: resultType === 'ABSENT' ? '' : current.score,
      justification_status: resultType === 'ABSENT' ? 'UNJUSTIFIED' : '',
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const selectedAssessment = createOptions.assessments.find(
      (assessment) => assessment.id === form.assessment_id,
    )
    if (!selectedAssessment || !form.student_enrollment_id) {
      setFormError('La classe, la matière, l’évaluation et l’élève sont obligatoires.')
      return
    }
    if (form.result_type === 'SCORED') {
      const score = Number(form.score)
      if (!Number.isFinite(score) || score < 0 || score > Number(selectedAssessment.maximum_score)) {
        setFormError(`La note doit être comprise entre 0 et ${formatNumber(selectedAssessment.maximum_score)}.`)
        return
      }
    }

    setFormLoading(true)
    try {
      await createGrade({
        assessment_id: form.assessment_id,
        student_enrollment_id: form.student_enrollment_id,
        result_type: form.result_type,
        score: form.result_type === 'SCORED' ? Number(form.score) : null,
        justification_status: form.result_type === 'ABSENT'
          ? form.justification_status
          : null,
        comment: form.comment.trim() || null,
      })
      setShowModal(false)
      toast.success('La note a été enregistrée en base de données.')
      await refreshGrades()
    } catch (error) {
      setFormError(error.message)
      toast.error(error.message)
    } finally {
      setFormLoading(false)
    }
  }

  const assessmentOptions = useMemo(() => {
    const byAssessment = new Map()
    grades.forEach((grade) => {
      if (!byAssessment.has(grade.assessment_id)) {
        byAssessment.set(grade.assessment_id, {
          id: grade.assessment_id,
          title: grade.assessment_title,
          date: grade.assessment_date,
          className: grade.class_name,
          subjectName: grade.subject_name,
        })
      }
    })
    return [...byAssessment.values()]
  }, [grades])

  const visibleGrades = useMemo(() => {
    return grades.filter((grade) => {
      const matchesAssessment = !assessmentFilter || grade.assessment_id === assessmentFilter
      const matchesResultType = !resultTypeFilter || grade.result_type === resultTypeFilter
      return matchesAssessment && matchesResultType
    })
  }, [grades, assessmentFilter, resultTypeFilter])

  const selectedAssessment = useMemo(() => {
    if (assessmentFilter) {
      return assessmentOptions.find((item) => item.id === assessmentFilter) || null
    }
    return null
  }, [assessmentFilter, assessmentOptions])

  const displayGrades = useMemo(() => {
    if (!selectedAssessment) return visibleGrades
    return visibleGrades.filter((grade) => grade.assessment_id === selectedAssessment.id)
  }, [selectedAssessment, visibleGrades])

  const stats = useMemo(() => {
    const scoredGrades = visibleGrades.filter((grade) => grade.result_type === 'SCORED')
    const absentGrades = visibleGrades.filter((grade) => grade.result_type === 'ABSENT')
    const studentsCount = new Set(visibleGrades.map((grade) => grade.student_enrollment_id)).size
    const weightedAverage = scoredGrades.length === 0
      ? null
      : scoredGrades.reduce((sum, grade) => sum + ((Number(grade.score) / Number(grade.maximum_score)) * 20), 0) / scoredGrades.length

    return {
      assessmentsCount: new Set(visibleGrades.map((grade) => grade.assessment_id)).size,
      scoredCount: scoredGrades.length,
      totalCount: visibleGrades.length,
      absenceCount: absentGrades.length,
      studentsCount,
      weightedAverage,
    }
  }, [visibleGrades])

  const visibleAssessmentList = useMemo(() => {
    const byAssessment = new Map()
    visibleGrades.forEach((grade) => {
      if (!byAssessment.has(grade.assessment_id)) {
        byAssessment.set(grade.assessment_id, {
          id: grade.assessment_id,
          title: grade.assessment_title,
          subjectName: grade.subject_name,
          className: grade.class_name,
          assessmentDate: grade.assessment_date,
          gradeCount: 1,
        })
        return
      }

      const current = byAssessment.get(grade.assessment_id)
      current.gradeCount += 1
    })

    return [...byAssessment.values()]
  }, [visibleGrades])

  const assessmentMeta = displayGrades[0] || null

  return (
    <main className="ntp-main">
      <div className="ntp-topbar">
        <div>
          <h1 className="ntp-title">Gestion des notes</h1>
          <nav className="ntp-breadcrumb" aria-label="Fil d’Ariane">
            <button type="button" onClick={handleHomeNavigation}>Accueil</button>
            <span>›</span>
            <button type="button" onClick={() => onNavigate?.('notes')}>Notes</button>
            <span>›</span>
            <span>Notes</span>
          </nav>
          <p className="ntp-subtitle">Consultez, saisissez et gérez les notes des élèves.</p>
        </div>
      </div>

      {pageError && <p className="ntp-page-error" role="alert">{pageError}</p>}

      <section className="ntp-stats" aria-label="Résumé des notes">
        <article className="ntp-stat-card">
          <span className="ntp-stat-icon ntp-stat-icon--violet"><ClipboardCheck size={20} aria-hidden="true" /></span>
          <div>
            <strong>{stats.assessmentsCount}</strong>
            <span>Évaluations</span>
            <small>Cette période</small>
          </div>
        </article>
        <article className="ntp-stat-card">
          <span className="ntp-stat-icon ntp-stat-icon--green"><CheckCircle2 size={20} aria-hidden="true" /></span>
          <div>
            <strong>{stats.scoredCount} / {stats.totalCount}</strong>
            <span>Notes saisies</span>
            <small>{stats.totalCount === 0 ? '0%' : `${formatDecimal((stats.scoredCount / stats.totalCount) * 100)}%`}</small>
          </div>
        </article>
        <article className="ntp-stat-card">
          <span className="ntp-stat-icon ntp-stat-icon--blue"><BarChart3 size={20} aria-hidden="true" /></span>
          <div>
            <strong>{stats.weightedAverage === null ? '—' : `${formatDecimal(stats.weightedAverage)} / 20`}</strong>
            <span>Moyenne générale</span>
            <small>Toutes classes</small>
          </div>
        </article>
        <article className="ntp-stat-card">
          <span className="ntp-stat-icon ntp-stat-icon--orange"><Users size={20} aria-hidden="true" /></span>
          <div>
            <strong>{stats.studentsCount}</strong>
            <span>Élèves concernés</span>
            <small>Absences : {stats.absenceCount}</small>
          </div>
        </article>
      </section>

      <form onSubmit={preventFilterSubmit} className="ntp-filters">
        <div className="ntp-filters__row ntp-filters__row--top">
          <label>
            Classe
            <select value={classFilter} onChange={handleClassFilterChange}>
              <option value="">Toutes les classes</option>
              {filterOptions.classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
              ))}
            </select>
          </label>

          <label>
            Matière
            <select value={subjectFilter} onChange={handleSubjectFilterChange}>
              <option value="">Toutes les matières</option>
              {filterOptions.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </label>

          <label>
            Période / Évaluation
            <select value={assessmentFilter} onChange={handleAssessmentFilterChange}>
              <option value="">Toutes les évaluations</option>
              {assessmentOptions.map((assessment) => (
                <option key={assessment.id} value={assessment.id}>
                  {assessment.title} — {assessment.className}
                </option>
              ))}
            </select>
          </label>

          <label>
            Type de résultat
            <select value={resultTypeFilter} onChange={handleResultTypeFilterChange}>
              <option value="">Tous</option>
              <option value="SCORED">Noté</option>
              <option value="ABSENT">Absent</option>
            </select>
          </label>

          <button type="button" className="ntp-btn-reset" onClick={handleReset}>
            <RotateCcw size={15} aria-hidden="true" /> Réinitialiser
          </button>

          <button type="button" className="ntp-btn-primary" onClick={openCreateModal}>
            <Plus size={16} aria-hidden="true" /> Nouvelle évaluation
          </button>
        </div>

        <div className="ntp-filters__row ntp-filters__row--search">
          <label className="ntp-search">
            <Search className="ntp-search__icon" aria-hidden="true" size={18} />
            <input
              type="search"
              aria-label="Rechercher un élève"
              placeholder="Rechercher un élève, une classe, une matière..."
              value={query}
              onChange={handleQueryChange}
            />
          </label>

          <label>
            Période scolaire
            <select value={periodFilter} onChange={handlePeriodFilterChange}>
              <option value="">Toutes les périodes</option>
              {filterOptions.periods.map((period) => (
                <option key={period.id} value={period.id}>{period.name}</option>
              ))}
            </select>
          </label>
        </div>
      </form>

      <section className="ntp-list">
        <header className="ntp-evaluation-head">
          <div>
            <h3>{selectedAssessment?.title || 'Toutes les évaluations'}</h3>
            <span className="ntp-evaluation-tag">{selectedAssessment ? 'Évaluation notée' : 'Vue globale'}</span>
            {selectedAssessment && assessmentMeta && (
              <p>
                <span>Matière : {assessmentMeta.subject_name}</span>
                <span>Classe : {assessmentMeta.class_name}</span>
                <span>Date : {formatDate(assessmentMeta.assessment_date)}</span>
                <span>Note maximale : {formatNumber(assessmentMeta.maximum_score)}</span>
                <span>Coefficient : {formatNumber(assessmentMeta.coefficient)}</span>
              </p>
            )}
            {!selectedAssessment && visibleAssessmentList.length > 0 && (
              <div className="ntp-evaluation-list" aria-label="Liste des évaluations visibles">
                {visibleAssessmentList.map((assessment) => (
                  <article key={assessment.id} className="ntp-evaluation-list__item">
                    <strong>{assessment.title}</strong>
                    <span>{assessment.subjectName}</span>
                    <span>{assessment.className}</span>
                    <span>{formatDate(assessment.assessmentDate)}</span>
                    <small>{assessment.gradeCount} note{assessment.gradeCount > 1 ? 's' : ''}</small>
                  </article>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="ntp-table-wrapper">
          <table className="ntp-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Élève</th>
                <th>Matière</th>
                <th>Date</th>
                <th>Coefficient</th>
                <th>Statut</th>
                <th>Note saisie</th>
                <th>Absent</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="ntp-loading">Chargement des notes…</td></tr>
              ) : displayGrades.length === 0 ? (
                <tr><td colSpan={8} className="ntp-loading">Aucune note enregistrée. Ajoutez-en une pour tester l'écran.</td></tr>
              ) : (
                displayGrades.map((grade, index) => (
                  <tr key={grade.id}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{grade.student_name}</strong>
                      <small>{grade.registration_number}</small>
                    </td>
                    <td>{grade.subject_name}</td>
                    <td>{formatDate(grade.assessment_date)}</td>
                    <td>{formatNumber(grade.coefficient)}</td>
                    <td>
                      <span className={grade.result_type === 'ABSENT' ? 'ntp-status ntp-status--absent' : 'ntp-status ntp-status--scored'}>
                        {grade.result_type === 'ABSENT' ? 'Absent' : 'Noté'}
                      </span>
                    </td>
                    <td>
                      <div className={grade.result_type === 'ABSENT' ? 'ntp-grade-input ntp-grade-input--muted' : 'ntp-grade-input'}>
                        {grade.result_type === 'ABSENT' ? '—' : formatDecimal((Number(grade.score) / Number(grade.maximum_score)) * 20)}
                      </div>
                    </td>
                    <td>
                      <input type="checkbox" checked={grade.result_type === 'ABSENT'} readOnly aria-label="Absent" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <div className="ntp-modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <section
            className="ntp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ntp-modal-title"
            onMouseDown={stopModalPropagation}
          >
            <div className="ntp-modal__header">
              <div>
                <h2 id="ntp-modal-title">Ajouter une note</h2>
                <p>Choisissez une évaluation existante, puis l’élève concerné.</p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Fermer">×</button>
            </div>

            <form className="ntp-modal__form" onSubmit={handleSubmit}>
              <label>
                Classe *
                <select name="class_id" value={form.class_id} onChange={handleClassChange} required>
                  <option value="">Sélectionner une classe</option>
                  {filterOptions.classes.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Matière *
                <select name="subject_id" value={form.subject_id} onChange={handleSubjectChange} disabled={!form.class_id} required>
                  <option value="">Sélectionner une matière</option>
                  {createOptions.subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>

              <label className="ntp-modal__wide-field">
                Évaluation *
                <select name="assessment_id" value={form.assessment_id} onChange={handleAssessmentChange} disabled={!form.subject_id} required>
                  <option value="">Sélectionner une évaluation</option>
                  {createOptions.assessments.map((assessment) => (
                    <option key={assessment.id} value={assessment.id}>
                      {assessment.title} — {formatDate(assessment.assessment_date)} — /{formatNumber(assessment.maximum_score)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="ntp-modal__wide-field">
                Élève *
                <select name="student_enrollment_id" value={form.student_enrollment_id} onChange={updateField} disabled={!form.assessment_id} required>
                  <option value="">Sélectionner un élève sans résultat</option>
                  {createOptions.students.map((student) => (
                    <option key={student.enrollment_id} value={student.enrollment_id}>
                      {student.name} — {student.registration_number}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Type de résultat *
                <select name="result_type" value={form.result_type} onChange={handleResultTypeChange}>
                  <option value="SCORED">Note chiffrée</option>
                  <option value="ABSENT">Absent</option>
                </select>
              </label>

              {form.result_type === 'SCORED' ? (
                <label>
                  Note *
                  <input
                    name="score"
                    type="number"
                    min="0"
                    max={createOptions.assessments.find((item) => item.id === form.assessment_id)?.maximum_score ?? undefined}
                    step="0.01"
                    value={form.score}
                    onChange={updateField}
                    required
                  />
                </label>
              ) : (
                <label>
                  Justification
                  <select name="justification_status" value={form.justification_status} onChange={updateField}>
                    <option value="UNJUSTIFIED">Non justifiée</option>
                    <option value="PENDING">Justificatif en attente</option>
                  </select>
                </label>
              )}

              <label className="ntp-modal__wide-field">
                Appréciation
                <textarea name="comment" value={form.comment} onChange={updateField} rows="3" maxLength="2000" />
              </label>

              {formError && <p className="ntp-modal__error" role="alert">{formError}</p>}

              <div className="ntp-modal__actions">
                <button type="button" className="ntp-btn-reset" onClick={closeModal}>Annuler</button>
                <button type="submit" className="ntp-btn-primary" disabled={formLoading}>
                  {formLoading ? 'Enregistrement…' : 'Enregistrer la note'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
