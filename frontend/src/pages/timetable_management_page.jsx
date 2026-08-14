import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  History,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  PencilRuler,
  Plus,
  School,
  Settings,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react'

import { useToast } from '../components/feedback/ToastProvider.jsx'
import {
  getSchoolClassesOverview,
  getSchoolClassSubjects,
} from '../services/school_classes_overview_service.js'
import {
  createSpecialCourse,
  createTimetableSlot,
  deleteSpecialCourse,
  deleteTimetableSlot,
  generateTimetable,
  getClassSpecialCourses,
  getClassTimetable,
  getDraftConflicts,
  getRooms,
  getTimetableConfiguration,
  validateTimetable,
} from '../services/timetable_service.js'
import { listStudents } from '../services/students_service.js'
import { getScheduleRows } from '../utils/timetable_display.js'
import '../styles/timetable_management_page.css'
import '../styles/student_timetable_page.css'

const DAY_LABELS = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
  7: 'Dimanche',
}

const TABS = [
  { key: 'overview', label: 'Accueil', icon: LayoutDashboard },
  { key: 'build', label: 'Créer le brouillon', icon: PencilRuler },
  { key: 'schedule', label: 'Emploi du temps', icon: CalendarDays },
  { key: 'special', label: 'Cours particuliers', icon: Users },
  { key: 'configuration', label: 'Configuration', icon: Settings, disabled: true },
  { key: 'history', label: 'Historique', icon: History, disabled: true },
]

const SUBJECT_PALETTE = ['violet', 'green', 'blue', 'orange', 'pink', 'teal', 'yellow', 'red']

const EMPTY_SLOT_FORM = {
  classSubjectId: '',
  dayOfWeek: '1',
  startTime: '',
  endTime: '',
  roomId: '',
}

const EMPTY_SPECIAL_COURSE_FORM = {
  studentId: '',
  subjectId: '',
  title: '',
  dayOfWeek: '1',
  startTime: '17:30',
  endTime: '19:00',
  note: '',
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : '—'
}

function formatClassName(schoolClass) {
  if (!schoolClass) return ''
  return `${schoolClass.level_name} ${schoolClass.group_label ?? ''}`.trim()
}

function sortTimetableSlots(firstSlot, secondSlot) {
  if (firstSlot.day_of_week !== secondSlot.day_of_week) {
    return firstSlot.day_of_week - secondSlot.day_of_week
  }
  return String(firstSlot.start_time).localeCompare(String(secondSlot.start_time))
}

/** Fusionne les pauses de chaque jour configuré en une seule liste, sans doublons. */
function flattenBreaks(days) {
  const breaksByKey = new Map()
  for (const day of days ?? []) {
    for (const schoolBreak of day.breaks ?? []) {
      breaksByKey.set(`${schoolBreak.start_time}-${schoolBreak.end_time}-${schoolBreak.label}`, schoolBreak)
    }
  }
  return [...breaksByKey.values()]
}

/**
 * Grille hebdomadaire réutilisable (aperçu du brouillon comme planning publié).
 */
