import { useEffect, useState } from 'react'
import {
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  BookOpen,
  GraduationCap,
  Layers,
  Lock,
  Mail,
  Phone,
  Search,
  School,
  UserRoundCheck,
  Users,
} from 'lucide-react'
import { formatProfileName } from '../utils/profileDisplay.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import {
  deleteSchoolClass,
  getClassLevels,
  getSchoolClassDetail,
  getSchoolClassSubjects,
  getAvailableSubjectsForClass,
  addClassSubject,
  updateClassSubjectCoefficient,
  removeClassSubject,
  getTeachers,
  updateSchoolClass,
} from '../services/school_classes_overview_service.js'
import { enrollStudent, listStudents } from '../services/students_service.js'
import { createTeacherAssignment } from '../services/teachers_overview_service.js'
import './../styles/school_class_details_page.css'

const STATUS_LABEL = { ACTIVE: 'Actif', ARCHIVEE: 'Archivée' }
const STATUS_CLASS = { ACTIVE: 'scd-badge--active', ARCHIVEE: 'scd-badge--archived' }
const STUDENT_STATUS_LABEL = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  ARCHIVED: 'Archivé',
}

function StatusBadge({ status }) {
  return (
    <span className={`scd-badge ${STATUS_CLASS[status] ?? ''}`}>
      <span className="scd-badge__dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(value))
}

function isHighSchoolLevel(level) {
  return level?.education_stage === 'HIGH_SCHOOL'
}

export default function SchoolClassDetailsPage({ account, schoolClass, onNavigate }) {
  const canEdit = account?.role === 'ADMIN'
  const [details, setDetails] = useState(schoolClass)
  const [activeTab, setActiveTab] = useState('info')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [classLevels, setClassLevels] = useState([])
  const [teachers, setTeachers] = useState([])
  const [teacherPickerOpen, setTeacherPickerOpen] = useState(false)
  const [teacherSearch, setTeacherSearch] = useState('')
  const [students, setStudents] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [studentStatus, setStudentStatus] = useState('')
  const [studentsLoading, setStudentsLoading] = useState(false)
  // Inscription d'un élève dans la classe
  const [enrollPickerOpen, setEnrollPickerOpen] = useState(false)
  const [enrollableStudents, setEnrollableStudents] = useState([])
  const [enrollPickerLoading, setEnrollPickerLoading] = useState(false)
  const [enrollSearch, setEnrollSearch] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState('')
  const [subjects, setSubjects] = useState([])
  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjectStatus, setSubjectStatus] = useState('')
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  // Ajout matière
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false)
  const [availableSubjects, setAvailableSubjects] = useState([])
  const [pickerSearch, setPickerSearch] = useState('')
  const [selectedAvailableSubject, setSelectedAvailableSubject] = useState(null)
  const [newCoefficient, setNewCoefficient] = useState('1')
  const [addingSubject, setAddingSubject] = useState(false)
  // Modification coefficient
  const [editingSubjectId, setEditingSubjectId] = useState(null)
  const [editCoefficientValue, setEditCoefficientValue] = useState('')
  const [savingCoefficient, setSavingCoefficient] = useState(false)
  // Retrait matière
  const [confirmRemoveSubjectId, setConfirmRemoveSubjectId] = useState(null)
  const [removingSubject, setRemovingSubject] = useState(false)
  // Affectation d'un enseignant à une matière non affectée
  const [assignPickerSubjectId, setAssignPickerSubjectId] = useState(null)
  const [assignTeacherSearch, setAssignTeacherSearch] = useState('')
  const [assigningTeacher, setAssigningTeacher] = useState(false)
  const [assignError, setAssignError] = useState('')
  const debouncedStudentSearch = useDebouncedValue(studentSearch)
  const debouncedStudentStatus = useDebouncedValue(studentStatus)
  const debouncedSubjectSearch = useDebouncedValue(subjectSearch)
  const debouncedSubjectStatus = useDebouncedValue(subjectStatus)

  useEffect(() => {
    load()
    loadFormOptions()
  }, [schoolClass?.id])

  useEffect(() => {
    if (activeTab === 'students') {
      loadClassStudents()
    }
  }, [activeTab, schoolClass?.id])

  useEffect(() => {
    if (activeTab === 'students') {
      loadClassStudents({
        q: debouncedStudentSearch,
        status: debouncedStudentStatus,
      })
    }
  }, [activeTab, debouncedStudentSearch, debouncedStudentStatus, schoolClass?.id])

  useEffect(() => {
    if (activeTab === 'subjects') {
      loadClassSubjects()
    }
  }, [activeTab, schoolClass?.id])

  useEffect(function reactiveSubjectFiltersEffect() {
    if (activeTab === 'subjects') {
      loadClassSubjects({
        q: debouncedSubjectSearch,
        isActive: debouncedSubjectStatus,
      })
    }
  }, [activeTab, debouncedSubjectSearch, debouncedSubjectStatus, schoolClass?.id])

  async function load() {
    if (!schoolClass?.id) return
    setError('')
    setMenuOpen(false)
    setConfirmingDelete(false)
    setEditing(false)
    setSubjectPickerOpen(false)
    setTeacherPickerOpen(false)
    setAssignPickerSubjectId(null)
    setConfirmRemoveSubjectId(null)
    setEditingSubjectId(null)

    try {
      const full = await getSchoolClassDetail(schoolClass.id)
      setDetails(full)
      resetForm(full)
    } catch (e) {
      setError(e.message)
      setDetails(schoolClass ?? null)
      resetForm(schoolClass)
    }
  }

  async function loadFormOptions() {
    try {
      const [availableLevels, availableTeachers] = await Promise.all([
        getClassLevels(),
        getTeachers(),
      ])
      setClassLevels(availableLevels)
      setTeachers(availableTeachers)
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  async function loadClassStudents(filters = {}) {
    if (!schoolClass?.id) return
    const query = filters.q ?? studentSearch
    const status = filters.status ?? studentStatus
    setStudentsLoading(true)
    setError('')
    try {
      const result = await listStudents({
        q: query || null,
        status: status || null,
        class_id: schoolClass.id,
        limit: 100,
        offset: 0,
      })
      setStudents(Array.isArray(result) ? result : result.items ?? [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setStudentsLoading(false)
    }
  }

  async function loadClassSubjects(filters = {}) {
    if (!schoolClass?.id) return
    const query = filters.q ?? subjectSearch
    const status = filters.status ?? subjectStatus
    setSubjectsLoading(true)
    setError('')
    try {
      const result = await getSchoolClassSubjects(schoolClass.id, {
        q: query,
        isActive: status,
      })
      setSubjects(result)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setSubjectsLoading(false)
    }
  }

  function resetStudentFilters() {
    setStudentSearch('')
    setStudentStatus('')
  }

  function resetSubjectFilters() {
    setSubjectSearch('')
    setSubjectStatus('')
  }

  async function openSubjectPicker() {
    setPickerSearch('')
    setSelectedAvailableSubject(null)
    setNewCoefficient('1')
    try {
      setAvailableSubjects(await getAvailableSubjectsForClass(schoolClass.id))
    } catch (e) {
      setError(e.message)
      return
    }
    setSubjectPickerOpen(true)
  }

  function closeSubjectPicker() {
    setSubjectPickerOpen(false)
  }

  async function handleAddSubject() {
    if (!selectedAvailableSubject) return
    const coef = parseFloat(newCoefficient)
    if (!coef || coef <= 0) { setError('Le coefficient doit être un nombre positif.'); return }
    setAddingSubject(true)
    setError('')
    try {
      await addClassSubject(schoolClass.id, selectedAvailableSubject.id, coef)
      closeSubjectPicker()
      loadClassSubjects()
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setAddingSubject(false)
    }
  }

  function startEditCoefficient(subject) {
    setEditingSubjectId(subject.id)
    setEditCoefficientValue(String(subject.coefficient))
  }

  function cancelEditCoefficient() {
    setEditingSubjectId(null)
    setEditCoefficientValue('')
  }

  async function handleSaveCoefficient(classSubjectId) {
    const coef = parseFloat(editCoefficientValue)
    if (!coef || coef <= 0) { setError('Le coefficient doit être un nombre positif.'); return }
    setSavingCoefficient(true)
    setError('')
    try {
      await updateClassSubjectCoefficient(schoolClass.id, classSubjectId, coef)
      setEditingSubjectId(null)
      loadClassSubjects()
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingCoefficient(false)
    }
  }

  async function handleRemoveSubject() {
    if (!confirmRemoveSubjectId) return
    setRemovingSubject(true)
    setError('')
    try {
      await removeClassSubject(schoolClass.id, confirmRemoveSubjectId)
      setConfirmRemoveSubjectId(null)
      loadClassSubjects()
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setRemovingSubject(false)
    }
  }

  function openAssignPicker(subjectId) {
    setAssignTeacherSearch('')
    setAssignError('')
    setAssignPickerSubjectId(subjectId)
  }

  function closeAssignPicker() {
    if (assigningTeacher) return
    setAssignPickerSubjectId(null)
  }

  function computeAssignmentStartDate() {
    const today = new Date().toISOString().slice(0, 10)
    if (details.school_year_start && today < details.school_year_start) return details.school_year_start
    if (details.school_year_end && today > details.school_year_end) return details.school_year_end
    return today
  }

  async function handleAssignTeacher(teacher) {
    setAssigningTeacher(true)
    setAssignError('')
    try {
      await createTeacherAssignment(teacher.id, {
        class_subject_id: assignPickerSubjectId,
        start_date: computeAssignmentStartDate(),
      })
      setAssignPickerSubjectId(null)
      loadClassSubjects()
    } catch (e) {
      setAssignError(e.message)
    } finally {
      setAssigningTeacher(false)
    }
  }

  const filteredAssignTeachers = teachers.filter((teacher) => {
    const searchable = `${teacher.first_name} ${teacher.last_name} ${teacher.registration_number}`.toLowerCase()
    return searchable.includes(assignTeacherSearch.trim().toLowerCase())
  })

  async function openEnrollPicker() {
    setEnrollSearch('')
    setEnrollError('')
    setEnrollPickerOpen(true)
    setEnrollPickerLoading(true)
    try {
      const result = await listStudents({ status: 'ACTIVE', limit: 200 })
      const candidates = Array.isArray(result) ? result : result.items ?? []
      const enrolledIds = new Set(students.map((student) => student.id))
      setEnrollableStudents(candidates.filter((student) => !enrolledIds.has(student.id)))
    } catch (e) {
      setEnrollError(e.message)
    } finally {
      setEnrollPickerLoading(false)
    }
  }

  function closeEnrollPicker() {
    if (enrolling) return
    setEnrollPickerOpen(false)
  }

  async function handleEnrollStudent(student) {
    setEnrolling(true)
    setEnrollError('')
    try {
      await enrollStudent(student.id, {
        class_id: schoolClass.id,
        start_date: computeAssignmentStartDate(),
      })
      setEnrollPickerOpen(false)
      loadClassStudents()
      load()
    } catch (e) {
      setEnrollError(e.message)
    } finally {
      setEnrolling(false)
    }
  }

  const filteredEnrollableStudents = enrollableStudents.filter((student) => {
    const searchable = `${student.first_name} ${student.last_name} ${student.registration_number}`.toLowerCase()
    return searchable.includes(enrollSearch.trim().toLowerCase())
  })

  function openTeacherDetails() {
    onNavigate?.('teacher-details', {
      id: details.main_teacher_id,
      first_name: details.teacher_first_name,
      last_name: details.teacher_last_name,
    })
  }

  function openStudentDetails(student) {
    onNavigate?.('student-details', student)
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function resetForm(currentDetails) {
    if (!currentDetails) {
      setForm({})
      return
    }

    setForm({
      class_level_id: currentDetails.class_level_id ?? '',
      group_label: currentDetails.group_label ?? '',
      capacity: currentDetails.capacity ?? '',
      main_teacher_id: currentDetails.main_teacher_id ?? '',
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        class_level_id: form.class_level_id,
        group_label: form.group_label,
        capacity: form.capacity === '' ? null : Number(form.capacity),
        main_teacher_id: form.main_teacher_id,
      }
      await updateSchoolClass(details.id, payload)
      setEditing(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleEdit() {
    resetForm(details)
    setEditing(true)
  }

  function handleCancelEdit() {
    resetForm(details)
    setEditing(false)
  }

  function openTeacherPicker() {
    setTeacherSearch('')
    setTeacherPickerOpen(true)
  }

  function closeTeacherPicker() {
    setTeacherPickerOpen(false)
  }

  function selectTeacher(teacherId) {
    update('main_teacher_id', teacherId)
    closeTeacherPicker()
  }

  async function handleDelete() {
    setError('')
    try {
      await deleteSchoolClass(details.id)
      onNavigate?.('school-classes')
    } catch (err) {
      setError(err.message)
      setConfirmingDelete(false)
    }
  }

  if (!details) return <div className="scd-main">Classe non trouvée.</div>

  const className = `${details.level_name} ${details.group_label}`
  const levelIsLocked = details.has_enrollments ?? (details.student_count > 0)
  const selectedTeacher = teachers.find((teacher) => teacher.id === form.main_teacher_id)
  const normalizedTeacherSearch = teacherSearch.trim().toLowerCase()
  const filteredTeachers = teachers.filter((teacher) => {
    const searchableValue =
      `${teacher.first_name} ${teacher.last_name} ${teacher.registration_number}`.toLowerCase()
    return searchableValue.includes(normalizedTeacherSearch)
  })
  return (
    <main className="scd-main">
      <header className="scd-page-heading">
        <h1>Détails de la classe</h1>
        <nav className="scd-breadcrumb" aria-label="Fil d’Ariane">
          <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
          <span aria-hidden="true">›</span>
          <button type="button" onClick={() => onNavigate?.('school-classes')}>Classes</button>
          <span aria-hidden="true">›</span>
          <span>{className}</span>
        </nav>
      </header>

      <div className="scd-header">
        <div>
          <h1>{className}</h1>
          <div className="scd-header__badges">
            <StatusBadge status={details.status} />
          </div>
          <div className="scd-summary-line">
            <span>Année scolaire : {details.school_year_name}</span>
            <span>Niveau : {details.level_name}</span>
            <span>Groupe : {details.group_label}</span>
          </div>
        </div>

        {canEdit && (
          <div className="scd-header__actions">
            <div className="scd-menu-wrapper">
              <button type="button" className="scd-btn-primary" onClick={() => setMenuOpen((v) => !v)}>
                Actions ▾
              </button>
              {menuOpen && (
                <div className="scd-menu">
                  <button className="scd-menu__danger" onClick={() => { setMenuOpen(false); setConfirmingDelete(true) }}>
                    🗑 Supprimer la classe
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="scd-error">{error}</p>}

      {canEdit && confirmingDelete && (
        <div className="scd-confirm-overlay" onClick={() => setConfirmingDelete(false)}>
          <div className="scd-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Supprimer définitivement cette classe ?</h3>
            <p>
              Cette action est irréversible. La suppression sera refusée si des élèves ou des matières
              sont encore rattachés à « {className} ».
            </p>
            <div className="scd-confirm-actions">
              <button type="button" className="scd-btn-outline" onClick={() => setConfirmingDelete(false)}>Annuler</button>
              <button type="button" className="scd-btn-danger" onClick={handleDelete}>Oui, supprimer</button>
            </div>
          </div>
        </div>
      )}

      <div className="scd-body">
        <section className="scd-content">
          <nav className="scd-tabs">
            <button className={activeTab === 'info' ? 'scd-tab scd-tab--active' : 'scd-tab'} onClick={() => setActiveTab('info')}>Informations générales</button>
            <button className={activeTab === 'students' ? 'scd-tab scd-tab--active' : 'scd-tab'} onClick={() => setActiveTab('students')}>Élèves</button>
            <button className={activeTab === 'subjects' ? 'scd-tab scd-tab--active' : 'scd-tab'} onClick={() => setActiveTab('subjects')}>Matières</button>
          </nav>

          {activeTab === 'info' && (
            <>
              <section className="scd-top-cards">
                <article className="scd-card scd-teacher-summary">
                  <h4>Professeur principal</h4>
                  <div className="scd-teacher-mini">
                    <span className="scd-avatar">
                      {initials(details.teacher_first_name, details.teacher_last_name)}
                    </span>
                    <div className="scd-teacher-summary__identity">
                      <div className="scd-teacher-summary__heading">
                        <strong>{formatProfileName(details.teacher_first_name, details.teacher_last_name, details.teacher_gender)}</strong>
                        <span className={`scd-teacher-status ${
                          details.teacher_status === 'ACTIVE'
                            ? 'scd-teacher-status--active'
                            : 'scd-teacher-status--archived'
                        }`}>
                          {details.teacher_status === 'ACTIVE' ? 'Actif' : 'Archivé'}
                        </span>
                      </div>
                      <div className="scd-teacher-meta">
                        <Mail aria-hidden="true" size={15} />
                        {details.teacher_email ?? 'Email non renseigné'}
                      </div>
                  <div className="scd-teacher-meta">
                    <Phone aria-hidden="true" size={15} />
                    {details.teacher_phone ?? 'Téléphone non renseigné'}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      className="scd-teacher-link"
                      onClick={openTeacherDetails}
                    >
                      Voir le profil de l’enseignant →
                    </button>
                  )}
                </div>
                  </div>
                </article>

                <article className="scd-card">
                  <h4>Résumé de la classe</h4>
                  <div className="scd-stats-grid">
                    <div className="scd-stat scd-stat--students">
                      <span className="scd-stat__icon"><Users aria-hidden="true" size={21} /></span>
                      <div><strong>{details.student_count}</strong><span>Élèves inscrits</span></div>
                    </div>
                    <div className="scd-stat scd-stat--subjects">
                      <span className="scd-stat__icon"><BookOpen aria-hidden="true" size={21} /></span>
                      <div><strong>{details.subject_count}</strong><span>Matières</span></div>
                    </div>
                    <div className="scd-stat scd-stat--teacher">
                      <span className="scd-stat__icon"><UserRoundCheck aria-hidden="true" size={21} /></span>
                      <div><strong>1</strong><span>Professeur principal</span></div>
                    </div>
                    <div className="scd-stat scd-stat--year">
                      <span className="scd-stat__icon"><CalendarDays aria-hidden="true" size={21} /></span>
                      <div><strong>{details.school_year_name}</strong><span>Année scolaire</span></div>
                    </div>
                  </div>
                </article>
              </section>

              {canEdit && editing ? (
              <form onSubmit={handleSave} className="scd-form">
                <div className="scd-section-heading">
                  <h3>Informations générales</h3>
                  <div className="scd-form-actions">
                    <button type="button" className="scd-btn-outline" onClick={handleCancelEdit}>Annuler</button>
                    <button type="submit" className="scd-btn-primary" disabled={saving}>
                      {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>

                <div className="scd-form-grid">
                  <label>
                    <span>Niveau</span>
                    <div className="scd-locked-field">
                      <select
                        value={form.class_level_id}
                        onChange={(event) => update('class_level_id', event.target.value)}
                        disabled={levelIsLocked}
                      >
                        {classLevels.map((level) => (
                          <option
                            key={level.id}
                            value={level.id}
                            disabled={!isHighSchoolLevel(level)}
                          >
                            {level.name}
                            {!isHighSchoolLevel(level) ? ' (indisponible)' : ''}
                          </option>
                        ))}
                      </select>
                      {levelIsLocked && <Lock aria-label="Niveau verrouillé" size={17} />}
                    </div>
                    {levelIsLocked && (
                      <small>Verrouillé car cette classe possède déjà une inscription.</small>
                    )}
                  </label>

                  <label>
                    <span>Groupe</span>
                    <input
                      required
                      value={form.group_label}
                      onChange={(event) => update('group_label', event.target.value)}
                    />
                  </label>

                  <label>
                    <span>Capacité</span>
                    <input
                      type="number"
                      min="1"
                      max="32767"
                      value={form.capacity}
                      onChange={(event) => update('capacity', event.target.value)}
                    />
                  </label>

                  <label>
                    <span>Professeur principal</span>
                    <button
                      type="button"
                      className="scd-teacher-picker-button"
                      onClick={openTeacherPicker}
                    >
                      <span>
                        <strong>
                          {selectedTeacher
                            ? formatProfileName(selectedTeacher.first_name, selectedTeacher.last_name, selectedTeacher.gender)
                            : 'Choisir un enseignant'}
                        </strong>
                        {selectedTeacher && <small>{selectedTeacher.registration_number}</small>}
                      </span>
                      <Search aria-hidden="true" size={18} />
                    </button>
                  </label>
                </div>
              </form>
            ) : (
              <div className="scd-info-grid">
                <div className="scd-view">
                  <div className="scd-section-heading">
                    <h3>Informations générales</h3>
                    {canEdit && (
                      <button type="button" className="scd-btn-outline" onClick={handleEdit}>
                        ✎ Modifier
                      </button>
                    )}
                  </div>
                  <dl>
                    <div>
                      <dt><School aria-hidden="true" size={17} />Nom de la classe</dt>
                      <dd>{className}</dd>
                    </div>
                    <div>
                      <dt><GraduationCap aria-hidden="true" size={17} />Niveau</dt>
                      <dd>{details.level_name}</dd>
                    </div>
                    <div>
                      <dt><Layers aria-hidden="true" size={17} />Groupe</dt>
                      <dd>{details.group_label}</dd>
                    </div>
                    <div>
                      <dt><CalendarDays aria-hidden="true" size={17} />Année scolaire</dt>
                      <dd>{details.school_year_name}</dd>
                    </div>
                    <div>
                      <dt><Users aria-hidden="true" size={17} />Effectif actuel</dt>
                      <dd>{details.student_count} élèves</dd>
                    </div>
                    <div>
                      <dt><CircleCheck aria-hidden="true" size={17} />Statut</dt>
                      <dd><StatusBadge status={details.status} /></dd>
                    </div>
                    <div>
                      <dt><CalendarPlus aria-hidden="true" size={17} />Date de création</dt>
                      <dd>{formatDate(details.created_at)}</dd>
                    </div>
                    <div>
                      <dt><CalendarDays aria-hidden="true" size={17} />Dernière modification</dt>
                      <dd>{formatDate(details.updated_at)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              )}
            </>
          )}

          {activeTab === 'students' && (
            <section className="scd-students-panel">
              <div className="scd-section-heading">
                <div>
                  <h3>Élèves de la classe</h3>
                  <p>{students.length} élève(s) affiché(s)</p>
                </div>
                {canEdit && (
                  <button type="button" className="scd-btn-primary" onClick={openEnrollPicker}>
                    <UserRoundCheck aria-hidden="true" size={18} />
                    Inscrire un élève
                  </button>
                )}
              </div>

              <form className="scd-student-filters" onSubmit={(event) => event.preventDefault()}>
                <label className="scd-student-search">
                  <Search aria-hidden="true" size={18} />
                  <input
                    type="search"
                    placeholder="Nom, prénom ou matricule…"
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                  />
                </label>
                <select
                  value={studentStatus}
                  onChange={(event) => setStudentStatus(event.target.value)}
                  aria-label="Filtrer les élèves par statut"
                >
                  <option value="">Tous les statuts</option>
                  <option value="ACTIVE">Actifs</option>
                  <option value="INACTIVE">Inactifs</option>
                  <option value="ARCHIVED">Archivés</option>
                </select>
                <button type="button" className="scd-btn-outline" onClick={resetStudentFilters}>
                  Réinitialiser
                </button>
              </form>

              <div className="scd-students-table-wrapper">
                <table className="scd-students-table">
                  <thead>
                    <tr>
                      <th>Matricule</th>
                      <th>Nom et prénom</th>
                      <th>Sexe</th>
                      <th>Date d’inscription</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr
                        key={student.id}
                        tabIndex="0"
                        onClick={() => openStudentDetails(student)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') openStudentDetails(student)
                        }}
                      >
                        <td className="scd-student-registration">{student.registration_number}</td>
                        <td>
                          <span className="scd-student-identity">
                            <span className="scd-student-avatar">
                              {initials(student.first_name, student.last_name)}
                            </span>
                            <strong>{formatProfileName(student.first_name, student.last_name, student.gender, { order: 'last-first' })}</strong>
                          </span>
                        </td>
                        <td>{student.gender === 'MALE' ? 'Masculin' : student.gender === 'FEMALE' ? 'Féminin' : '—'}</td>
                        <td>{formatDate(student.admission_date)}</td>
                        <td>
                          <span className={`scd-student-status scd-student-status--${student.status.toLowerCase()}`}>
                            {STUDENT_STATUS_LABEL[student.status] ?? student.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!studentsLoading && students.length === 0 && (
                  <p className="scd-students-empty">Aucun élève ne correspond aux filtres.</p>
                )}
                {studentsLoading && <p className="scd-students-empty">Chargement des élèves…</p>}
              </div>
            </section>
          )}
          {activeTab === 'subjects' && (
            <section className="scd-subjects-panel">
              <div className="scd-section-heading">
                <div>
                  <h3>Matières de la classe</h3>
                  <p>{subjects.length} matière(s) affichée(s)</p>
                </div>
                {canEdit && (
                  <button type="button" className="scd-btn-primary" onClick={openSubjectPicker}>
                    + Ajouter une matière
                  </button>
                )}
              </div>

              <form className="scd-subject-filters" onSubmit={(event) => event.preventDefault()}>
                <label className="scd-subject-search">
                  <Search aria-hidden="true" size={18} />
                  <input
                    type="search"
                    placeholder="Rechercher une matière…"
                    value={subjectSearch}
                    onChange={(event) => setSubjectSearch(event.target.value)}
                  />
                </label>
                <select
                  value={subjectStatus}
                  onChange={(event) => setSubjectStatus(event.target.value)}
                  aria-label="Filtrer les matières par statut"
                >
                  <option value="">Tous les statuts</option>
                  <option value="true">Actives</option>
                  <option value="false">Inactives</option>
                </select>
                <button type="button" className="scd-btn-outline" onClick={resetSubjectFilters}>
                  Réinitialiser
                </button>
              </form>

              <div className="scd-subjects-table-wrapper">
                <table className="scd-subjects-table">
                  <thead>
                    <tr>
                      <th>Matière</th>
                      <th>Coefficient</th>
                      <th className="scd-col-teacher">Enseignant affecté</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((subject) => (
                      <tr key={subject.id}>
                        <td>
                          <span className="scd-subject-name">
                            <span className="scd-subject-icon">
                              <BookOpen aria-hidden="true" size={18} />
                            </span>
                            <strong>{subject.name}</strong>
                          </span>
                        </td>
                        <td>
                          {canEdit && editingSubjectId === subject.id ? (
                            <span className="scd-coef-edit">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="scd-coef-input"
                                value={editCoefficientValue}
                                onChange={(e) => setEditCoefficientValue(e.target.value)}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="scd-btn-primary scd-btn-sm"
                                disabled={savingCoefficient}
                                onClick={() => handleSaveCoefficient(subject.id)}
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                className="scd-btn-outline scd-btn-sm"
                                onClick={cancelEditCoefficient}
                              >
                                ✕
                              </button>
                            </span>
                          ) : (
                            <span className="scd-coef-display">
                              {Number(subject.coefficient).toLocaleString('fr-FR')}
                              {canEdit && (
                                <button
                                  type="button"
                                  className="scd-btn-icon"
                                  title="Modifier le coefficient"
                                  onClick={() => startEditCoefficient(subject)}
                                >
                                  ✎
                                </button>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="scd-col-teacher">
                          {subject.teacher_name ?? (
                            <span className="scd-no-teacher">
                              Non affecté
                              {canEdit && (
                                <button
                                  type="button"
                                  className="scd-btn-icon"
                                  title="Affecter un enseignant"
                                  onClick={() => openAssignPicker(subject.id)}
                                >
                                  + Affecter
                                </button>
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={subject.is_active
                            ? 'scd-subject-status scd-subject-status--active'
                            : 'scd-subject-status scd-subject-status--inactive'}
                          >
                            {subject.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          {canEdit ? (
                            <button
                              type="button"
                              className="scd-btn-danger scd-btn-sm"
                              title="Retirer la matière"
                              onClick={() => setConfirmRemoveSubjectId(subject.id)}
                            >
                              Retirer
                            </button>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!subjectsLoading && subjects.length === 0 && (
                  <p className="scd-subjects-empty">Aucune matière ne correspond aux filtres.</p>
                )}
                {subjectsLoading && <p className="scd-subjects-empty">Chargement des matières…</p>}
              </div>
            </section>
          )}
        </section>

      </div>

      {canEdit && teacherPickerOpen && (
        <div className="scd-confirm-overlay" onClick={closeTeacherPicker}>
          <section
            className="scd-teacher-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="scd-teacher-picker__header">
              <div>
                <h3 id="teacher-picker-title">Choisir le professeur principal</h3>
                <p>Recherchez un enseignant par nom, prénom ou matricule.</p>
              </div>
              <button type="button" className="scd-btn-outline" onClick={closeTeacherPicker}>
                Fermer
              </button>
            </div>

            <label className="scd-teacher-search">
              <Search aria-hidden="true" size={18} />
              <input
                autoFocus
                type="search"
                placeholder="Nom ou matricule…"
                value={teacherSearch}
                onChange={(event) => setTeacherSearch(event.target.value)}
              />
            </label>

            <div className="scd-teacher-results">
              {filteredTeachers.map((teacher) => (
                <button
                  key={teacher.id}
                  type="button"
                  className={
                    teacher.id === form.main_teacher_id
                      ? 'scd-teacher-result scd-teacher-result--selected'
                      : 'scd-teacher-result'
                  }
                  onClick={() => selectTeacher(teacher.id)}
                >
                  <span className="scd-avatar">
                    {initials(teacher.first_name, teacher.last_name)}
                  </span>
                  <span>
                    <strong>{formatProfileName(teacher.first_name, teacher.last_name, teacher.gender)}</strong>
                    <small>Matricule : {teacher.registration_number}</small>
                  </span>
                </button>
              ))}
      {filteredTeachers.length === 0 && (
                <p className="scd-teacher-results__empty">Aucun enseignant trouvé.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {canEdit && subjectPickerOpen && (
        <div className="scd-confirm-overlay" onClick={closeSubjectPicker}>
          <section
            className="scd-teacher-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="subject-picker-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="scd-teacher-picker__header">
              <div>
                <h3 id="subject-picker-title">Ajouter une matière</h3>
                <p>Choisissez une matière et saisissez son coefficient.</p>
              </div>
              <button type="button" className="scd-btn-outline" onClick={closeSubjectPicker}>Fermer</button>
            </div>

            <label className="scd-teacher-search">
              <Search aria-hidden="true" size={18} />
              <input
                autoFocus
                type="search"
                placeholder="Rechercher une matière…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />
            </label>

            <div className="scd-teacher-results">
              {availableSubjects
                .filter((s) => s.name.toLowerCase().includes(pickerSearch.trim().toLowerCase()))
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={
                      selectedAvailableSubject?.id === s.id
                        ? 'scd-teacher-result scd-teacher-result--selected'
                        : 'scd-teacher-result'
                    }
                    onClick={() => setSelectedAvailableSubject(s)}
                  >
                    <span className="scd-subject-icon"><BookOpen size={18} aria-hidden="true" /></span>
                    <span><strong>{s.name}</strong></span>
                  </button>
                ))}
              {availableSubjects.length === 0 && (
                <p className="scd-teacher-results__empty">Toutes les matières actives sont déjà associées à cette classe.</p>
              )}
            </div>

            {selectedAvailableSubject && (
              <div className="scd-subject-coef-row">
                <label>
                  <span>Coefficient pour <strong>{selectedAvailableSubject.name}</strong></span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="scd-coef-input"
                    value={newCoefficient}
                    onChange={(e) => setNewCoefficient(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="scd-btn-primary"
                  disabled={addingSubject}
                  onClick={handleAddSubject}
                >
                  {addingSubject ? 'Ajout…' : 'Ajouter la matière'}
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {canEdit && confirmRemoveSubjectId && (
        <div className="scd-confirm-overlay" onClick={() => setConfirmRemoveSubjectId(null)}>
          <div className="scd-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Retirer cette matière ?</h3>
            <p>La matière sera dissociée de la classe. Les évaluations déjà saisies resteront intactes.</p>
            <div className="scd-confirm-actions">
              <button type="button" className="scd-btn-outline" onClick={() => setConfirmRemoveSubjectId(null)}>Annuler</button>
              <button type="button" className="scd-btn-danger" disabled={removingSubject} onClick={handleRemoveSubject}>
                {removingSubject ? 'Retrait…' : 'Oui, retirer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canEdit && assignPickerSubjectId && (
        <div className="scd-confirm-overlay" onClick={closeAssignPicker}>
          <section
            className="scd-teacher-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="scd-teacher-picker__header">
              <div>
                <h3 id="assign-picker-title">Affecter un enseignant</h3>
                <p>Recherchez un enseignant par nom, prénom ou matricule.</p>
              </div>
              <button type="button" className="scd-btn-outline" onClick={closeAssignPicker}>Fermer</button>
            </div>

            <label className="scd-teacher-search">
              <Search aria-hidden="true" size={18} />
              <input
                autoFocus
                type="search"
                placeholder="Nom ou matricule…"
                value={assignTeacherSearch}
                onChange={(event) => setAssignTeacherSearch(event.target.value)}
              />
            </label>

            {assignError && <p className="scd-error">{assignError}</p>}

            <div className="scd-teacher-results">
              {filteredAssignTeachers.map((teacher) => (
                <button
                  key={teacher.id}
                  type="button"
                  className="scd-teacher-result"
                  disabled={assigningTeacher}
                  onClick={() => handleAssignTeacher(teacher)}
                >
                  <span className="scd-avatar">
                    {initials(teacher.first_name, teacher.last_name)}
                  </span>
                  <span>
                    <strong>{formatProfileName(teacher.first_name, teacher.last_name, teacher.gender)}</strong>
                    <small>Matricule : {teacher.registration_number}</small>
                  </span>
                </button>
              ))}
              {filteredAssignTeachers.length === 0 && (
                <p className="scd-teacher-results__empty">Aucun enseignant trouvé.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {enrollPickerOpen && (
        <div className="scd-confirm-overlay" onClick={closeEnrollPicker}>
          <section
            className="scd-teacher-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="enroll-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="scd-teacher-picker__header">
              <div>
                <h3 id="enroll-picker-title">Inscrire un élève</h3>
                <p>Recherchez un élève actif par nom, prénom ou matricule.</p>
              </div>
              <button type="button" className="scd-btn-outline" onClick={closeEnrollPicker}>Fermer</button>
            </div>

            <label className="scd-teacher-search">
              <Search aria-hidden="true" size={18} />
              <input
                autoFocus
                type="search"
                placeholder="Nom ou matricule…"
                value={enrollSearch}
                onChange={(event) => setEnrollSearch(event.target.value)}
              />
            </label>

            {enrollError && <p className="scd-error">{enrollError}</p>}

            <div className="scd-teacher-results">
              {enrollPickerLoading ? (
                <p className="scd-teacher-results__empty">Chargement des élèves…</p>
              ) : (
                <>
                  {filteredEnrollableStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className="scd-teacher-result"
                      disabled={enrolling}
                      onClick={() => handleEnrollStudent(student)}
                    >
                      <span className="scd-avatar">
                        {initials(student.first_name, student.last_name)}
                      </span>
                      <span>
                        <strong>{formatProfileName(student.first_name, student.last_name, student.gender)}</strong>
                        <small>Matricule : {student.registration_number}</small>
                      </span>
                    </button>
                  ))}
                  {filteredEnrollableStudents.length === 0 && (
                    <p className="scd-teacher-results__empty">Aucun élève disponible à inscrire.</p>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}

    </main>
  )
}
