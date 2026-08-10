import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
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
  createTimetableSlot,
  deleteTimetableSlot,
  getClassTimetable,
  getRooms,
} from '../services/timetable_service.js'
import '../styles/timetable_management_page.css'

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
  { key: 'manual', label: 'Création manuelle', icon: PencilRuler },
  { key: 'schedule', label: 'Emploi du temps', icon: CalendarDays },
  { key: 'configuration', label: 'Configuration', icon: Settings, disabled: true },
  { key: 'special', label: 'Cours particuliers', icon: Users, disabled: true },
  { key: 'generate', label: 'Génération automatique', icon: Sparkles, disabled: true },
  { key: 'history', label: 'Historique', icon: History, disabled: true },
]

const EMPTY_SLOT_FORM = {
  classSubjectId: '',
  dayOfWeek: '1',
  startTime: '',
  endTime: '',
  roomId: '',
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

export default function TimetableManagementPage() {
  const toast = useToast()
  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [showClassPicker, setShowClassPicker] = useState(false)
  const [pendingClassId, setPendingClassId] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [subjects, setSubjects] = useState([])
  const [rooms, setRooms] = useState([])
  const [savedSlots, setSavedSlots] = useState([])
  const [classDataLoading, setClassDataLoading] = useState(false)
  const [savingSlot, setSavingSlot] = useState(false)
  const [deletingSlotId, setDeletingSlotId] = useState('')
  const [error, setError] = useState('')
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT_FORM)

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
        const [classSubjects, classTimetable, availableRooms] = await Promise.all([
          getSchoolClassSubjects(selectedClassId, { isActive: true }),
          getClassTimetable(selectedClassId),
          getRooms(),
        ])
        setSubjects(classSubjects)
        setSavedSlots([...classTimetable].sort(sortTimetableSlots))
        setRooms(availableRooms)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setClassDataLoading(false)
      }
    }

    loadSelectedClass()
  }, [selectedClassId])

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
    const classTimetable = await getClassTimetable(selectedClassId)
    setSavedSlots([...classTimetable].sort(sortTimetableSlots))
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
      setActiveTab('schedule')
      toast.success('Le créneau a été ajouté au brouillon de l’emploi du temps.')
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
                <button type="button" className="tmp-btn-primary" onClick={function openManualCreation() { setActiveTab('manual') }}>
                  <Plus aria-hidden="true" size={17} /> Créer un créneau
                </button>
                <button type="button" className="tmp-btn-secondary" onClick={function openSchedule() { setActiveTab('schedule') }}>
                  <Eye aria-hidden="true" size={17} /> Voir l’emploi du temps
                </button>
              </div>
            </section>
          )}

          {activeTab === 'manual' && (
            <section className="tmp-panel">
              <div className="tmp-panel__heading">
                <div>
                  <h2>Création manuelle</h2>
                  <p>Ajoutez un cours au brouillon de la classe sélectionnée.</p>
                </div>
              </div>

              <form className="tmp-manual-form" onSubmit={handleCreateSlot}>
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
                    <span>Les conflits de classe, d’enseignant et de salle sont vérifiés avant l’enregistrement.</span>
                  </div>
                </div>

                <div className="tmp-manual-form__actions">
                  <button type="button" className="tmp-btn-secondary" onClick={function cancelManualCreation() { setActiveTab('overview') }}>Annuler</button>
                  <button type="submit" className="tmp-btn-primary" disabled={savingSlot || classDataLoading}>
                    <Plus aria-hidden="true" size={17} /> {savingSlot ? 'Enregistrement…' : 'Ajouter le créneau'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === 'schedule' && (
            <section className="tmp-panel">
              <div className="tmp-panel__heading">
                <div>
                  <h2>Emploi du temps actuel</h2>
                  <p>Créneaux du {timetableStatus === 'PUBLISHED' ? 'planning publié' : 'brouillon en cours'}.</p>
                </div>
                <button type="button" className="tmp-btn-primary" onClick={function addAnotherSlot() { setActiveTab('manual') }}>
                  <Plus aria-hidden="true" size={17} /> Ajouter un créneau
                </button>
              </div>

              {classDataLoading ? (
                <p className="tmp-empty">Chargement de l’emploi du temps…</p>
              ) : savedSlots.length === 0 ? (
                <div className="tmp-empty-state">
                  <CalendarDays aria-hidden="true" size={38} />
                  <strong>Aucun créneau enregistré</strong>
                  <p>Utilisez la création manuelle pour construire le premier brouillon.</p>
                </div>
              ) : (
                <div className="tmp-table-wrapper">
                  <table className="tmp-schedule-table">
                    <thead>
                      <tr>
                        <th>Jour</th>
                        <th>Horaire</th>
                        <th>Matière</th>
                        <th>Enseignant</th>
                        <th>Salle</th>
                        <th>État</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {savedSlots.map(function renderSlot(slot) {
                        const canDelete = slot.status === 'DRAFT'
                        return (
                          <tr key={slot.id}>
                            <td data-label="Jour"><strong>{DAY_LABELS[slot.day_of_week]}</strong></td>
                            <td data-label="Horaire">{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</td>
                            <td data-label="Matière"><BookOpen size={15} /> {slot.subject_name}</td>
                            <td data-label="Enseignant">{slot.teacher_name}</td>
                            <td data-label="Salle"><MapPin size={14} /> {slot.room_name || '—'}</td>
                            <td data-label="État"><span className="tmp-status tmp-status--ready">{slot.status === 'PUBLISHED' ? 'Publié' : 'Brouillon'}</span></td>
                            <td className="tmp-schedule-table__action">
                              <button
                                type="button"
                                className="tmp-icon-button"
                                disabled={!canDelete || deletingSlotId === slot.id}
                                title={canDelete ? 'Retirer ce créneau' : 'Un planning publié ne peut pas être modifié ici'}
                                onClick={function deleteSelectedSlot() { handleDeleteSlot(slot.id) }}
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