function TimetableGrid({ slots, breaks, editable = false, onDeleteSlot, deletingSlotId }) {
  const gridDayLabels = [1, 2, 3, 4, 5, 6, 7].map(function toLabel(dayNumber) { return DAY_LABELS[dayNumber] })
  const daySchedule = getScheduleRows(slots, breaks)
  const subjectColorByName = new Map()
  slots.forEach(function assignSubjectColor(slot) {
    if (!subjectColorByName.has(slot.subject_name)) {
      subjectColorByName.set(slot.subject_name, SUBJECT_PALETTE[subjectColorByName.size % SUBJECT_PALETTE.length])
    }
  })

  function findSlotsForCell(dayIndex, period) {
    return slots.filter(
      (slot) =>
        slot.day_of_week === dayIndex + 1 &&
        formatTime(slot.start_time) < period.end &&
        formatTime(slot.end_time) > period.start
    )
  }

  function renderDeleteButton(slot, size) {
    if (!editable || slot.status !== 'DRAFT') return null
    return (
      <button
        type="button"
        className="tmp-icon-button stp-cell__delete"
        disabled={deletingSlotId === slot.id}
        title="Retirer ce créneau"
        onClick={function deleteSelectedSlot(event) { event.stopPropagation(); onDeleteSlot(slot.id) }}
      >
        <Trash2 aria-hidden="true" size={size} />
      </button>
    )
  }

  return (
    <div className="stp-grid-wrapper">
      <div className="stp-grid">
        <div className="stp-grid__corner" />
        {gridDayLabels.map((day) => (
          <div key={day} className="stp-grid__day-head">{day}</div>
        ))}

        {daySchedule.map((entry) => (
          entry.type === 'break' ? (
            <div key={`break-${entry.start}`} className="stp-break-row">
              {entry.label} ({entry.start}-{entry.end})
            </div>
          ) : (
            <Fragment key={`period-${entry.start}`}>
              <div className="stp-grid__time">
                <strong>{entry.start}</strong>
                <span>{entry.end}</span>
              </div>
              {gridDayLabels.map((day, dayIndex) => {
                const cellSlots = findSlotsForCell(dayIndex, entry)
                if (cellSlots.length === 0) {
                  return <div key={`${day}-${entry.start}`} className="stp-cell stp-cell--free">Libre</div>
                }
                if (cellSlots.length === 1) {
                  const slot = cellSlots[0]
                  const color = subjectColorByName.get(slot.subject_name) ?? 'violet'
                  return (
                    <div key={`${day}-${entry.start}`} className={`stp-cell stp-cell--${color}`}>
                      <span className="stp-cell__title"><BookOpen aria-hidden="true" size={14} /> {slot.subject_name}</span>
                      <span className="stp-cell__meta">
                        {slot.teacher_name}{slot.room_name ? ` · ${slot.room_name}` : ''}
                      </span>
                      {renderDeleteButton(slot, 14)}
                    </div>
                  )
                }
                return (
                  <div key={`${day}-${entry.start}`} className="stp-cell stp-cell--parallel" title={`${cellSlots.length} cours en parallèle`}>
                    {cellSlots.map(function renderParallelSlot(slot) {
                      const color = subjectColorByName.get(slot.subject_name) ?? 'violet'
                      return (
                        <div key={slot.id} className={`stp-cell__sub stp-cell--${color}`}>
                          <span className="stp-cell__title"><BookOpen aria-hidden="true" size={12} /> {slot.subject_name}</span>
                          <span className="stp-cell__meta">
                            {slot.teacher_name}{slot.room_name ? ` · ${slot.room_name}` : ''}
                          </span>
                          {renderDeleteButton(slot, 12)}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </Fragment>
          )
        ))}
      </div>
    </div>
  )
}

export default function TimetableManagementPage() {
  const toast = useToast()
  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [showClassPicker, setShowClassPicker] = useState(false)
  const [pendingClassId, setPendingClassId] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [buildMode, setBuildMode] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [rooms, setRooms] = useState([])
  const [savedSlots, setSavedSlots] = useState([])
  const [publishedSlots, setPublishedSlots] = useState([])
  const [draftConflicts, setDraftConflicts] = useState([])
  const [scheduleBreaks, setScheduleBreaks] = useState([])
  const [classDataLoading, setClassDataLoading] = useState(false)
  const [savingSlot, setSavingSlot] = useState(false)
  const [deletingSlotId, setDeletingSlotId] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT_FORM)

  const [requirements, setRequirements] = useState([])
  const [configLoading, setConfigLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [unplacedRequirements, setUnplacedRequirements] = useState([])

  const [specialCourses, setSpecialCourses] = useState([])
  const [classStudents, setClassStudents] = useState([])
  const [specialCoursesLoading, setSpecialCoursesLoading] = useState(false)
  const [specialCourseForm, setSpecialCourseForm] = useState(EMPTY_SPECIAL_COURSE_FORM)
  const [savingSpecialCourse, setSavingSpecialCourse] = useState(false)
  const [deletingSpecialCourseId, setDeletingSpecialCourseId] = useState('')

  useEffect(function loadClassesEffect() {
    async function loadClasses() {
      try {
        const response = await getSchoolClassesOverview({ status: 'ACTIVE', limit: 100 })
        setClasses(Array.isArray(response) ? response : response.items ?? [])
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setClassesLoading(false)
      }
    }

    loadClasses()
  }, [])

  useEffect(function loadSelectedClassEffect() {
    if (!selectedClassId) return

    async function loadSelectedClass() {
      setClassDataLoading(true)
      setError('')
      try {
        const [classSubjects, classTimetable, published, availableRooms, configuration, conflicts] = await Promise.all([
          getSchoolClassSubjects(selectedClassId, { isActive: true }),
          getClassTimetable(selectedClassId),
          getClassTimetable(selectedClassId, { publishedOnly: true }),
          getRooms(),
          getTimetableConfiguration(selectedClassId),
          getDraftConflicts(selectedClassId),
        ])
        setSubjects(classSubjects)
        setSavedSlots([...classTimetable].sort(sortTimetableSlots))
        setPublishedSlots([...published].sort(sortTimetableSlots))
        setRooms(availableRooms)
        setScheduleBreaks(flattenBreaks(configuration.days))
        setDraftConflicts(conflicts)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setClassDataLoading(false)
      }
    }

    loadSelectedClass()
  }, [selectedClassId])

  useEffect(function loadGenerateTabEffect() {
    if (!selectedClassId || activeTab !== 'build' || buildMode !== 'generate') return

    async function loadConfiguration() {
      setConfigLoading(true)
      setError('')
      try {
        const configuration = await getTimetableConfiguration(selectedClassId)
        setRequirements(configuration.requirements.map(function toFormRow(requirement) {
          return { ...requirement, weekly_minutes: requirement.weekly_minutes ?? 60 }
        }))
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setConfigLoading(false)
      }
    }

    loadConfiguration()
  }, [selectedClassId, activeTab, buildMode])

  useEffect(function loadSpecialCoursesTabEffect() {
    if (!selectedClassId || activeTab !== 'special') return

    async function loadSpecialCourses() {
      setSpecialCoursesLoading(true)
      setError('')
      try {
        const [courses, studentsResponse] = await Promise.all([
          getClassSpecialCourses(selectedClassId),
          listStudents({ class_id: selectedClassId, limit: 200 }),
        ])
        setSpecialCourses(courses)
        setClassStudents(studentsResponse.items ?? studentsResponse ?? [])
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setSpecialCoursesLoading(false)
      }
    }

    loadSpecialCourses()
  }, [selectedClassId, activeTab])

  const selectedClass = classes.find(function findSelectedClass(schoolClass) {
    return schoolClass.id === selectedClassId
  })

  const selectedSubject = subjects.find(function findSelectedSubject(subject) {
    return subject.id === slotForm.classSubjectId
  })

  const timetableStatus = savedSlots[0]?.status ?? null
  const distinctTeacherCount = useMemo(function countDistinctTeachers() {
    return new Set(savedSlots.map(function getTeacherName(slot) {
      return slot.teacher_name
    }).filter(Boolean)).size
  }, [savedSlots])

  function openClassPicker() {
    setPendingClassId(selectedClassId)
    setShowClassPicker(true)
  }

  function confirmClassSelection() {
    if (!pendingClassId) return
    setSelectedClassId(pendingClassId)
    setActiveTab('overview')
    setBuildMode(null)
    setShowClassPicker(false)
  }

  function handleTabClick(tab) {
    if (!tab.disabled) setActiveTab(tab.key)
  }

  function handleSlotFieldChange(event) {
    const { name, value } = event.target
    setSlotForm(function updateSlotForm(currentForm) {
      return { ...currentForm, [name]: value }
    })
  }

  async function refreshTimetable() {
    const [classTimetable, conflicts] = await Promise.all([
      getClassTimetable(selectedClassId),
      getDraftConflicts(selectedClassId),
    ])
    setSavedSlots([...classTimetable].sort(sortTimetableSlots))
    setDraftConflicts(conflicts)
  }

  async function refreshPublishedTimetable() {
    const published = await getClassTimetable(selectedClassId, { publishedOnly: true })
    setPublishedSlots([...published].sort(sortTimetableSlots))
  }

  async function handlePublishTimetable() {
    setPublishing(true)
    setError('')
    try {
      await validateTimetable(selectedClassId)
      await Promise.all([refreshTimetable(), refreshPublishedTimetable()])
      toast.success('Le brouillon est désormais l’emploi du temps courant, visible des élèves et des enseignants.')
    } catch (publishError) {
      setError(publishError.message)
    } finally {
      setPublishing(false)
    }
  }

  async function handleCreateSlot(event) {
    event.preventDefault()
    setError('')

    if (!selectedSubject?.teacher_id) {
      setError('Cette matière ne possède pas encore d’enseignant actif.')
      return
    }
    if (slotForm.endTime <= slotForm.startTime) {
      setError('L’heure de fin doit être postérieure à l’heure de début.')
      return
    }

    setSavingSlot(true)
    try {
      await createTimetableSlot(selectedClassId, {
        class_subject_id: slotForm.classSubjectId,
        day_of_week: Number(slotForm.dayOfWeek),
        start_time: slotForm.startTime,
        end_time: slotForm.endTime,
        room_id: slotForm.roomId || null,
      })
      await refreshTimetable()
      setSlotForm(EMPTY_SLOT_FORM)
      toast.success('Le créneau a été ajouté au brouillon de l’emploi du temps. Voir l’aperçu ci-dessous.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSavingSlot(false)
    }
  }

  async function handleDeleteSlot(slotId) {
    setDeletingSlotId(slotId)
    setError('')
    try {
      await deleteTimetableSlot(slotId)
      await refreshTimetable()
      toast.success('Le créneau a été retiré du brouillon.')
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setDeletingSlotId('')
    }
  }

  function handleRequirementChange(classSubjectId, value) {
    setRequirements(function updateRequirements(currentRequirements) {
      return currentRequirements.map(function updateRow(row) {
        return row.class_subject_id === classSubjectId
          ? { ...row, weekly_minutes: value }
          : row
      })
    })
  }

  async function handleGenerateTimetable(event) {
    event.preventDefault()
    setError('')
    setUnplacedRequirements([])
    setGenerating(true)
    try {
      const result = await generateTimetable(
        selectedClassId,
        requirements.map(function toPayload(row) {
          return {
            class_subject_id: row.class_subject_id,
            weekly_minutes: Number(row.weekly_minutes),
          }
        }),
      )
      await refreshTimetable()
      setUnplacedRequirements(result.unplaced_requirements ?? [])
      toast.success('Un nouveau brouillon d’emploi du temps a été généré. Voir l’aperçu ci-dessous.')
    } catch (generateError) {
      setError(generateError.message)
    } finally {
      setGenerating(false)
    }
  }

  async function refreshSpecialCourses() {
    const courses = await getClassSpecialCourses(selectedClassId)
    setSpecialCourses(courses)
  }

  function handleSpecialCourseFieldChange(event) {
    const { name, value } = event.target
    setSpecialCourseForm(function updateForm(currentForm) {
      return { ...currentForm, [name]: value }
    })
  }

  async function handleCreateSpecialCourse(event) {
    event.preventDefault()
    setError('')

    if (specialCourseForm.endTime <= specialCourseForm.startTime) {
      setError('L’heure de fin doit être postérieure à l’heure de début.')
      return
    }

    setSavingSpecialCourse(true)
    try {
      await createSpecialCourse(selectedClassId, {
        student_id: specialCourseForm.studentId,
        subject_id: specialCourseForm.subjectId,
        title: specialCourseForm.title,
        day_of_week: Number(specialCourseForm.dayOfWeek),
        start_time: specialCourseForm.startTime,
        end_time: specialCourseForm.endTime,
        note: specialCourseForm.note || null,
      })
      await refreshSpecialCourses()
      setSpecialCourseForm(EMPTY_SPECIAL_COURSE_FORM)
      toast.success('Le cours particulier a été ajouté.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSavingSpecialCourse(false)
    }
  }

  async function handleDeleteSpecialCourse(specialCourseId) {
    setDeletingSpecialCourseId(specialCourseId)
    setError('')
    try {
      await deleteSpecialCourse(specialCourseId)
      await refreshSpecialCourses()
      toast.success('Le cours particulier a été retiré.')
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setDeletingSpecialCourseId('')
    }
  }

  return (
    <main className="tmp-main">
      <nav className="tmp-breadcrumb" aria-label="Fil d’Ariane">
        <span>Accueil</span>
        <ChevronRight aria-hidden="true" size={14} />
        <span>Emploi du temps</span>
      </nav>

      <header className="tmp-page-header">
        <h1>Emploi du temps</h1>
        <p>Consultez et organisez les plannings de l’établissement.</p>
      </header>

      {error && <p className="tmp-error" role="alert">{error}</p>}

      {!selectedClassId && (
        <section className="tmp-landing">
          <div className="tmp-landing__illustration" aria-hidden="true">
            <span className="tmp-calendar-art"><CalendarDays size={72} /></span>
            <span className="tmp-clock-art"><Clock3 size={34} /></span>
          </div>
          <div className="tmp-landing__content">
            <h2>Commencez par choisir une classe</h2>
            <p>Consultez son planning hebdomadaire ou préparez-le manuellement.</p>
          </div>
          <button type="button" className="tmp-btn-primary tmp-landing__button" onClick={openClassPicker}>
            <Users aria-hidden="true" size={18} /> Sélectionner une classe
          </button>
        </section>
      )}

      {selectedClassId && (
        <>
          <section className="tmp-selected-class">
            <div className="tmp-selected-class__identity">
              <span className="tmp-selected-class__icon"><School aria-hidden="true" size={24} /></span>
              <div>
                <span>Classe sélectionnée</span>
                <strong>{formatClassName(selectedClass)}</strong>
                <small>{selectedClass?.school_year_name ?? ''}</small>
              </div>
            </div>
            <button type="button" className="tmp-btn-secondary" onClick={openClassPicker}>Changer de classe</button>
          </section>

          <nav className="tmp-tabs" aria-label="Rubriques de l’emploi du temps">
            {TABS.map(function renderTab(tab) {
              const TabIcon = tab.icon
              const classNames = [
                'tmp-tab',
                activeTab === tab.key ? 'tmp-tab--active' : '',
                tab.disabled ? 'tmp-tab--disabled' : '',
              ].filter(Boolean).join(' ')

              return (
                <button
                  key={tab.key}
                  type="button"
                  className={classNames}
                  disabled={tab.disabled}
                  title={tab.disabled ? 'Disponible dans une prochaine version' : undefined}
                  onClick={function selectTab() { handleTabClick(tab) }}
                >
                  <TabIcon aria-hidden="true" size={16} />
                  <span>{tab.label}</span>
                  {tab.disabled && <LockKeyhole aria-label="Indisponible" size={13} />}
                </button>
              )
            })}
          </nav>

          {activeTab === 'overview' && (
            <section className="tmp-panel tmp-overview">
              <div className="tmp-panel__heading">
                <div>
                  <h2>Planning de {formatClassName(selectedClass)}</h2>
                  <p>Créez les créneaux un par un, puis consultez immédiatement le résultat.</p>
                </div>
                <span className={savedSlots.length ? 'tmp-status tmp-status--ready' : 'tmp-status'}>
                  {savedSlots.length ? 'Brouillon disponible' : 'À préparer'}
                </span>
              </div>

              <div className="tmp-overview__cards">
                <article><BookOpen size={20} /><span>Matières</span><strong>{subjects.length}</strong></article>
                <article><CalendarDays size={20} /><span>Créneaux placés</span><strong>{savedSlots.length}</strong></article>
                <article><Users size={20} /><span>Enseignants</span><strong>{distinctTeacherCount}</strong></article>
                <article><Eye size={20} /><span>État</span><strong>{timetableStatus === 'PUBLISHED' ? 'Publié' : 'Brouillon'}</strong></article>
              </div>

              <div className="tmp-overview__actions">
                <button type="button" className="tmp-btn-primary" onClick={function openManualCreation() { setActiveTab('build'); setBuildMode('manual') }}>
                  <Plus aria-hidden="true" size={17} /> Créer un créneau
                </button>
                <button type="button" className="tmp-btn-secondary" onClick={function openSchedule() { setActiveTab('schedule') }}>
                  <Eye aria-hidden="true" size={17} /> Voir l’emploi du temps
                </button>
              </div>
            </section>
          )}

          {activeTab === 'build' && (
            <section className="tmp-panel">
              <div className="tmp-panel__heading">
                <div>
                  <h2>Créer le brouillon</h2>
                  <p>Un seul brouillon existe à la fois pour cette classe. Choisissez comment le construire.</p>
                </div>
              </div>

              <div className="tmp-build-mode-picker" role="radiogroup" aria-label="Mode de création">
                <button
                  type="button"
                  role="radio"
                  aria-checked={buildMode === 'manual'}
                  className={buildMode === 'manual' ? 'tmp-build-mode tmp-build-mode--active' : 'tmp-build-mode'}
                  onClick={function chooseManualMode() { setBuildMode('manual') }}
                >
                  <PencilRuler aria-hidden="true" size={22} />
                  <div>
                    <strong>Création manuelle</strong>
                    <span>Ajoutez ou remplacez un créneau, un par un.</span>
                  </div>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={buildMode === 'generate'}
                  className={buildMode === 'generate' ? 'tmp-build-mode tmp-build-mode--active' : 'tmp-build-mode'}
                  onClick={function chooseGenerateMode() { setBuildMode('generate') }}
                >
                  <Sparkles aria-hidden="true" size={22} />
                  <div>
                    <strong>Génération automatique</strong>
                    <span>Proposez un planning complet à partir des volumes horaires.</span>
                  </div>
                </button>
              </div>

              {buildMode === 'manual' && (
                <form className="tmp-manual-form tmp-build-form" onSubmit={handleCreateSlot}>
                  <label className="tmp-field tmp-field--wide">
                    <span>Matière et enseignant *</span>
                    <select name="classSubjectId" value={slotForm.classSubjectId} onChange={handleSlotFieldChange} required>
                      <option value="">Sélectionner une matière</option>
                      {subjects.map(function renderSubjectOption(subject) {
                        return (
                          <option key={subject.id} value={subject.id} disabled={!subject.teacher_id}>
                            {subject.name} — {subject.teacher_name || 'aucun enseignant affecté'}
                          </option>
                        )
                      })}
                    </select>
                  </label>

                  <label className="tmp-field">
                    <span>Jour *</span>
                    <select name="dayOfWeek" value={slotForm.dayOfWeek} onChange={handleSlotFieldChange} required>
                      {Object.entries(DAY_LABELS).map(function renderDayOption([dayNumber, dayLabel]) {
                        return <option key={dayNumber} value={dayNumber}>{dayLabel}</option>
                      })}
                    </select>
                  </label>

                  <label className="tmp-field">
                    <span>Heure de début *</span>
                    <input name="startTime" type="time" value={slotForm.startTime} onChange={handleSlotFieldChange} required />
                  </label>

                  <label className="tmp-field">
                    <span>Heure de fin *</span>
                    <input name="endTime" type="time" value={slotForm.endTime} onChange={handleSlotFieldChange} required />
                  </label>

                  <label className="tmp-field">
                    <span>Salle</span>
                    <select name="roomId" value={slotForm.roomId} onChange={handleSlotFieldChange}>
                      <option value="">Aucune salle</option>
                      {rooms.map(function renderRoomOption(room) {
                        return <option key={room.id} value={room.id}>{room.name}</option>
                      })}
                    </select>
                  </label>

                  <div className="tmp-manual-form__summary">
                    <Clock3 aria-hidden="true" size={19} />
                    <div>
                      <strong>Contrôles automatiques</strong>
                      <span>Un créneau ajouté sur un horaire déjà occupé dans le brouillon le remplace ; le reste n’est pas modifié.</span>
                    </div>
                  </div>

                  <div className="tmp-manual-form__actions">
                    <button type="submit" className="tmp-btn-primary" disabled={savingSlot || classDataLoading}>
                      <Plus aria-hidden="true" size={17} /> {savingSlot ? 'Enregistrement…' : 'Ajouter le créneau'}
                    </button>
                  </div>
                </form>
              )}

              {buildMode === 'generate' && (
                configLoading ? (
                  <p className="tmp-empty">Chargement de la configuration…</p>
                ) : requirements.length === 0 ? (
                  <div className="tmp-empty-state">
                    <Sparkles aria-hidden="true" size={38} />
                    <strong>Aucune matière disponible</strong>
                    <p>Ajoutez des matières à cette classe avant de générer un emploi du temps.</p>
                  </div>
                ) : (
                  <form className="tmp-manual-form tmp-build-form" onSubmit={handleGenerateTimetable}>
                    {requirements.map(function renderRequirementField(requirement) {
                      const totalMinutes = Number(requirement.weekly_minutes) || 0
                      const hoursValue = Math.round((totalMinutes / 60) * 4) / 4
                      const wholeHours = Math.floor(totalMinutes / 60)
                      const remainingMinutes = totalMinutes % 60
                      const hoursLabel = remainingMinutes > 0
                        ? `${wholeHours} h ${remainingMinutes} min`
                        : `${wholeHours} h`
                      return (
                        <label className="tmp-field" key={requirement.class_subject_id}>
                          <span>{requirement.subject_name} — volume hebdomadaire</span>
                          <div className="tmp-field-with-suffix">
                            <input
                              type="number"
                              min="0.25"
                              max="40"
                              step="0.25"
                              value={hoursValue}
                              onChange={function updateRequirement(event) {
                                const hours = Number(event.target.value) || 0
                                handleRequirementChange(requirement.class_subject_id, Math.round(hours * 60))
                              }}
                            />
                            <span className="tmp-field-suffix">h/semaine</span>
                          </div>
                          <small className="tmp-field-hint">Soit {hoursLabel} par semaine.</small>
                        </label>
                      )
                    })}

                    <div className="tmp-manual-form__summary">
                      <Sparkles aria-hidden="true" size={19} />
                      <div>
                        <strong>Génération sans conflit</strong>
                        <span>Les enseignants déjà occupés sur un créneau, dans une autre classe, sont automatiquement évités. Remplace entièrement le brouillon existant.</span>
                      </div>
                    </div>

                    {unplacedRequirements.length > 0 && (
                      <div className="tmp-error" role="alert">
                        <p>Volume horaire incomplet, plus assez de créneaux libres cette semaine :</p>
                        <ul>
                          {unplacedRequirements.map(function renderUnplaced(item) {
                            const placedHours = (item.placed_minutes / 60).toFixed(1).replace(/\.0$/, '')
                            const requestedHours = (item.requested_minutes / 60).toFixed(1).replace(/\.0$/, '')
                            return (
                              <li key={item.class_subject_id}>
                                {item.subject_name} : {placedHours} h sur {requestedHours} h placées
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}

                    <div className="tmp-manual-form__actions">
                      <button type="submit" className="tmp-btn-primary" disabled={generating}>
                        <Sparkles aria-hidden="true" size={17} /> {generating ? 'Génération…' : 'Générer l’emploi du temps'}
                      </button>
                    </div>
                  </form>
                )
              )}

              {buildMode && (
                <div className="tmp-draft-preview">
                  <div className="tmp-panel__heading">
                    <div>
                      <h3>Aperçu du brouillon</h3>
                      <p>Le reste de l’emploi du temps courant est conservé tant que le brouillon n’est pas publié.</p>
                    </div>
                    {timetableStatus === 'DRAFT' && savedSlots.length > 0 && (
                      <button
                        type="button"
                        className="tmp-btn-primary"
                        disabled={publishing || draftConflicts.length > 0}
                        title={draftConflicts.length > 0 ? 'Résolvez les conflits ci-dessous avant de publier' : undefined}
                        onClick={handlePublishTimetable}
                      >
                        <CheckCircle2 aria-hidden="true" size={17} /> {publishing ? 'Publication…' : 'Publier comme emploi du temps courant'}
                      </button>
                    )}
                  </div>

                  {draftConflicts.length > 0 && (
                    <div className="tmp-conflict-banner" role="alert">
                      <AlertTriangle aria-hidden="true" size={20} />
                      <div>
                        <strong>Ce brouillon est en conflit avec {draftConflicts.length > 1 ? 'des classes déjà publiées' : 'une classe déjà publiée'} — probablement périmé depuis leur publication.</strong>
                        <ul>
                          {draftConflicts.map(function renderConflict(conflict, index) {
                            const dayLabel = DAY_LABELS[conflict.day_of_week]
                            return (
                              <li key={index}>
                                {conflict.subject_name} ({dayLabel} {formatTime(conflict.start_time)}-{formatTime(conflict.end_time)}) —
                                {' '}{conflict.teacher_first_name} {conflict.teacher_last_name} : {conflict.reason} par {conflict.conflicting_class_name} ({conflict.conflicting_subject_name})
                              </li>
                            )
                          })}
                        </ul>
                        <p>Régénérez le brouillon (mode automatique) ou remplacez manuellement les créneaux concernés.</p>
                      </div>
                    </div>
                  )}

                  {classDataLoading ? (
                    <p className="tmp-empty">Chargement…</p>
                  ) : savedSlots.length === 0 ? (
                    <p className="tmp-empty">Aucun créneau pour le moment.</p>
                  ) : (
                    <TimetableGrid
                      slots={savedSlots}
                      breaks={scheduleBreaks}
                      editable
                      onDeleteSlot={handleDeleteSlot}
                      deletingSlotId={deletingSlotId}
                    />
                  )}
                </div>
              )}
            </section>
          )}

          {activeTab === 'special' && (
            <section className="tmp-panel">
              <div className="tmp-panel__heading">
                <div>
                  <h2>Cours particuliers</h2>
                  <p>Cours individuels de soutien ou de rattrapage, en dehors de l’emploi du temps commun.</p>
                </div>
              </div>

              <form className="tmp-manual-form" onSubmit={handleCreateSpecialCourse}>
                <label className="tmp-field">
                  <span>Élève *</span>
                  <select name="studentId" value={specialCourseForm.studentId} onChange={handleSpecialCourseFieldChange} required>
                    <option value="">Sélectionner un élève</option>
                    {classStudents.map(function renderStudentOption(student) {
                      return (
                        <option key={student.id} value={student.id}>
                          {student.first_name} {student.last_name}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <label className="tmp-field">
                  <span>Matière *</span>
                  <select name="subjectId" value={specialCourseForm.subjectId} onChange={handleSpecialCourseFieldChange} required>
                    <option value="">Sélectionner une matière</option>
                    {subjects.map(function renderSpecialSubjectOption(subject) {
                      return <option key={subject.id} value={subject.subject_id ?? subject.id}>{subject.name}</option>
                    })}
                  </select>
                </label>

                <label className="tmp-field tmp-field--wide">
                  <span>Titre *</span>
                  <input name="title" type="text" value={specialCourseForm.title} onChange={handleSpecialCourseFieldChange} placeholder="Ex. Soutien en mathématiques" required />
                </label>

                <label className="tmp-field">
                  <span>Jour *</span>
                  <select name="dayOfWeek" value={specialCourseForm.dayOfWeek} onChange={handleSpecialCourseFieldChange} required>
                    {Object.entries(DAY_LABELS).map(function renderSpecialDayOption([dayNumber, dayLabel]) {
                      return <option key={dayNumber} value={dayNumber}>{dayLabel}</option>
                    })}
                  </select>
                </label>

                <label className="tmp-field">
                  <span>Heure de début *</span>
                  <input name="startTime" type="time" value={specialCourseForm.startTime} onChange={handleSpecialCourseFieldChange} required />
                </label>

                <label className="tmp-field">
                  <span>Heure de fin *</span>
                  <input name="endTime" type="time" value={specialCourseForm.endTime} onChange={handleSpecialCourseFieldChange} required />
                </label>

                <div className="tmp-manual-form__actions">
                  <button type="submit" className="tmp-btn-primary" disabled={savingSpecialCourse}>
                    <Plus aria-hidden="true" size={17} /> {savingSpecialCourse ? 'Enregistrement…' : 'Ajouter le cours particulier'}
                  </button>
                </div>
              </form>

              {specialCoursesLoading ? (
                <p className="tmp-empty">Chargement des cours particuliers…</p>
              ) : specialCourses.length === 0 ? (
                <div className="tmp-empty-state">
                  <Users aria-hidden="true" size={38} />
                  <strong>Aucun cours particulier</strong>
                  <p>Utilisez le formulaire ci-dessus pour en ajouter un.</p>
                </div>
              ) : (
                <div className="tmp-table-wrapper">
                  <table className="tmp-schedule-table">
                    <thead>
                      <tr>
                        <th>Élève</th>
                        <th>Titre</th>
                        <th>Jour</th>
                        <th>Horaire</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {specialCourses.map(function renderSpecialCourse(course) {
                        return (
                          <tr key={course.id}>
                            <td data-label="Élève">{course.student_first_name} {course.student_last_name}</td>
                            <td data-label="Titre">{course.title}</td>
                            <td data-label="Jour"><strong>{DAY_LABELS[course.day_of_week]}</strong></td>
                            <td data-label="Horaire">{formatTime(course.start_time)} – {formatTime(course.end_time)}</td>
                            <td className="tmp-schedule-table__action">
                              <button
                                type="button"
                                className="tmp-icon-button"
                                disabled={deletingSpecialCourseId === course.id}
                                title="Retirer ce cours particulier"
                                onClick={function deleteSelectedSpecialCourse() { handleDeleteSpecialCourse(course.id) }}
                              >
                                <Trash2 aria-hidden="true" size={16} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeTab === 'schedule' && (
            <section className="tmp-panel">
              <div className="tmp-panel__heading">
                <div>
                  <h2>Emploi du temps actuel</h2>
                  <p>Planning publié, visible des élèves et des enseignants. Pour le modifier, passez par « Créer le brouillon ».</p>
                </div>
                <button type="button" className="tmp-btn-secondary" onClick={function addAnotherSlot() { setActiveTab('build'); setBuildMode('manual') }}>
                  <Plus aria-hidden="true" size={17} /> Ajouter un créneau
                </button>
              </div>

              {classDataLoading ? (
                <p className="tmp-empty">Chargement de l’emploi du temps…</p>
              ) : publishedSlots.length === 0 ? (
                <div className="tmp-empty-state">
                  <CalendarDays aria-hidden="true" size={38} />
                  <strong>Aucun emploi du temps publié</strong>
                  <p>Utilisez la création manuelle ou la génération automatique, puis publiez le brouillon.</p>
                </div>
              ) : (
                <TimetableGrid slots={publishedSlots} breaks={scheduleBreaks} />
              )}
            </section>
          )}
        </>
      )}

      {showClassPicker && (
        <div className="tmp-dialog-backdrop" role="presentation">
          <section className="tmp-dialog" role="dialog" aria-modal="true" aria-labelledby="tmp-class-dialog-title">
            <div className="tmp-dialog__header">
              <div>
                <h2 id="tmp-class-dialog-title">Sélectionner une classe</h2>
                <p>Choisissez la classe dont vous souhaitez organiser le planning.</p>
              </div>
              <button type="button" className="tmp-dialog__close" onClick={function closeClassPicker() { setShowClassPicker(false) }} aria-label="Fermer">
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <label className="tmp-field">
              <span>Classe *</span>
              <select value={pendingClassId} onChange={function changePendingClass(event) { setPendingClassId(event.target.value) }} disabled={classesLoading}>
                <option value="">Sélectionner une classe</option>
                {classes.map(function renderClassOption(schoolClass) {
                  return (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {formatClassName(schoolClass)} — {schoolClass.school_year_name}
                    </option>
                  )
                })}
              </select>
            </label>
            <div className="tmp-dialog__actions">
              <button type="button" className="tmp-btn-secondary" onClick={function cancelClassPicker() { setShowClassPicker(false) }}>Annuler</button>
              <button type="button" className="tmp-btn-primary" disabled={!pendingClassId} onClick={confirmClassSelection}>Continuer</button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
