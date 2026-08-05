import { Fragment, useEffect, useState } from 'react'
import { CalendarDays, ClipboardList, Sparkles, UserCog, Trash2, Plus, School } from 'lucide-react'

import { getSchoolClassesOverview, getSchoolClassSubjects } from '../services/school_classes_overview_service.js'
import { listStudents } from '../services/students_service.js'
import {
  getClassTimetable,
  createTimetableSlot,
  clearClassTimetable,
  getClassSpecialCourses,
  createSpecialCourse,
  deleteSpecialCourse,
  getTeacherBusySlots,
} from '../services/timetable_service.js'
import { generateWeeklyTimetable, DEFAULT_DAYS, getRegularPeriodsForStage, getDayScheduleForStage } from '../utils/timetable_generator.js'
import { formatProfileName } from '../utils/profileDisplay.js'
import '../styles/timetable_management_page.css'

// Page centralisant toute la gestion de l'emploi du temps : c'est ici (et pas
// dans les détails d'une classe) que doivent vivre les futures modifications
// - saisie des heures/semaine, génération, cours particuliers.
// Les cours réguliers sont enregistrés en base (timetable_slots) ; les cours
// particuliers restent une maquette locale, la table ne portant pas encore
// de notion de créneau propre à un seul élève.

const TABS = [
  { key: 'schedule', label: 'Emploi du temps', icon: CalendarDays },
  { key: 'generate', label: 'Générer', icon: Sparkles },
  { key: 'special', label: 'Cours particuliers', icon: UserCog },
]

const STAGE_LABELS = {
  PRESCHOOL: 'Maternelle',
  PRIMARY: 'Primaire',
  MIDDLE_SCHOOL: 'Collège',
  HIGH_SCHOOL: 'Lycée',
}

function timeLabel(value) {
  return value?.slice(0, 5) ?? value
}

function isPrimaryStage(stage) {
  return stage === 'PRESCHOOL' || stage === 'PRIMARY'
}

