import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { getSchoolYears } from '../services/school_year_service.js'
import { formatProfileName } from '../utils/profileDisplay.js'
import {
  createSchoolClass,
  getClassLevels,
  getTeachers,
  getSchoolClassesOverview,
} from '../services/school_classes_overview_service.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import '../styles/school_classes_page.css'
const AVATAR_PALETTE = [
  { bg: '#E8ECFB', fg: '#3355DD' },
  { bg: '#FDEBEA', fg: '#D9534F' },
  { bg: '#FFF3DC', fg: '#B8860B' },
  { bg: '#E9F7EF', fg: '#2E9E6B' },
  { bg: '#F3E9FB', fg: '#8E44AD' },
  { bg: '#FCE9F3', fg: '#C2185B' },
]

function levelBadge(name) {
  const idx = (name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[idx]
}

function levelInitials(name, groupLabel) {
  const levelName = String(name ?? '').trim()
  const group = String(groupLabel ?? '').trim()
  const digitMatch = levelName.match(/\d/)

  if (digitMatch) {
    return digitMatch[0]
  }

  if (group) {
    return group[0].toUpperCase()
  }

  const letterMatch = levelName.match(/[A-Za-z]/)
  return letterMatch ? letterMatch[0].toUpperCase() : '?'
}

function teacherInitials(teacher) {
  return `${teacher.first_name?.[0] ?? ''}${teacher.last_name?.[0] ?? ''}`.toUpperCase()
}

const STATUS_LABEL = { ACTIVE: 'Actif', ARCHIVEE: 'Archivée' }
const STATUS_CLASS = { ACTIVE: 'scp-badge--active', ARCHIVEE: 'scp-badge--archived' }

function StatusBadge({ status }) {
  return (
    <span className={`scp-badge ${STATUS_CLASS[status] ?? ''}`}>
      <span className="scp-badge__dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

const PAGE_SIZE = 10
const EMPTY_CLASS_FORM = {
  school_year_id: '',
  class_level_id: '',
  main_teacher_id: '',
  group_label: '',
  capacity: '',
}

function isHighSchoolLevel(level) {
  return level?.education_stage === 'HIGH_SCHOOL'
}

export default function SchoolClassesPage({ account, onNavigate }) {
  const canEdit = account?.role === 'ADMIN'
  const [query, setQuery] = useState('')
  const [schoolYearId, setSchoolYearId] = useState('')
  const [classLevelId, setClassLevelId] = useState('')
  const [status, setStatus] = useState('')
  const [classes, setClasses] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [schoolYears, setSchoolYears] = useState([])
  const [classLevels, setClassLevels] = useState([])
  const [teachers, setTeachers] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [classForm, setClassForm] = useState(EMPTY_CLASS_FORM)
  const [createError, setCreateError] = useState('')
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [showTeacherPicker, setShowTeacherPicker] = useState(false)
  const [teacherQuery, setTeacherQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query)
  const debouncedSchoolYearId = useDebouncedValue(schoolYearId)
  const debouncedClassLevelId = useDebouncedValue(classLevelId)
  const debouncedStatus = useDebouncedValue(status)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchClasses(0, {
      q: debouncedQuery,
      schoolYearId: debouncedSchoolYearId,
      classLevelId: debouncedClassLevelId,
      status: debouncedStatus,
    })
    setPage(0)
  }, [debouncedQuery, debouncedSchoolYearId, debouncedClassLevelId, debouncedStatus])

  async function fetchClasses(pageIndex = page, overrides = {}) {
    setLoading(true)
    try {
      const data = await getSchoolClassesOverview({
        q: 'q' in overrides ? overrides.q || null : query || null,
        schoolYearId: 'schoolYearId' in overrides ? overrides.schoolYearId || null : schoolYearId || null,
        classLevelId: 'classLevelId' in overrides ? overrides.classLevelId || null : classLevelId || null,
        status: 'status' in overrides ? overrides.status || null : status || null,
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
      })
      setClasses(data)
      setTotal(data.length < PAGE_SIZE && pageIndex === 0 ? data.length : Math.max(data.length, (pageIndex + 1) * PAGE_SIZE))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function fetchInitialData() {
    setLoading(true)
    try {
      const classList = await getSchoolClassesOverview({
        limit: PAGE_SIZE,
        offset: 0,
      })
      setClasses(classList)
      setTotal(classList.length)
      setPage(0)

      const [years, levels, teacherList] = await Promise.all([
        getSchoolYears(),
        getClassLevels(),
        canEdit ? getTeachers() : Promise.resolve([]),
      ])
      setSchoolYears(years)
      setClassLevels(levels)
      setTeachers(teacherList)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setQuery('')
    setSchoolYearId('')
    setClassLevelId('')
    setStatus('')
  }

  function goToPage(next) {
    setPage(next)
    fetchClasses(next)
  }

  function openCreateModal() {
    setClassForm(EMPTY_CLASS_FORM)
    setCreateError('')
    setTeacherQuery('')
    setShowCreateModal(true)
  }

  function closeCreateModal() {
    if (!creating) setShowCreateModal(false)
  }

  function updateClassForm(event) {
    const { name, value } = event.target
    setClassForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  function openTeacherPicker() {
    setTeacherQuery('')
    setShowTeacherPicker(true)
  }

  function closeTeacherPicker() {
    setShowTeacherPicker(false)
  }

  function selectTeacher(teacherId) {
    setClassForm((currentForm) => ({ ...currentForm, main_teacher_id: teacherId }))
    setShowTeacherPicker(false)
  }

  async function handleCreateClass(event) {
    event.preventDefault()
    if (!classForm.main_teacher_id) {
      setCreateError('Veuillez sélectionner un professeur principal.')
      return
    }
    const selectedLevel = classLevels.find((level) => level.id === classForm.class_level_id)
    if (!selectedLevel || !isHighSchoolLevel(selectedLevel)) {
      setCreateError('Seuls les niveaux lycée sont activés pour le moment.')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      await createSchoolClass({
        ...classForm,
        capacity: classForm.capacity ? Number(classForm.capacity) : null,
      })
      setShowCreateModal(false)
      setConfirmationMessage('La classe a été créée avec succès.')
      setPage(0)
      await fetchClasses(0)
    } catch (error) {
      setCreateError(error.message)
    } finally {
      setCreating(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const selectedTeacher = teachers.find((teacher) => teacher.id === classForm.main_teacher_id)
  const normalizedTeacherQuery = teacherQuery.trim().toLowerCase()
  const filteredTeachers = teachers.filter((teacher) => {
    const searchableText = `${teacher.first_name} ${teacher.last_name} ${teacher.registration_number}`.toLowerCase()
    return searchableText.includes(normalizedTeacherQuery)
  })

  return (
    <main className="scp-main">
      <div className="scp-topbar">
        <div>
          <h1 className="scp-title">Gestion des classes</h1>
          <nav className="scp-breadcrumb">
            <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
            <span>›</span>
            <span>Classes</span>
          </nav>
        </div>
        {canEdit && (
          <button type="button" className="scp-btn-primary" onClick={openCreateModal}>
            <span className="scp-btn-primary__plus">+</span> Ajouter une classe
          </button>
        )}
      </div>

      {confirmationMessage && (
        <div className="scp-confirmation" role="status">
          <span>{confirmationMessage}</span>
          <button type="button" onClick={() => setConfirmationMessage('')} aria-label="Fermer">×</button>
        </div>
      )}

      <form className="scp-filters" onSubmit={(event) => event.preventDefault()}>
        <div className="scp-search">
          <span className="scp-search__icon">⌕</span>
          <input
            type="search"
            placeholder="Rechercher une classe..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <select value={schoolYearId} onChange={(e) => setSchoolYearId(e.target.value)}>
          <option value="">Toutes les années</option>
          {schoolYears.map((y) => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </select>

        <select value={classLevelId} onChange={(e) => setClassLevelId(e.target.value)}>
          <option value="">Tous les niveaux</option>
          {classLevels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="ARCHIVEE">Archivée</option>
        </select>

        <button type="button" className="scp-btn-reset" onClick={handleReset}>
          ⟲ Réinitialiser
        </button>
      </form>

      <section className="scp-list">
        <div className="scp-list__meta">
          <span>
            {loading ? 'Chargement…' : `Affichage de ${classes.length === 0 ? 0 : page * PAGE_SIZE + 1} à ${page * PAGE_SIZE + classes.length} classes`}
          </span>
        </div>

        <table className="scp-table">
          <thead>
            <tr>
              <th>Classe</th>
              <th>Niveau</th>
              <th>Groupe</th>
              <th>Année scolaire</th>
              <th>Professeur principal</th>
              <th>Élèves</th>
              <th>Capacité</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => {
              const badge = levelBadge(c.level_name)
              return (
                <tr key={c.id} className="scp-row" onClick={() => onNavigate?.('school-class-details', c)}>
                  <td>
                    <div className="scp-name-cell">
                      <span className="scp-avatar" style={{ background: badge.bg, color: badge.fg }}>
                        {levelInitials(c.level_name, c.group_label)}
                      </span>
                      {c.level_name} {c.group_label}
                    </div>
                  </td>
                  <td>{c.level_name}</td>
                  <td>{c.group_label}</td>
                  <td>{c.school_year_name}</td>
                  <td>{c.teacher_name}</td>
                  <td>{c.student_count}</td>
                  <td>{c.capacity ?? '—'}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="scp-row__chevron">›</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="scp-pagination">
          <button disabled={page === 0} onClick={() => goToPage(page - 1)}>‹</button>
          {Array.from({ length: pageCount }).slice(0, 5).map((_, i) => (
            <button
              key={i}
              className={i === page ? 'scp-page scp-page--active' : 'scp-page'}
              onClick={() => goToPage(i)}
            >
              {i + 1}
            </button>
          ))}
          {pageCount > 5 && <span>…</span>}
          <button disabled={page >= pageCount - 1} onClick={() => goToPage(page + 1)}>›</button>
        </div>
      </section>

      {canEdit && showCreateModal && (
        <div className="scp-modal-backdrop" role="presentation" onMouseDown={closeCreateModal}>
          <section
            className="scp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scp-create-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="scp-modal__header">
              <div>
                <h2 id="scp-create-title">Ajouter une classe</h2>
                <p>Renseignez les informations de la nouvelle classe.</p>
              </div>
              <button type="button" onClick={closeCreateModal} aria-label="Fermer">×</button>
            </div>

            <form className="scp-modal__form" onSubmit={handleCreateClass}>
              <label>
                Année scolaire *
                <select name="school_year_id" value={classForm.school_year_id} onChange={updateClassForm} required>
                  <option value="">Sélectionner une année</option>
                  {schoolYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                </select>
              </label>

              <label>
                Niveau *
                <select name="class_level_id" value={classForm.class_level_id} onChange={updateClassForm} required>
                  <option value="">Sélectionner un niveau</option>
                  {classLevels.map((level) => (
                    <option
                      key={level.id}
                      value={level.id}
                      disabled={!isHighSchoolLevel(level)}
                    >
                      {level.name}
                      {!isHighSchoolLevel(level) ? ' (indisponible pour le moment)' : ''}
                    </option>
                  ))}
                </select>
                <small className="scp-modal__hint">Les niveaux hors lycée sont visibles mais temporairement inactifs.</small>
              </label>

              <label>
                Groupe *
                <input name="group_label" value={classForm.group_label} onChange={updateClassForm} maxLength="30" placeholder="Exemple : A" required />
              </label>

              <label>
                Capacité
                <input name="capacity" type="number" min="1" max="32767" value={classForm.capacity} onChange={updateClassForm} placeholder="Exemple : 30" />
              </label>

              <div className="scp-modal__wide-field scp-teacher-field">
                <span>Professeur principal *</span>
                <button type="button" className="scp-teacher-select" onClick={openTeacherPicker}>
                  {selectedTeacher ? (
                    <>
                      <span className="scp-teacher-avatar">{teacherInitials(selectedTeacher)}</span>
                      <span>
                        <strong>{formatProfileName(selectedTeacher.first_name, selectedTeacher.last_name, selectedTeacher.gender)}</strong>
                        <small>Matricule : {selectedTeacher.registration_number}</small>
                      </span>
                    </>
                  ) : (
                    <span>Sélectionner un enseignant</span>
                  )}
                  <Search className="scp-teacher-select__icon" size={18} aria-hidden="true" />
                </button>
              </div>

              {createError && <p className="scp-modal__error" role="alert">{createError}</p>}

              <div className="scp-modal__actions">
                <button type="button" className="scp-btn-reset" onClick={closeCreateModal}>Annuler</button>
                <button type="submit" className="scp-btn-primary" disabled={creating}>
                  {creating ? 'Création…' : 'Créer la classe'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showTeacherPicker && (
        <div className="scp-teacher-picker-backdrop" role="presentation" onMouseDown={closeTeacherPicker}>
          <section
            className="scp-teacher-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scp-teacher-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="scp-teacher-picker__header">
              <div>
                <h2 id="scp-teacher-picker-title">Choisir le professeur principal</h2>
                <p>Recherchez un enseignant par nom, prénom ou matricule.</p>
              </div>
              <button type="button" className="scp-btn-reset" onClick={closeTeacherPicker}>Fermer</button>
            </div>

            <div className="scp-teacher-picker__search">
              <span>⌕</span>
              <input
                type="search"
                value={teacherQuery}
                onChange={(event) => setTeacherQuery(event.target.value)}
                placeholder="Nom ou matricule..."
                autoFocus
              />
            </div>

            <div className="scp-teacher-picker__list">
              {filteredTeachers.map((teacher) => (
                <button
                  key={teacher.id}
                  type="button"
                  className={teacher.id === classForm.main_teacher_id ? 'scp-teacher-option scp-teacher-option--selected' : 'scp-teacher-option'}
                  onClick={() => selectTeacher(teacher.id)}
                >
                  <span className="scp-teacher-avatar">{teacherInitials(teacher)}</span>
                  <span>
                    <strong>{formatProfileName(teacher.first_name, teacher.last_name, teacher.gender)}</strong>
                    <small>Matricule : {teacher.registration_number}</small>
                  </span>
                </button>
              ))}
              {filteredTeachers.length === 0 && <p className="scp-teacher-picker__empty">Aucun enseignant trouvé.</p>}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
