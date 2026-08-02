import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { getSchoolClassesOverview, getSchoolClassSubjects } from '../services/school_classes_overview_service.js'
import { listStudents } from '../services/students_service.js'
import { MOCK_PERIODS, addMockGrade, listMockGrades } from '../services/notes_mock_service.js'
import '../styles/notes_page.css'

const EMPTY_FORM = {
  class_id: '',
  subject_id: '',
  student_id: '',
  period_id: MOCK_PERIODS[0]?.id ?? '',
  score: '',
  coefficient: '1',
  grade_date: new Date().toISOString().slice(0, 10),
  comment: '',
}

function formatScore(score) {
  return Number(score).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function NotesPage({ onNavigate }) {
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [classes, setClasses] = useState([])
  const [grades, setGrades] = useState([])

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formClassSubjects, setFormClassSubjects] = useState([])
  const [formStudents, setFormStudents] = useState([])
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    getSchoolClassesOverview({ limit: 500 }).then(setClasses).catch(console.error)
    refreshGrades()
  }, [])

  function refreshGrades(overrides = {}) {
    setGrades(listMockGrades({
      classId: 'classId' in overrides ? overrides.classId : classFilter,
      subjectId: 'subjectId' in overrides ? overrides.subjectId : subjectFilter,
      periodId: 'periodId' in overrides ? overrides.periodId : periodFilter,
      q: 'q' in overrides ? overrides.q : query,
    }))
  }

  function handleSearch(event) {
    event.preventDefault()
    refreshGrades()
  }

  function handleReset() {
    setQuery('')
    setClassFilter('')
    setSubjectFilter('')
    setPeriodFilter('')
    refreshGrades({ classId: '', subjectId: '', periodId: '', q: '' })
  }

  const subjectOptionsForFilter = useMemo(() => {
    const seen = new Map()
    grades.forEach((grade) => seen.set(grade.subject_id, grade.subject_name))
    return [...seen.entries()]
  }, [grades])

  async function openCreateModal() {
    setForm(EMPTY_FORM)
    setFormClassSubjects([])
    setFormStudents([])
    setFormError('')
    setShowModal(true)
  }

  function closeModal() {
    if (!formLoading) setShowModal(false)
  }

  async function handleClassChange(classId) {
    setForm((current) => ({ ...current, class_id: classId, subject_id: '', student_id: '', coefficient: '1' }))
    if (!classId) {
      setFormClassSubjects([])
      setFormStudents([])
      return
    }
    try {
      const [subjects, students] = await Promise.all([
        getSchoolClassSubjects(classId),
        listStudents({ class_id: classId, limit: 200 }),
      ])
      setFormClassSubjects(subjects)
      setFormStudents(Array.isArray(students) ? students : students.items ?? [])
    } catch (error) {
      setFormError(error.message)
    }
  }

  function handleSubjectChange(subjectId) {
    const matched = formClassSubjects.find((item) => item.subject_id === subjectId)
    setForm((current) => ({
      ...current,
      subject_id: subjectId,
      coefficient: matched ? String(matched.coefficient) : current.coefficient,
    }))
  }

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const score = parseFloat(form.score)
    if (Number.isNaN(score) || score < 0 || score > 20) {
      setFormError('La note doit être comprise entre 0 et 20.')
      return
    }
    if (!form.class_id || !form.subject_id || !form.student_id) {
      setFormError('Classe, matière et élève sont obligatoires.')
      return
    }
    const schoolClass = classes.find((item) => item.id === form.class_id)
    const subject = formClassSubjects.find((item) => item.subject_id === form.subject_id)
    const student = formStudents.find((item) => item.id === form.student_id)
    const period = MOCK_PERIODS.find((item) => item.id === form.period_id)

    setFormLoading(true)
    addMockGrade({
      class_id: form.class_id,
      class_name: schoolClass ? `${schoolClass.level_name} ${schoolClass.group_label}` : '—',
      subject_id: form.subject_id,
      subject_name: subject?.name ?? '—',
      student_id: form.student_id,
      student_name: student ? `${student.first_name} ${student.last_name}` : '—',
      period_id: form.period_id,
      period_name: period?.name ?? '—',
      score,
      coefficient: parseFloat(form.coefficient) || 1,
      grade_date: form.grade_date,
      comment: form.comment || null,
    })
    setFormLoading(false)
    setShowModal(false)
    refreshGrades()
  }

  return (
    <main className="ntp-main">
      <div className="ntp-topbar">
        <div>
          <h1 className="ntp-title">Gestion des notes</h1>
          <nav className="ntp-breadcrumb">
            <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
            <span>›</span>
            <span>Notes</span>
          </nav>
        </div>
        <button type="button" className="ntp-btn-primary" onClick={openCreateModal}>
          <span className="ntp-btn-primary__plus">+</span> Ajouter une note
        </button>
      </div>

      <div className="ntp-demo-banner" role="status">
        Écran de démonstration : les notes saisies ici restent dans ce navigateur, elles ne sont pas encore enregistrées en base.
      </div>

      <form onSubmit={handleSearch} className="ntp-filters">
        <label className="ntp-search">
          <Search className="ntp-search__icon" aria-hidden="true" size={18} />
          <input
            type="search"
            aria-label="Rechercher un élève"
            placeholder="Rechercher un élève..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map((schoolClass) => (
            <option key={schoolClass.id} value={schoolClass.id}>
              {schoolClass.level_name} {schoolClass.group_label}
            </option>
          ))}
        </select>

        <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
          <option value="">Toutes les matières</option>
          {subjectOptionsForFilter.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>

        <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
          <option value="">Toutes les périodes</option>
          {MOCK_PERIODS.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
        </select>

        <button type="submit" className="ntp-btn-search">Rechercher</button>
        <button type="button" className="ntp-btn-reset" onClick={handleReset}>⟲ Réinitialiser</button>
      </form>

      <section className="ntp-list">
        <div className="ntp-list__meta">
          <span>{grades.length} note{grades.length > 1 ? 's' : ''} affichée{grades.length > 1 ? 's' : ''}</span>
        </div>

        <div className="ntp-table-wrapper">
          <table className="ntp-table">
            <thead>
              <tr>
                <th>Élève</th>
                <th>Classe</th>
                <th>Matière</th>
                <th>Période</th>
                <th>Note</th>
                <th>Coefficient</th>
                <th>Date</th>
                <th>Appréciation</th>
              </tr>
            </thead>
            <tbody>
              {grades.length === 0 ? (
                <tr><td colSpan={8} className="ntp-loading">Aucune note enregistrée. Ajoutez-en une pour tester l'écran.</td></tr>
              ) : (
                grades.map((grade) => (
                  <tr key={grade.id}>
                    <td><strong>{grade.student_name}</strong></td>
                    <td>{grade.class_name}</td>
                    <td>{grade.subject_name}</td>
                    <td>{grade.period_name}</td>
                    <td>{formatScore(grade.score)}/20</td>
                    <td>{grade.coefficient}</td>
                    <td>{new Intl.DateTimeFormat('fr-FR').format(new Date(grade.grade_date))}</td>
                    <td>{grade.comment || '—'}</td>
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
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="ntp-modal__header">
              <div>
                <h2 id="ntp-modal-title">Ajouter une note</h2>
                <p>Sélectionnez la classe, puis l'élève et la matière concernés.</p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Fermer">×</button>
            </div>

            <form className="ntp-modal__form" onSubmit={handleSubmit}>
              <label>
                Classe *
                <select name="class_id" value={form.class_id} onChange={(event) => handleClassChange(event.target.value)} required>
                  <option value="">Sélectionner une classe</option>
                  {classes.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.level_name} {schoolClass.group_label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Matière *
                <select
                  name="subject_id"
                  value={form.subject_id}
                  onChange={(event) => handleSubjectChange(event.target.value)}
                  disabled={!form.class_id}
                  required
                >
                  <option value="">Sélectionner une matière</option>
                  {formClassSubjects.map((subject) => (
                    <option key={subject.subject_id} value={subject.subject_id}>{subject.name}</option>
                  ))}
                </select>
              </label>

              <label className="ntp-modal__wide-field">
                Élève *
                <select name="student_id" value={form.student_id} onChange={updateField} disabled={!form.class_id} required>
                  <option value="">Sélectionner un élève</option>
                  {formStudents.map((student) => (
                    <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>
                  ))}
                </select>
              </label>

              <label>
                Note /20 *
                <input name="score" type="number" min="0" max="20" step="0.25" value={form.score} onChange={updateField} required />
              </label>

              <label>
                Coefficient
                <input name="coefficient" type="number" min="0.01" step="0.01" value={form.coefficient} onChange={updateField} />
              </label>

              <label>
                Période
                <select name="period_id" value={form.period_id} onChange={updateField}>
                  {MOCK_PERIODS.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
                </select>
              </label>

              <label>
                Date
                <input name="grade_date" type="date" value={form.grade_date} onChange={updateField} />
              </label>

              <label className="ntp-modal__wide-field">
                Appréciation
                <textarea name="comment" value={form.comment} onChange={updateField} rows="2" />
              </label>

              {formError && <p className="ntp-modal__error" role="alert">{formError}</p>}

              <div className="ntp-modal__actions">
                <button type="button" className="ntp-btn-reset" onClick={closeModal}>Annuler</button>
                <button type="submit" className="ntp-btn-primary" disabled={formLoading}>Ajouter la note</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
