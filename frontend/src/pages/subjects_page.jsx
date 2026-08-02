import { formatProfileName } from '../utils/profileDisplay.js'
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'

import { getTeachersOverview } from '../services/teachers_overview_service.js'
import { getSchoolClassesOverview } from '../services/school_classes_overview_service.js'
import { createSubject, getSubjectsOverview, updateSubject } from '../services/subject_service.js'
import '../styles/subjects_page.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50]

const AVATAR_PALETTE = [
  { bg: '#E8ECFB', fg: '#3355DD' },
  { bg: '#FDEBEA', fg: '#D9534F' },
  { bg: '#FFF3DC', fg: '#B8860B' },
  { bg: '#E9F7EF', fg: '#2E9E6B' },
  { bg: '#F3E9FB', fg: '#8E44AD' },
  { bg: '#FCE9F3', fg: '#C2185B' },
]

function subjectBadge(name) {
  const idx = (name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[idx]
}

function subjectInitials(name) {
  const words = (name ?? '').trim().split(/[\s-]+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words.map((word) => word[0]).slice(0, 3).join('').toUpperCase()
}

function formatCoefficient(coefficient) {
  return coefficient === null || coefficient === undefined ? '—' : coefficient.toFixed(2)
}

const EMPTY_SUBJECT_FORM = { name: '', description: '', is_active: true }

export default function SubjectsPage({ onNavigate }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [editingId, setEditingId] = useState(null)
  const [subjectForm, setSubjectForm] = useState(EMPTY_SUBJECT_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState('')

  useEffect(() => {
    fetchSubjects()
    fetchFilterOptions()
  }, [])

  async function fetchSubjects(filters = {}) {
    setLoading(true)
    try {
      const data = await getSubjectsOverview({
        q: 'q' in filters ? filters.q : query,
        classId: 'classId' in filters ? filters.classId : classFilter,
        teacherId: 'teacherId' in filters ? filters.teacherId : teacherFilter,
        isActive: 'isActive' in filters ? filters.isActive : statusFilter,
      })
      setSubjects(data)
      setPage(0)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchFilterOptions() {
    try {
      const [classList, teacherList] = await Promise.all([
        getSchoolClassesOverview({ limit: 500 }),
        getTeachersOverview(),
      ])
      setClasses(classList)
      setTeachers(teacherList)
    } catch (error) {
      console.error(error)
    }
  }

  function handleSearch(event) {
    event.preventDefault()
    fetchSubjects()
  }

  function handleReset() {
    setQuery('')
    setStatusFilter('')
    setClassFilter('')
    setTeacherFilter('')
    fetchSubjects({ q: '', isActive: '', classId: '', teacherId: '' })
  }

  function openCreateModal() {
    setModalMode('create')
    setEditingId(null)
    setSubjectForm(EMPTY_SUBJECT_FORM)
    setFormError('')
    setShowModal(true)
  }

  function openEditModal(subject) {
    setModalMode('edit')
    setEditingId(subject.id)
    setSubjectForm({ name: subject.name, description: subject.description ?? '', is_active: subject.is_active })
    setFormError('')
    setShowModal(true)
  }

  function closeModal() {
    if (!submitting) setShowModal(false)
  }

  function updateFormField(event) {
    const { name, value, type, checked } = event.target
    setSubjectForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')
    try {
      const payload = { name: subjectForm.name, description: subjectForm.description || null }
      if (modalMode === 'create') {
        await createSubject(payload)
        setConfirmationMessage('La matière a été créée avec succès.')
      } else {
        await updateSubject(editingId, { ...payload, is_active: subjectForm.is_active })
        setConfirmationMessage('La matière a été mise à jour avec succès.')
      }
      setShowModal(false)
      await fetchSubjects()
    } catch (error) {
      setFormError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  function exportToCsv() {
    const header = ['Matière', 'Description', 'Coefficient', 'Enseignants affectés']
    const rows = subjects.map((subject) => [
      subject.name,
      subject.description ?? '',
      formatCoefficient(subject.coefficient),
      subject.teacher_count,
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'matieres.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const pageCount = Math.max(1, Math.ceil(subjects.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = subjects.slice(safePage * pageSize, safePage * pageSize + pageSize)

  return (
    <main className="sjp-main">
      <div className="sjp-topbar">
        <div>
          <h1 className="sjp-title">Gestion des matières</h1>
          <nav className="sjp-breadcrumb">
            <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
            <span>›</span>
            <span>Matières</span>
          </nav>
        </div>
        <button type="button" className="sjp-btn-primary" onClick={openCreateModal}>
          <span className="sjp-btn-primary__plus">+</span> Ajouter une matière
        </button>
      </div>

      {confirmationMessage && (
        <div className="sjp-confirmation" role="status">
          <span>{confirmationMessage}</span>
          <button type="button" onClick={() => setConfirmationMessage('')} aria-label="Fermer">×</button>
        </div>
      )}

      <form onSubmit={handleSearch} className="sjp-filters">
        <label className="sjp-search">
          <Search className="sjp-search__icon" aria-hidden="true" size={18} />
          <input
            type="search"
            aria-label="Rechercher une matière"
            placeholder="Rechercher une matière..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Toutes les matières</option>
          <option value="true">Actives</option>
          <option value="false">Inactives</option>
        </select>

        <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map((schoolClass) => (
            <option key={schoolClass.id} value={schoolClass.id}>
              {schoolClass.level_name} {schoolClass.group_label}
            </option>
          ))}
        </select>

        <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}>
          <option value="">Tous les enseignants</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {formatProfileName(teacher.first_name, teacher.last_name, teacher.gender)}
            </option>
          ))}
        </select>

        <button type="submit" className="sjp-btn-search">Rechercher</button>
        <button type="button" className="sjp-btn-reset" onClick={handleReset}>⟲ Réinitialiser</button>
      </form>

      <section className="sjp-list">
        <div className="sjp-list__meta">
          <span>
            {loading
              ? 'Chargement…'
              : `Affichage de ${subjects.length === 0 ? 0 : safePage * pageSize + 1} à ${Math.min(subjects.length, (safePage + 1) * pageSize)} sur ${subjects.length} matières`}
          </span>
          <button type="button" className="sjp-btn-reset" onClick={exportToCsv}>⭳ Exporter</button>
        </div>

        <div className="sjp-table-wrapper">
          <table className="sjp-table">
            <thead>
              <tr>
                <th>Matière</th>
                <th>Description</th>
                <th>Coefficient</th>
                <th>Enseignants affectés</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="sjp-loading">Chargement…</td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={4} className="sjp-loading">Aucune matière trouvée.</td></tr>
              ) : (
                pageItems.map((subject) => {
                  const badge = subjectBadge(subject.name)
                  return (
                    <tr key={subject.id} className="sjp-row" onClick={() => openEditModal(subject)}>
                      <td>
                        <div className="sjp-name-cell">
                          <span className="sjp-avatar" style={{ background: badge.bg, color: badge.fg }}>
                            {subjectInitials(subject.name)}
                          </span>
                          {subject.name}
                        </div>
                      </td>
                      <td>{subject.description || '—'}</td>
                      <td>{formatCoefficient(subject.coefficient)}</td>
                      <td>{subject.teacher_count} enseignant{subject.teacher_count > 1 ? 's' : ''}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="sjp-pagination">
          <div className="sjp-pagination__buttons">
            <button type="button" disabled={safePage === 0} onClick={() => setPage((current) => current - 1)}>‹</button>
            {Array.from({ length: pageCount }).slice(0, 5).map((_, index) => (
              <button
                type="button"
                key={index}
                className={index === safePage ? 'sjp-page sjp-page--active' : 'sjp-page'}
                onClick={() => setPage(index)}
              >
                {index + 1}
              </button>
            ))}
            <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage((current) => current + 1)}>›</button>
          </div>
          <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }}>
            {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} par page</option>)}
          </select>
        </footer>
      </section>

      {showModal && (
        <div className="sjp-modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <section
            className="sjp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sjp-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sjp-modal__header">
              <div>
                <h2 id="sjp-modal-title">{modalMode === 'create' ? 'Ajouter une matière' : 'Modifier la matière'}</h2>
                <p>Renseignez les informations de la matière.</p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Fermer">×</button>
            </div>

            <form className="sjp-modal__form" onSubmit={handleSubmit}>
              <label>
                Nom *
                <input name="name" value={subjectForm.name} onChange={updateFormField} maxLength="100" required />
              </label>

              <label className="sjp-modal__wide-field">
                Description
                <textarea name="description" value={subjectForm.description} onChange={updateFormField} rows="3" />
              </label>

              {modalMode === 'edit' && (
                <label className="sjp-modal__checkbox">
                  <input type="checkbox" name="is_active" checked={subjectForm.is_active} onChange={updateFormField} />
                  Matière active
                </label>
              )}

              {formError && <p className="sjp-modal__error" role="alert">{formError}</p>}

              <div className="sjp-modal__actions">
                <button type="button" className="sjp-btn-reset" onClick={closeModal}>Annuler</button>
                <button type="submit" className="sjp-btn-primary" disabled={submitting}>
                  {submitting ? 'Enregistrement…' : modalMode === 'create' ? 'Créer la matière' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
