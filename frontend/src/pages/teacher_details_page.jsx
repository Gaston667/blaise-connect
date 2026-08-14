import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeInfo,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Shield,
  Unlink,
  UserRound,
  X,
} from 'lucide-react'
import defaultPhoto from '../assets/image_phtoto_default.png'
import AlertBanner from '../components/feedback/AlertBanner.jsx'
import ConfirmationDialog from '../components/feedback/ConfirmationDialog.jsx'
import FieldError from '../components/feedback/FieldError.jsx'
import { useToast } from '../components/feedback/ToastProvider.jsx'
import {
  createTeacherAssignment,
  endTeacherAssignment,
  getAvailableTeacherAssignments,
  getTeacherDetail,
  updateTeacherProfile,
} from '../services/teachers_overview_service.js'
import { formatProfileName } from '../utils/profileDisplay.js'
import { uploadAccountPhoto } from '../services/account_service.js'
import '../styles/teacher_details_page.css'

const DEFAULT_PHOTO = defaultPhoto

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

function genderLabel(value) {
  if (value === 'MALE' || value === 'M') return 'Masculin'
  if (value === 'FEMALE' || value === 'F') return 'Féminin'
  return value || '—'
}

function isActive(details) {
  return details.status === 'ACTIVE'
}

function isMainTeacherOfClass(schoolClass) {
  return schoolClass.is_main_teacher === true
}

function hasMainTeacherClass(classes) {
  return classes.some(isMainTeacherOfClass)
}