export default function TimetableManagementPage() {
  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedClassId, setSelectedClassId] = useState('')
  const [activeTab, setActiveTab] = useState('schedule')
  const [subjects, setSubjects] = useState([])
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [weeklyHoursBySubjectId, setWeeklyHoursBySubjectId] = useState({})
  const [generatedTimetable, setGeneratedTimetable] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [savedSlots, setSavedSlots] = useState([])
  const [savedSlotsLoading, setSavedSlotsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)

  const [students, setStudents] = useState([])
  const [specialCourses, setSpecialCourses] = useState([])
  const [specialCoursesLoading, setSpecialCoursesLoading] = useState(false)
  const [addingSpecialCourse, setAddingSpecialCourse] = useState(false)
  const [specialCourseForm, setSpecialCourseForm] = useState({
    studentId: '',
    subjectId: '',
    day: 1,
    startTime: '17:30',
    endTime: '18:30',
    note: '',
  })

  useEffect(function loadClassesEffect() {
    async function load() {
      try {
        const data = await getSchoolClassesOverview({ status: 'ACTIVE' })
        setClasses(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setClassesLoading(false)
      }
    }
    load()
  }, [])

  useEffect(function loadClassDataEffect() {
    if (!selectedClassId) {
      setSubjects([])
      setStudents([])
      setGeneratedTimetable(null)
      setSavedSlots([])
      setSpecialCourses([])
      return
    }
    setActiveTab('schedule')
    setSubjectsLoading(true)
    setSavedSlotsLoading(true)
    setSpecialCoursesLoading(true)
    setWeeklyHoursBySubjectId({})
    setGeneratedTimetable(null)
    async function load() {
      try {
        const [subjectData, studentData, timetableData, specialCourseData] = await Promise.all([
          getSchoolClassSubjects(selectedClassId),
          listStudents({ class_id: selectedClassId, limit: 100 }),
          getClassTimetable(selectedClassId),
          getClassSpecialCourses(selectedClassId),
        ])
        setSubjects(subjectData)
        setStudents(Array.isArray(studentData) ? studentData : studentData.items ?? [])
        setSavedSlots(timetableData)
        setSpecialCourses(specialCourseData)
      } catch (e) {
        setError(e.message)
      } finally {
        setSubjectsLoading(false)
        setSavedSlotsLoading(false)
        setSpecialCoursesLoading(false)
      }
    }
    load()
  }, [selectedClassId])

  function handleHoursChange(subjectId, value) {
    const hours = parseFloat(value)
    setWeeklyHoursBySubjectId((current) => ({
      ...current,
      [subjectId]: Number.isFinite(hours) && hours > 0 ? hours : undefined,
    }))
  }

  const selectedClass = classes.find((schoolClass) => schoolClass.id === selectedClassId)
  const regularPeriods = getRegularPeriodsForStage(selectedClass?.education_stage)
  const daySchedule = getDayScheduleForStage(selectedClass?.education_stage)

  async function handleGenerate() {
    const subjectHours = subjects
      .filter((subject) => weeklyHoursBySubjectId[subject.id] > 0)
      .map((subject) => ({
        subjectId: subject.id,
        subjectName: subject.name,
        hours: weeklyHoursBySubjectId[subject.id],
        teacherId: subject.teacher_id,
      }))

    if (subjectHours.length === 0) {
      setError('Renseignez au moins une matière avec des heures/semaine avant de générer un aperçu.')
      return
    }
    setError('')
    setGenerating(true)
    try {
      // Un enseignant peut être partagé entre plusieurs classes : on récupère
      // ses créneaux déjà pris ailleurs pour que le générateur les évite,
      // au lieu de simplement échouer à l'enregistrement.
      const busySlotsRaw = await getTeacherBusySlots(selectedClassId)
      const busySlotsByTeacherId = new Map()
      for (const slot of busySlotsRaw) {
        const list = busySlotsByTeacherId.get(slot.teacher_id) ?? []
        list.push({ day_of_week: slot.day_of_week, start: timeLabel(slot.start_time), end: timeLabel(slot.end_time) })
        busySlotsByTeacherId.set(slot.teacher_id, list)
      }
      setGeneratedTimetable(
        generateWeeklyTimetable(subjectHours, { periods: regularPeriods, busySlotsByTeacherId })
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSaveGeneratedTimetable() {
    if (!generatedTimetable) return
    setSaving(true)
    setError('')
    try {
      await clearClassTimetable(selectedClassId)
      for (const [dayIndex, day] of DEFAULT_DAYS.entries()) {
        for (const [periodIndex, period] of generatedTimetable.periods.entries()) {
          const classSubjectId = generatedTimetable.grid[day][periodIndex]
          if (!classSubjectId) continue
          await createTimetableSlot(selectedClassId, {
            class_subject_id: classSubjectId,
            day_of_week: dayIndex + 1,
            start_time: period.start,
            end_time: period.end,
          })
        }
      }
      const refreshed = await getClassTimetable(selectedClassId)
      setSavedSlots(refreshed)
      setGeneratedTimetable(null)
      setActiveTab('schedule')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleClearTimetable() {
    setClearing(true)
    setError('')
    try {
      await clearClassTimetable(selectedClassId)
      setSavedSlots([])
    } catch (e) {
      setError(e.message)
    } finally {
      setClearing(false)
    }
  }

  async function handleAddSpecialCourse(event) {
    event.preventDefault()
    if (!specialCourseForm.studentId || !specialCourseForm.subjectId) {
      setError('Choisissez un élève et une matière pour le cours particulier.')
      return
    }
    if (specialCourseForm.endTime <= specialCourseForm.startTime) {
      setError('L\'heure de fin doit être après l\'heure de début.')
      return
    }
    if (specialCourseForm.startTime < '17:30' || specialCourseForm.endTime > '19:00') {
      setError('Un cours particulier ne peut avoir lieu qu\'entre 17h30 et 19h00 (les cours réguliers occupent déjà 8h-17h30).')
      return
    }
    setAddingSpecialCourse(true)
    setError('')
    try {
      await createSpecialCourse(selectedClassId, {
        student_id: specialCourseForm.studentId,
        subject_id: specialCourseForm.subjectId,
        day_of_week: Number(specialCourseForm.day),
        start_time: specialCourseForm.startTime,
        end_time: specialCourseForm.endTime,
        note: specialCourseForm.note.trim() || null,
      })
      const refreshed = await getClassSpecialCourses(selectedClassId)
      setSpecialCourses(refreshed)
      setSpecialCourseForm((current) => ({ ...current, subjectId: '', note: '' }))
    } catch (e) {
      setError(e.message)
    } finally {
      setAddingSpecialCourse(false)
    }
  }

  async function handleRemoveSpecialCourse(specialCourseId) {
    setError('')
    try {
      await deleteSpecialCourse(specialCourseId)
      setSpecialCourses((current) => current.filter((course) => course.id !== specialCourseId))
    } catch (e) {
      setError(e.message)
    }
  }

  const savedSlotsByDayAndTime = new Map(
    savedSlots.map((slot) => [`${slot.day_of_week}-${timeLabel(slot.start_time)}`, slot])
  )

  const distinctTeacherCount = new Set(savedSlots.map((slot) => slot.teacher_name)).size
  const breakLabel = isPrimaryStage(selectedClass?.education_stage) ? '9h30-9h50' : '9h50-10h10'

  function renderScheduleGrid(slotsByDayAndTime, periods) {
    return (
      <div className="tmp-grid-wrapper">
        <div className="tmp-grid" style={{ gridTemplateColumns: `64px repeat(${DEFAULT_DAYS.length}, minmax(120px, 1fr))` }}>
          <div className="tmp-grid__corner" />
          {DEFAULT_DAYS.map((day) => (
            <div key={day} className="tmp-grid__day-head">{day}</div>
          ))}
          {periods.map((entry) => (
            entry.type === 'break' ? (
              <div key={`break-${entry.start}`} className="tmp-break-row">
                {entry.label} ({entry.start}-{entry.end})
              </div>
            ) : (
              <Fragment key={`time-${entry.start}`}>
                <div className="tmp-grid__time">
                  <strong>{entry.start}</strong>
                  <span>{entry.end}</span>
                </div>
                {DEFAULT_DAYS.map((day, dayIndex) => {
                  const slot = slotsByDayAndTime.get(`${dayIndex + 1}-${entry.start}`)
                  return (
                    <div key={`${day}-${entry.start}`} className={slot ? 'tmp-cell' : 'tmp-cell tmp-cell--free'}>
                      {slot ? (
                        <>
                          <span className="tmp-cell__title">{slot.subject_name}</span>
                          <span className="tmp-cell__meta">{slot.teacher_name}{slot.room_name ? ` · ${slot.room_name}` : ''}</span>
                        </>
                      ) : 'Libre'}
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

  return (
    <main className="tmp-main">
      <nav className="tmp-breadcrumb">
        <span>Accueil</span> <span>›</span> <span>Emploi du temps</span>
      </nav>
      <h1 className="tmp-page-title"><CalendarDays aria-hidden="true" size={22} /> Emploi du temps</h1>

      {error && <p className="tmp-error">{error}</p>}

      <section className="tmp-class-picker">
        <label className="tmp-class-select">
          <span>Classe</span>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            disabled={classesLoading}
          >
            <option value="">Sélectionner une classe…</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.level_name} {schoolClass.group_label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {selectedClassId && (
        <>
          <div className="tmp-header-card">
            <span className="tmp-header-card__icon"><School aria-hidden="true" size={26} /></span>
            <div className="tmp-header-card__info">
              <div className="tmp-header-card__title-row">
                <h2>{selectedClass?.level_name} {selectedClass?.group_label}</h2>
                <span className="tmp-badge">{STAGE_LABELS[selectedClass?.education_stage] ?? selectedClass?.education_stage}</span>
              </div>
              <div className="tmp-header-card__facts">
                <div><span>Récréation</span><strong>{breakLabel}</strong></div>
                <div><span>Pause déjeuner</span><strong>12h00-13h30</strong></div>
                <div><span>Cours réguliers</span><strong>8h00-17h30</strong></div>
                <div><span>Cours particuliers</span><strong>17h30-19h00</strong></div>
              </div>
            </div>
          </div>

          <div className="tmp-layout">
            <div className="tmp-main-col">
              <div className="tmp-tabs">
                {TABS.map((tab) => {
                  const TabIcon = tab.icon
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      className={activeTab === tab.key ? 'tmp-tab tmp-tab--active' : 'tmp-tab'}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      <TabIcon aria-hidden="true" size={16} /> {tab.label}
                    </button>
                  )
                })}
              </div>

              <div className="tmp-tab-panel">
                {activeTab === 'schedule' && (
                  savedSlotsLoading ? (
                    <p className="tmp-empty">Chargement…</p>
                  ) : savedSlots.length === 0 ? (
                    <p className="tmp-empty">Aucun créneau enregistré pour cette classe. Générez-en un depuis l'onglet « Générer ».</p>
                  ) : (
                    renderScheduleGrid(savedSlotsByDayAndTime, daySchedule)
                  )
                )}

                {activeTab === 'generate' && (
                  <>
                    <h3>Heures/semaine par matière</h3>
                    {subjectsLoading ? (
                      <p className="tmp-empty">Chargement des matières…</p>
                    ) : (
                      <div className="tmp-hours-grid">
                        {subjects.map((subject) => (
                          <label key={subject.id} className="tmp-hours-item">
                            <span>{subject.name}</span>
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={weeklyHoursBySubjectId[subject.id] ?? ''}
                              onChange={(e) => handleHoursChange(subject.id, e.target.value)}
                            />
                          </label>
                        ))}
                        {subjects.length === 0 && <p className="tmp-empty">Aucune matière rattachée à cette classe.</p>}
                      </div>
                    )}

                    <button type="button" className="tmp-btn-primary" disabled={generating} onClick={handleGenerate}>
                      {generating ? 'Génération…' : "Générer un aperçu d'emploi du temps"}
                    </button>

                    {generatedTimetable && (
                      <div className="tmp-generated-preview">
                        {generatedTimetable.warnings.map((warning) => (
                          <p key={warning} className="tmp-warning">{warning}</p>
                        ))}
                        {renderScheduleGrid(
                          (() => {
                            const map = new Map()
                            DEFAULT_DAYS.forEach((day, dayIndex) => {
                              generatedTimetable.periods.forEach((period, periodIndex) => {
                                const classSubjectId = generatedTimetable.grid[day][periodIndex]
                                if (!classSubjectId) return
                                const subject = subjects.find((s) => s.id === classSubjectId)
                                map.set(`${dayIndex + 1}-${period.start}`, {
                                  subject_name: subject?.name ?? '—',
                                  teacher_name: subject?.teacher_name ?? '',
                                  room_name: null,
                                })
                              })
                            })
                            return map
                          })(),
                          daySchedule
                        )}
                        {generatedTimetable.unplacedHoursBySubject.length > 0 && (
                          <p className="tmp-warning">
                            Heures non placées : {generatedTimetable.unplacedHoursBySubject
                              .map((entry) => `${entry.subjectName} (${entry.hours}h)`)
                              .join(', ')}
                          </p>
                        )}
                        <button type="button" className="tmp-btn-primary" disabled={saving} onClick={handleSaveGeneratedTimetable}>
                          {saving ? 'Enregistrement…' : "Enregistrer (remplace l'emploi du temps actuel)"}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'special' && (
                  <>
                    <p className="tmp-section-hint">
                      Ajoutez un cours en dehors du planning commun pour un élève précis de cette classe, uniquement
                      entre 17h30 et 19h00 (les cours réguliers occupent déjà 8h-17h30).
                    </p>

                    <form className="tmp-special-form" onSubmit={handleAddSpecialCourse}>
                      <label>
                        <span>Élève</span>
                        <select
                          value={specialCourseForm.studentId}
                          onChange={(e) => setSpecialCourseForm((c) => ({ ...c, studentId: e.target.value }))}
                        >
                          <option value="">Sélectionner…</option>
                          {students.map((student) => (
                            <option key={student.id} value={student.id}>
                              {formatProfileName(student.first_name, student.last_name, student.gender)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Matière</span>
                        <select
                          value={specialCourseForm.subjectId}
                          onChange={(e) => setSpecialCourseForm((c) => ({ ...c, subjectId: e.target.value }))}
                        >
                          <option value="">Sélectionner…</option>
                          {subjects.map((subject) => (
                            <option key={subject.subject_id} value={subject.subject_id}>{subject.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Jour</span>
                        <select
                          value={specialCourseForm.day}
                          onChange={(e) => setSpecialCourseForm((c) => ({ ...c, day: e.target.value }))}
                        >
                          {DEFAULT_DAYS.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Début</span>
                        <input
                          type="time"
                          min="17:30"
                          max="19:00"
                          value={specialCourseForm.startTime}
                          onChange={(e) => setSpecialCourseForm((c) => ({ ...c, startTime: e.target.value }))}
                        />
                      </label>
                      <label>
                        <span>Fin</span>
                        <input
                          type="time"
                          min="17:30"
                          max="19:00"
                          value={specialCourseForm.endTime}
                          onChange={(e) => setSpecialCourseForm((c) => ({ ...c, endTime: e.target.value }))}
                        />
                      </label>
                      <label className="tmp-special-note">
                        <span>Note (optionnel)</span>
                        <input
                          type="text"
                          value={specialCourseForm.note}
                          onChange={(e) => setSpecialCourseForm((c) => ({ ...c, note: e.target.value }))}
                          placeholder="Ex. Salle 3, rattrapage"
                        />
                      </label>
                      <button type="submit" className="tmp-btn-primary tmp-special-submit" disabled={addingSpecialCourse}>
                        <Plus aria-hidden="true" size={16} /> {addingSpecialCourse ? 'Ajout…' : 'Ajouter'}
                      </button>
                    </form>

                    <ul className="tmp-special-list">
                      {specialCoursesLoading ? (
                        <li className="tmp-empty">Chargement…</li>
                      ) : specialCourses.length === 0 ? (
                        <li className="tmp-empty">Aucun cours particulier pour cette classe.</li>
                      ) : (
                        specialCourses.map((course) => (
                          <li key={course.id} className="tmp-special-item">
                            <div>
                              <strong>{course.subject_name}</strong>
                              <span>
                                {course.student_first_name} {course.student_last_name} · {DEFAULT_DAYS[course.day_of_week - 1]}{' '}
                                {timeLabel(course.start_time)}–{timeLabel(course.end_time)}
                              </span>
                              {course.note && <span className="tmp-special-note-text">{course.note}</span>}
                            </div>
                            <button
                              type="button"
                              className="tmp-btn-icon"
                              title="Retirer ce cours particulier"
                              onClick={() => handleRemoveSpecialCourse(course.id)}
                            >
                              <Trash2 aria-hidden="true" size={16} />
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <aside className="tmp-side-col">
              <div className="tmp-summary-card">
                <h3><ClipboardList aria-hidden="true" size={16} /> Résumé</h3>
                <div className="tmp-summary-row"><span>Élèves inscrits</span><strong>{students.length}</strong></div>
                <div className="tmp-summary-row"><span>Créneaux réguliers</span><strong>{savedSlots.length}</strong></div>
                <div className="tmp-summary-row"><span>Enseignants distincts</span><strong>{distinctTeacherCount}</strong></div>
                <div className="tmp-summary-row"><span>Cours particuliers</span><strong>{specialCourses.length}</strong></div>
              </div>

              <div className="tmp-summary-card">
                <h3>Actions rapides</h3>
                <button type="button" className="tmp-quick-action" onClick={() => setActiveTab('generate')}>
                  <Sparkles aria-hidden="true" size={16} /> Générer / régénérer
                </button>
                <button
                  type="button"
                  className="tmp-quick-action tmp-quick-action--danger"
                  disabled={clearing || savedSlots.length === 0}
                  onClick={handleClearTimetable}
                >
                  <Trash2 aria-hidden="true" size={16} /> {clearing ? 'Suppression…' : "Vider l'emploi du temps"}
                </button>
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  )
}