function toDateInput(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function normalizeOptionalString(value) {
  const trimmed = String(value ?? '').trim()
  return trimmed ? trimmed : null
}

function toComparable(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return value
  return String(value).toLowerCase()
}

function currentDateInput() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function clampDateToSchoolYear(value, option) {
  if (!option) return value
  if (value < option.school_year_start_date) return option.school_year_start_date
  if (value > option.school_year_end_date) return option.school_year_end_date
  return value
}

function getAssignmentEndDate(assignment) {
  const today = currentDateInput()
  if (today < assignment.start_date) return assignment.start_date
  if (today > assignment.school_year_end_date) return assignment.school_year_end_date
  return today
}

export default function TeacherDetailsPage({ account, teacher }) {
  const canEdit = account?.role === 'ADMIN'
  const toast = useToast()
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState('personal')
  const [isEditingPersonal, setIsEditingPersonal] = useState(false)
  const [personalSaving, setPersonalSaving] = useState(false)
  const [personalForm, setPersonalForm] = useState({
    first_name: '',
    last_name: '',
    birth_date: '',
    gender: '',
    email: '',
    phone: '',
    address: '',
    hire_date: '',
    qualification: '',
  })
  const photoInputRef = useRef(null)
  const [personalFieldErrors, setPersonalFieldErrors] = useState({})

  const [subjectAssignOpen, setSubjectAssignOpen] = useState(false)
  const [subjectAssignClassId, setSubjectAssignClassId] = useState('')
  const [subjectAssignClassSubjectId, setSubjectAssignClassSubjectId] = useState('')
  const [subjectAssignStartDate, setSubjectAssignStartDate] = useState(currentDateInput())
  const [subjectAssignOptions, setSubjectAssignOptions] = useState([])
  const [subjectAssignLoading, setSubjectAssignLoading] = useState(false)
  const [subjectAssignSaving, setSubjectAssignSaving] = useState(false)
  const [subjectAssignError, setSubjectAssignError] = useState('')
  const [subjectToRemove, setSubjectToRemove] = useState(null)
  const [subjectRemoving, setSubjectRemoving] = useState(false)

  const [evaluationClassFilter, setEvaluationClassFilter] = useState('all')
  const [evaluationSubjectFilter, setEvaluationSubjectFilter] = useState('all')
  const [evaluationSort, setEvaluationSort] = useState({ key: 'subject_name', direction: 'asc' })

  useEffect(function loadTeacherDetailsEffect() {
    if (!teacher?.id) {
      setLoading(false)
      return
    }

    loadTeacher()
  }, [teacher?.id])

  async function loadTeacher() {
    if (!teacher?.id) return
    setErrorMessage('')
    try {
      setDetails(await getTeacherDetail(teacher.id))
    } catch (error) {
      setErrorMessage(error.message)
      setDetails(null)
    } finally {
      setLoading(false)
    }
  }

  const mainSubjects = useMemo(() => {
    if (!details?.subjects?.length) return 'Non renseigné'
    return details.subjects.slice(0, 2).join(', ')
  }, [details?.subjects])

  const teachingClasses = useMemo(() => {
    const classes = details?.classes ?? []
    return [...classes].sort((a, b) => {
      const byYear = String(b.school_year_name ?? '').localeCompare(String(a.school_year_name ?? ''), 'fr')
      if (byYear !== 0) return byYear
      return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'fr')
    })
  }, [details?.classes])

  const evaluationRows = useMemo(() => {
    return details?.evaluations ?? []
  }, [details?.evaluations])

  const availableSubjectNames = useMemo(() => {
    if (!evaluationRows.length) return []
    return Array.from(new Set(evaluationRows.map((row) => row.subject_name))).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [evaluationRows])

  const filteredAndSortedEvaluations = useMemo(() => {
    const filtered = evaluationRows.filter((row) => {
      if (evaluationClassFilter !== 'all' && row.class_id !== evaluationClassFilter) return false
      if (evaluationSubjectFilter !== 'all' && row.subject_name !== evaluationSubjectFilter) return false
      return true
    })

    const directionFactor = evaluationSort.direction === 'asc' ? 1 : -1
    return [...filtered].sort((left, right) => {
      const leftValue = toComparable(left[evaluationSort.key])
      const rightValue = toComparable(right[evaluationSort.key])

      if (leftValue < rightValue) return -1 * directionFactor
      if (leftValue > rightValue) return 1 * directionFactor
      return 0
    })
  }, [evaluationClassFilter, evaluationRows, evaluationSort, evaluationSubjectFilter])

  const evaluationSummary = details?.evaluation_summary ?? {
    assessment_count: 0,
    class_count: 0,
    subject_count: 0,
    expected_grade_count: 0,
    grade_count: 0,
  }

  function syncPersonalForm(source) {
    setPersonalForm({
      first_name: source.first_name ?? '',
      last_name: source.last_name ?? '',
      birth_date: toDateInput(source.birth_date),
      gender: source.gender ?? '',
      email: source.email ?? '',
      phone: source.phone ?? '',
      address: source.address ?? '',
      hire_date: toDateInput(source.hire_date),
      qualification: source.qualification ?? '',
    })
  }

  function startPersonalEdit() {
    if (!details) return
    syncPersonalForm(details)
    setPersonalFieldErrors({})
    setErrorMessage('')
    setIsEditingPersonal(true)
  }

  function cancelPersonalEdit() {
    if (!details || personalSaving) return
    syncPersonalForm(details)
    setPersonalFieldErrors({})
    setErrorMessage('')
    setIsEditingPersonal(false)
  }

  function handlePersonalFieldChange(field, value) {
    setPersonalForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function validatePersonalForm() {
    const errors = {}

    const firstName = personalForm.first_name.trim()
    const lastName = personalForm.last_name.trim()
    const email = personalForm.email.trim()
    const phone = personalForm.phone.trim()
    const gender = personalForm.gender.trim()

    if (!firstName) errors.first_name = 'Le prénom est obligatoire.'
    if (!lastName) errors.last_name = 'Le nom est obligatoire.'
    if (firstName.length > 100) errors.first_name = 'Le prénom ne peut pas dépasser 100 caractères.'
    if (lastName.length > 100) errors.last_name = 'Le nom ne peut pas dépasser 100 caractères.'
    if (gender && gender.length > 20) errors.gender = 'Le sexe ne peut pas dépasser 20 caractères.'
    if (phone && phone.length > 30) errors.phone = 'Le téléphone ne peut pas dépasser 30 caractères.'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'L\'adresse email est invalide.'

    return errors
  }

  async function savePersonalInfo() {
    if (!teacher?.id || personalSaving) return

    const validationErrors = validatePersonalForm()
    setPersonalFieldErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    const payload = {
      first_name: personalForm.first_name.trim(),
      last_name: personalForm.last_name.trim(),
      birth_date: personalForm.birth_date || null,
      gender: normalizeOptionalString(personalForm.gender),
      email: normalizeOptionalString(personalForm.email),
      phone: normalizeOptionalString(personalForm.phone),
      address: normalizeOptionalString(personalForm.address),
      hire_date: personalForm.hire_date || null,
      qualification: normalizeOptionalString(personalForm.qualification),
    }

    setPersonalSaving(true)
    setErrorMessage('')
    try {
      const updated = await updateTeacherProfile(teacher.id, payload)
      setDetails(updated)
      setIsEditingPersonal(false)
      toast.success('Informations enseignant mises à jour avec succès.')
    } catch (error) {
      setErrorMessage(error.message)
      toast.error(error.message || 'Échec de la mise à jour.')
    } finally {
      setPersonalSaving(false)
    }
  }

  async function handleTeacherPhotoChange(event) {
    const photo = event.target.files?.[0]
    event.target.value = ''
    if (!photo || !details?.account_id) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
      toast.error('La photo doit être en JPEG, PNG ou WebP et ne pas dépasser 5 Mo.')
      return
    }
    try {
      await uploadAccountPhoto(details.account_id, photo)
      await loadTeacher()
      toast.success('Photo de l’enseignant mise à jour.')
    } catch (error) {
      toast.error(error.message)
    }
  }

  function openSubjectAssignModal() {
    setErrorMessage('')
    setSubjectAssignError('')
    setSubjectAssignOpen(true)
    setSubjectAssignClassId('')
    setSubjectAssignClassSubjectId('')
    setSubjectAssignStartDate(currentDateInput())
  }

  function closeSubjectAssignModal() {
    if (subjectAssignSaving) return
    setSubjectAssignOpen(false)
    setSubjectAssignClassId('')
    setSubjectAssignClassSubjectId('')
    setSubjectAssignOptions([])
    setSubjectAssignError('')
  }

  useEffect(function loadAvailableAssignmentsEffect() {
    async function loadAvailableAssignments() {
      if (!subjectAssignOpen || !teacher?.id) {
        setSubjectAssignOptions([])
        setSubjectAssignClassSubjectId('')
        return
      }

      setSubjectAssignLoading(true)
      setSubjectAssignError('')
      try {
        const options = await getAvailableTeacherAssignments(teacher.id)
        setSubjectAssignOptions(options)
        setSubjectAssignClassId('')
        setSubjectAssignClassSubjectId('')
        setSubjectAssignStartDate(currentDateInput())
      } catch (error) {
        setSubjectAssignError(error.message)
        setSubjectAssignOptions([])
        setSubjectAssignClassSubjectId('')
      } finally {
        setSubjectAssignLoading(false)
      }
    }

    loadAvailableAssignments()
  }, [subjectAssignOpen, teacher?.id])

  const availableAssignmentClasses = useMemo(() => {
    const byId = new Map()
    for (const option of subjectAssignOptions) {
      if (!byId.has(option.class_id)) byId.set(option.class_id, option)
    }
    return Array.from(byId.values())
  }, [subjectAssignOptions])

  const availableAssignmentsForClass = useMemo(
    () => subjectAssignOptions.filter((option) => option.class_id === subjectAssignClassId),
    [subjectAssignClassId, subjectAssignOptions],
  )

  const selectedAssignmentClass = useMemo(
    () => subjectAssignOptions.find((option) => option.class_id === subjectAssignClassId),
    [subjectAssignClassId, subjectAssignOptions],
  )

  const classHasAvailableSubject = useMemo(
    () => availableAssignmentsForClass.some((option) => !option.is_assigned),
    [availableAssignmentsForClass],
  )

  const selectedAssignmentOption = useMemo(
    () => subjectAssignOptions.find((option) => option.class_subject_id === subjectAssignClassSubjectId),
    [subjectAssignClassSubjectId, subjectAssignOptions],
  )

  function selectAssignmentClass(classId) {
    const firstOption = subjectAssignOptions.find((option) => option.class_id === classId)
    setSubjectAssignClassId(classId)
    setSubjectAssignClassSubjectId('')
    setSubjectAssignStartDate(clampDateToSchoolYear(currentDateInput(), firstOption))
  }

  async function confirmSubjectAssign() {
    if (!teacher?.id || !subjectAssignClassSubjectId || !subjectAssignStartDate) return

    if (selectedAssignmentOption?.is_assigned) {
      setSubjectAssignError('Cette matière possède déjà un enseignant actif.')
      return
    }

    if (
      selectedAssignmentOption
      && (
        subjectAssignStartDate < selectedAssignmentOption.school_year_start_date
        || subjectAssignStartDate > selectedAssignmentOption.school_year_end_date
      )
    ) {
      setSubjectAssignError('La date de début doit appartenir à l’année scolaire de la classe.')
      return
    }

    setSubjectAssignSaving(true)
    setSubjectAssignError('')
    setErrorMessage('')
    try {
      const updated = await createTeacherAssignment(teacher.id, {
        class_subject_id: subjectAssignClassSubjectId,
        start_date: subjectAssignStartDate,
      })
      setDetails(updated)
      setSubjectAssignOpen(false)
      setSubjectAssignClassId('')
      setSubjectAssignClassSubjectId('')
      setSubjectAssignOptions([])
      toast.success('Matière affectée avec succès.')
    } catch (error) {
      setSubjectAssignError(error.message)
      toast.error(error.message || 'Échec de l\'affectation de la matière.')
    } finally {
      setSubjectAssignSaving(false)
    }
  }

  function requestSubjectRemoval(row) {
    setSubjectToRemove(row)
  }

  async function confirmSubjectRemoval() {
    if (!teacher?.id || !subjectToRemove) return
    setSubjectRemoving(true)
    setErrorMessage('')
    try {
      const updated = await endTeacherAssignment(
        teacher.id,
        subjectToRemove.id,
        getAssignmentEndDate(subjectToRemove),
      )
      setDetails(updated)
      setSubjectToRemove(null)
      toast.success('Matière désaffectée avec succès.')
    } catch (error) {
      setErrorMessage(error.message)
      toast.error(error.message || 'Échec de la désaffectation.')
    } finally {
      setSubjectRemoving(false)
    }
  }

  function cancelSubjectRemoval() {
    if (subjectRemoving) return
    setSubjectToRemove(null)
  }

  function toggleEvaluationSort(key) {
    setEvaluationSort((current) => {
      if (current.key !== key) {
        return { key, direction: 'asc' }
      }
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  function getSortLabel(key) {
    if (evaluationSort.key !== key) return '↕'
    return evaluationSort.direction === 'asc' ? '↑' : '↓'
  }

  function openEvaluationRow(row) {
    toast.info(`Détail non disponible V1 pour ${row.subject_name} (${row.class_name}).`)
  }

  if (loading) return <main className="tdp-main"><p>Chargement de l’enseignant…</p></main>
  if (!details) return <main className="tdp-main"><p className="tdp-error">{errorMessage || 'Enseignant introuvable.'}</p></main>

  return (
    <main className="tdp-main">
      <h1 className="tdp-title">Détails de l’enseignant</h1>

      <AlertBanner
        type="error"
        message={errorMessage}
        onDismiss={() => setErrorMessage('')}
      />

      <section className="tdp-hero">
        <div className="tdp-hero__top">
          <div className="tdp-hero__identity">
            <span className="tdp-hero__avatar">
              <img
                src={details.photo_path || DEFAULT_PHOTO}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = DEFAULT_PHOTO
                }}
              />
            </span>
            {canEdit ? <><input ref={photoInputRef} className="tdp-photo-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleTeacherPhotoChange} /><button type="button" className="tdp-photo-edit" onClick={function openPhotoPicker() { photoInputRef.current?.click() }} aria-label="Modifier la photo"><Pencil size={14} /></button></> : null}

            <div>
              <h2 className="tdp-hero__name">{formatProfileName(details.first_name, details.last_name, details.gender)}</h2>
              <div className="tdp-hero__badges">
                <span className={`tdp-pill ${isActive(details) ? 'tdp-pill--active' : 'tdp-pill--inactive'}`}>
                  {isActive(details) ? 'Actif' : 'Inactif'}
                </span>
                {hasMainTeacherClass(details.classes) && (
                  <span className="tdp-pill tdp-pill--main">Professeur principal</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <dl className="tdp-hero__stats">
          <div>
            <dt>Matricule</dt>
            <dd>{details.registration_number}</dd>
          </div>
          <div>
            <dt>Matières principales</dt>
            <dd>{mainSubjects}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{details.email ?? 'Non renseigné'}</dd>
          </div>
          <div>
            <dt>Téléphone</dt>
            <dd>{details.phone ?? 'Non renseigné'}</dd>
          </div>
        </dl>
      </section>

      <section className="tdp-panels">
        <nav className="tdp-tabs" aria-label="Onglets du dossier enseignant">
          <button
            type="button"
            className={activeTab === 'personal' ? 'tdp-tab tdp-tab--active' : 'tdp-tab'}
            onClick={() => setActiveTab('personal')}
          >
            Informations personnelles
          </button>
          <button
            type="button"
            className={activeTab === 'classes' ? 'tdp-tab tdp-tab--active' : 'tdp-tab'}
            onClick={() => setActiveTab('classes')}
          >
            Classes
          </button>
          <button
            type="button"
            className={activeTab === 'subjects' ? 'tdp-tab tdp-tab--active' : 'tdp-tab'}
            onClick={() => setActiveTab('subjects')}
          >
            Matières enseignées
          </button>
          <button
            type="button"
            className={activeTab === 'evaluations' ? 'tdp-tab tdp-tab--active' : 'tdp-tab'}
            onClick={() => setActiveTab('evaluations')}
          >
            Évaluations
          </button>
        </nav>

        {activeTab === 'personal' && (
          <article className="tdp-panel tdp-panel--personal">
            <div className="tdp-panel__head tdp-panel__head--classes">
              <div>
                <h3>Informations personnelles</h3>
                <p className="tdp-panel__description">Données administratives du dossier enseignant.</p>
              </div>
              {canEdit && !isEditingPersonal ? (
                <button type="button" className="tdp-assign-button" onClick={startPersonalEdit}>
                  <Pencil aria-hidden="true" size={16} />
                  Modifier
                </button>
              ) : canEdit && isEditingPersonal ? (
                <div className="tdp-actions-row">
                  <button type="button" className="tdp-modal__secondary" onClick={cancelPersonalEdit} disabled={personalSaving}>
                    Annuler
                  </button>
                  <button type="button" className="tdp-modal__primary" onClick={savePersonalInfo} disabled={personalSaving}>
                    {personalSaving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              ) : null}
            </div>
            {!canEdit || !isEditingPersonal ? (
              <dl className="tdp-personal-list">
                <div>
                  <dt><UserRound aria-hidden="true" size={16} /> Prénom</dt>
                  <dd>{details.first_name || '—'}</dd>
                </div>
                <div>
                  <dt><UserRound aria-hidden="true" size={16} /> Nom</dt>
                  <dd>{details.last_name || '—'}</dd>
                </div>
                <div>
                  <dt><CalendarDays aria-hidden="true" size={16} /> Date de naissance</dt>
                  <dd>{formatDate(details.birth_date)}</dd>
                </div>
                <div>
                  <dt><Shield aria-hidden="true" size={16} /> Sexe</dt>
                  <dd>{genderLabel(details.gender)}</dd>
                </div>
                <div>
                  <dt><MapPin aria-hidden="true" size={16} /> Adresse</dt>
                  <dd>{details.address ?? 'Non renseignée'}</dd>
                </div>
                <div>
                  <dt><Phone aria-hidden="true" size={16} /> Téléphone</dt>
                  <dd>{details.phone ?? 'Non renseigné'}</dd>
                </div>
                <div>
                  <dt><Mail aria-hidden="true" size={16} /> Email</dt>
                  <dd>{details.email ?? 'Non renseigné'}</dd>
                </div>
                <div>
                  <dt><BadgeInfo aria-hidden="true" size={16} /> Matricule</dt>
                  <dd>{details.registration_number}</dd>
                </div>
                <div>
                  <dt><CalendarDays aria-hidden="true" size={16} /> Date d’embauche</dt>
                  <dd>{formatDate(details.hire_date)}</dd>
                </div>
                <div>
                  <dt><GraduationCap aria-hidden="true" size={16} /> Qualification</dt>
                  <dd>{details.qualification ?? 'Non renseignée'}</dd>
                </div>
              </dl>
            ) : (
              <form className="tdp-edit-form" onSubmit={(event) => event.preventDefault()}>
                <label>
                  <span>Prénom</span>
                  <input
                    type="text"
                    value={personalForm.first_name}
                    onChange={(event) => handlePersonalFieldChange('first_name', event.target.value)}
                    maxLength={100}
                  />
                  <FieldError message={personalFieldErrors.first_name} />
                </label>

                <label>
                  <span>Nom</span>
                  <input
                    type="text"
                    value={personalForm.last_name}
                    onChange={(event) => handlePersonalFieldChange('last_name', event.target.value)}
                    maxLength={100}
                  />
                  <FieldError message={personalFieldErrors.last_name} />
                </label>

                <label>
                  <span>Date de naissance</span>
                  <input
                    type="date"
                    value={personalForm.birth_date}
                    onChange={(event) => handlePersonalFieldChange('birth_date', event.target.value)}
                  />
                </label>

                <label>
                  <span>Sexe</span>
                  <input
                    type="text"
                    value={personalForm.gender}
                    onChange={(event) => handlePersonalFieldChange('gender', event.target.value)}
                    maxLength={20}
                    placeholder="Ex: M, F, MALE, FEMALE"
                  />
                  <FieldError message={personalFieldErrors.gender} />
                </label>

                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={personalForm.email}
                    onChange={(event) => handlePersonalFieldChange('email', event.target.value)}
                    maxLength={254}
                  />
                  <FieldError message={personalFieldErrors.email} />
                </label>

                <label>
                  <span>Téléphone</span>
                  <input
                    type="text"
                    value={personalForm.phone}
                    onChange={(event) => handlePersonalFieldChange('phone', event.target.value)}
                    maxLength={30}
                  />
                  <FieldError message={personalFieldErrors.phone} />
                </label>

                <label className="tdp-edit-form__full">
                  <span>Adresse</span>
                  <textarea
                    value={personalForm.address}
                    onChange={(event) => handlePersonalFieldChange('address', event.target.value)}
                    rows={3}
                  />
                </label>

                <label>
                  <span>Date d’embauche</span>
                  <input type="date" value={personalForm.hire_date} onChange={(event) => handlePersonalFieldChange('hire_date', event.target.value)} />
                </label>

                <label className="tdp-edit-form__full">
                  <span>Qualification</span>
                  <textarea
                    value={personalForm.qualification}
                    onChange={(event) => handlePersonalFieldChange('qualification', event.target.value)}
                    rows={3}
                  />
                </label>
              </form>
            )}
          </article>
        )}

        {activeTab === 'classes' && (
          <article className="tdp-panel">
            <div className="tdp-panel__head tdp-panel__head--classes">
              <div>
                <h3>Classes encadrées</h3>
                <p className="tdp-panel__description">
                  Liste de toutes les classes dans lesquelles cet enseignant intervient.
                </p>
              </div>
            </div>

            <div className="tdp-table-wrap">
              <table className="tdp-table tdp-table--classes">
                <thead>
                  <tr>
                    <th>Classe</th>
                    <th>Niveau</th>
                    <th>Année scolaire</th>
                    <th>Rôle</th>
                    <th>Effectif</th>
                  </tr>
                </thead>
                <tbody>
                  {teachingClasses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="tdp-empty">Aucune classe d’enseignement associée.</td>
                    </tr>
                  ) : (
                    teachingClasses.map((schoolClass, index) => (
                      <tr key={schoolClass.id}>
                        <td>
                          <span className="tdp-class-name">
                            <span className={`tdp-class-dot tdp-class-dot--${index % 3}`} />
                            <span>
                              <strong>{schoolClass.name}</strong>
                              <small>{schoolClass.group_label}</small>
                            </span>
                          </span>
                        </td>
                        <td>{schoolClass.level_name}</td>
                        <td>{schoolClass.school_year_name}</td>
                        <td>
                          {schoolClass.is_main_teacher
                            ? <span className="tdp-role-badge">Professeur principal</span>
                            : '—'}
                        </td>
                        <td>{schoolClass.student_count === null ? '—' : `${schoolClass.student_count} élève(s)`}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="tdp-table-footer">
              <span>Affichage 1 à {teachingClasses.length} sur {teachingClasses.length} classes</span>
            </div>
          </article>
        )}

        {activeTab === 'subjects' && (
          <article className="tdp-panel">
            <div className="tdp-panel__head tdp-panel__head--classes">
              <div>
                <h3>Matières enseignées</h3>
                <p className="tdp-panel__description">
                  Liste des matières que l’enseignant enseigne et des classes associées.
                </p>
              </div>
              {canEdit && (
                <button type="button" className="tdp-assign-button" onClick={openSubjectAssignModal}>
                  <BookOpen aria-hidden="true" size={16} />
                  Affecter une matière
                </button>
              )}
            </div>

            <div className="tdp-table-wrap">
              <table className="tdp-table tdp-table--subjects">
                <thead>
                  <tr>
                    <th>Matière</th>
                    <th>Niveau / Classe</th>
                    <th>Coefficient</th>
                    <th>Année scolaire</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {details.taught_subjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="tdp-empty">
                        Aucune matière rattachée.
                      </td>
                    </tr>
                  ) : (
                    details.taught_subjects.map((subjectRow, index) => (
                      <tr key={subjectRow.id}>
                        <td>
                          <span className="tdp-subject-name">
                            <span className={`tdp-subject-icon tdp-subject-icon--${index % 2}`}>
                              <BookOpen aria-hidden="true" size={13} />
                            </span>
                            <strong>{subjectRow.subject_name}</strong>
                          </span>
                        </td>
                        <td>
                          <span className="tdp-subject-class">
                            <strong>{subjectRow.class_name}</strong>
                            <small>{subjectRow.level_name}</small>
                          </span>
                        </td>
                        <td>{subjectRow.coefficient}</td>
                        <td>{subjectRow.school_year_name}</td>
                        <td>
                          {canEdit ? (
                            <button
                              type="button"
                              className="tdp-danger-action"
                              onClick={() => requestSubjectRemoval(subjectRow)}
                            >
                              <Unlink aria-hidden="true" size={14} />
                              Désaffecter
                            </button>
                          ) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        )}

        {activeTab === 'evaluations' && (
          <article className="tdp-panel">
            <section className="tdp-panel tdp-panel--nested">
              <h3>Synthèse</h3>
              <div className="tdp-kpi-grid">
                <article><span>Évaluations créées</span><strong>{evaluationSummary.assessment_count}</strong></article>
                <article><span>Classes couvertes</span><strong>{evaluationSummary.class_count}</strong></article>
                <article><span>Matières couvertes</span><strong>{evaluationSummary.subject_count}</strong></article>
                <article>
                  <span>Notes saisies</span>
                  <strong>{evaluationSummary.grade_count} / {evaluationSummary.expected_grade_count}</strong>
                </article>
              </div>
            </section>

            <div className="tdp-eval-filters">
              <label>
                <span>Classe</span>
                <select value={evaluationClassFilter} onChange={(event) => setEvaluationClassFilter(event.target.value)}>
                  <option value="all">Toutes les classes</option>
                  {teachingClasses.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Matière</span>
                <select value={evaluationSubjectFilter} onChange={(event) => setEvaluationSubjectFilter(event.target.value)}>
                  <option value="all">Toutes les matières</option>
                  {availableSubjectNames.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="tdp-panel__head tdp-panel__head--stacked">
              <div>
                <h3>Liste des évaluations</h3>
              </div>
            </div>

            <div className="tdp-sort-toolbar" aria-label="Tri des évaluations">
              <button type="button" className="tdp-sort-btn" onClick={() => toggleEvaluationSort('title')}>
                Titre {getSortLabel('title')}
              </button>
              <button type="button" className="tdp-sort-btn" onClick={() => toggleEvaluationSort('subject_name')}>
                Matière {getSortLabel('subject_name')}
              </button>
              <button type="button" className="tdp-sort-btn" onClick={() => toggleEvaluationSort('class_name')}>
                Classe {getSortLabel('class_name')}
              </button>
              <button type="button" className="tdp-sort-btn" onClick={() => toggleEvaluationSort('assessment_date')}>
                Date {getSortLabel('date')}
              </button>
              <button type="button" className="tdp-sort-btn" onClick={() => toggleEvaluationSort('coefficient')}>
                Coefficient {getSortLabel('coefficient')}
              </button>
              <button type="button" className="tdp-sort-btn" onClick={() => toggleEvaluationSort('maximum_score')}>
                Barème {getSortLabel('maximum_score')}
              </button>
            </div>

            <div className="tdp-table-wrap">
              <table className="tdp-table tdp-table--evaluations">
                <thead>
                  <tr>
                    <th>Titre</th>
                    <th>Matière</th>
                    <th>Classe</th>
                    <th>Date</th>
                    <th>Coefficient</th>
                    <th>Barème</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedEvaluations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="tdp-empty">Aucune évaluation disponible pour ces filtres.</td>
                    </tr>
                  ) : (
                    filteredAndSortedEvaluations.map((row) => (
                      <tr
                        key={row.id}
                        className="tdp-row-clickable"
                        onClick={() => openEvaluationRow(row)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openEvaluationRow(row)
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <td>{row.title}</td>
                        <td>{row.subject_name}</td>
                        <td>{row.class_name}</td>
                        <td>{formatDate(row.assessment_date)}</td>
                        <td>{row.coefficient}</td>
                        <td>{row.maximum_score}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        )}

        {canEdit && subjectAssignOpen && (
          <div className="tdp-modal-backdrop" role="presentation">
            <section className="tdp-modal" role="dialog" aria-modal="true" aria-labelledby="tdp-assign-subject-title">
              <header className="tdp-modal__header">
                <div>
                  <h3 id="tdp-assign-subject-title">Affecter une matière</h3>
                  <p>Choisissez une classe, puis l’une de ses matières disponibles.</p>
                </div>
                <button type="button" className="tdp-modal__close" onClick={closeSubjectAssignModal} aria-label="Fermer">
                  <X aria-hidden="true" size={16} />
                </button>
              </header>

              <div className="tdp-modal__body">
                {subjectAssignError && (
                  <AlertBanner type="error" message={subjectAssignError} onDismiss={() => setSubjectAssignError('')} />
                )}

                {!subjectAssignLoading && availableAssignmentClasses.length === 0 ? (
                  <p>Aucune classe disponible pour cette affectation.</p>
                ) : (
                  <>
                    <label className="tdp-modal__field">
                      <span>Classe</span>
                      <select value={subjectAssignClassId} onChange={(event) => selectAssignmentClass(event.target.value)}>
                        <option value="">Choisir une classe</option>
                        {availableAssignmentClasses.map((schoolClass) => (
                          <option key={schoolClass.class_id} value={schoolClass.class_id}>
                            {schoolClass.class_name} - {schoolClass.school_year_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="tdp-modal__field">
                      <span>Matière</span>
                      <select
                        value={subjectAssignClassSubjectId}
                        onChange={(event) => setSubjectAssignClassSubjectId(event.target.value)}
                        disabled={subjectAssignLoading || !subjectAssignClassId}
                      >
                        <option value="">Choisir une matière</option>
                        {availableAssignmentsForClass.map((subject) => (
                          <option
                            key={subject.class_subject_id}
                            value={subject.class_subject_id}
                            disabled={subject.is_assigned}
                          >
                            {subject.subject_name}
                            {subject.is_assigned
                              ? ` — déjà affectée à ${subject.assigned_teacher_name || 'un enseignant'}`
                              : ''}
                          </option>
                        ))}
                      </select>
                      {subjectAssignClassId && (
                        <small>Les matières grisées possèdent déjà un enseignant actif.</small>
                      )}
                    </label>

                    <label className="tdp-modal__field">
                      <span>Date de début</span>
                      <input
                        type="date"
                        value={subjectAssignStartDate}
                        onChange={(event) => setSubjectAssignStartDate(event.target.value)}
                        min={selectedAssignmentClass?.school_year_start_date}
                        max={selectedAssignmentClass?.school_year_end_date}
                      />
                    </label>

                    {subjectAssignLoading && <p>Chargement des matières disponibles…</p>}
                    {!subjectAssignLoading && subjectAssignClassId && !classHasAvailableSubject && (
                      <p>Toutes les matières de cette classe possèdent déjà un enseignant actif.</p>
                    )}
                  </>
                )}
              </div>

              <footer className="tdp-modal__actions">
                <button type="button" className="tdp-modal__secondary" onClick={closeSubjectAssignModal} disabled={subjectAssignSaving}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="tdp-modal__primary"
                  onClick={confirmSubjectAssign}
                  disabled={
                    !subjectAssignClassId
                    || !subjectAssignClassSubjectId
                    || !subjectAssignStartDate
                    || subjectAssignSaving
                    || subjectAssignLoading
                    || selectedAssignmentOption?.is_assigned
                    || availableAssignmentClasses.length === 0
                  }
                >
                  {subjectAssignSaving ? 'Affectation…' : 'Confirmer'}
                </button>
              </footer>
            </section>
          </div>
        )}

        {canEdit && (
        <ConfirmationDialog
          open={Boolean(subjectToRemove)}
          title="Désaffecter une matière"
          message={
            subjectToRemove
              ? `Confirmer la désaffectation de ${subjectToRemove.subject_name} pour ${subjectToRemove.class_name} ?`
              : ''
          }
          confirmLabel="Désaffecter"
          cancelLabel="Annuler"
          tone="danger"
          loading={subjectRemoving}
          onCancel={cancelSubjectRemoval}
          onConfirm={confirmSubjectRemoval}
        />
        )}

      </section>
    </main>
  )
}
