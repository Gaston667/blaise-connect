import { Fragment, useEffect, useState } from 'react'
import { CalendarDays, ClipboardList, Sparkles, UserCog, Trash2, Plus, School, Settings, History, Clock3, LayoutDashboard } from 'lucide-react'

import { getSchoolClassesOverview, getSchoolClassSubjects } from '../services/school_classes_overview_service.js'
import { listStudents } from '../services/students_service.js'
import {
  getClassTimetable,
  clearClassTimetable,
  getClassSpecialCourses,
  createSpecialCourse,
  deleteSpecialCourse,
  getTimetableConfiguration,
  generateTimetable,
  validateTimetable,
  getSchoolDaySchedules,
  saveSchoolDaySchedule,
  createBreakSchedule,
  deleteBreakSchedule,
} from '../services/timetable_service.js'
import { formatProfileName } from '../utils/profileDisplay.js'
import '../styles/timetable_management_page.css'

// Les horaires, pauses, volumes et brouillons sont fournis par l'API.
// Aucun horaire scolaire n'est défini en dur dans cette page.

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const TABS = [
  { key: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { key: 'configuration', label: 'Configuration', icon: Settings },
  { key: 'special', label: 'Cours spéciaux & particuliers', icon: UserCog },
  { key: 'generate', label: 'Génération', icon: Sparkles },
  { key: 'schedule', label: 'Emplois du temps', icon: CalendarDays },
  { key: 'history', label: 'Historique', icon: History },
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

function timeToMinutes(value) {
  const [hours, minutes] = timeLabel(value).split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

/** Transforme la configuration d'une journée en lignes de grille affichables. */
function buildDaySchedule(daySchedule) {
  const entries = []
  const breaks = [...(daySchedule.breaks ?? [])].sort((first, second) =>
    timeLabel(first.start_time).localeCompare(timeLabel(second.start_time)),
  )
  const duration = daySchedule.lesson_duration_minutes
  let cursor = timeToMinutes(daySchedule.course_start_time)

  function appendCoursePeriods(end) {
    while (cursor < end) {
      const periodEnd = Math.min(cursor + duration, end)
      entries.push({ type: 'period', start: minutesToTime(cursor), end: minutesToTime(periodEnd) })
      cursor = periodEnd
    }
  }

  for (const schoolBreak of breaks) {
    const breakStart = timeToMinutes(schoolBreak.start_time)
    const breakEnd = timeLabel(schoolBreak.end_time)
    appendCoursePeriods(breakStart)
    entries.push({ type: 'break', label: schoolBreak.label, start: minutesToTime(breakStart), end: breakEnd })
    cursor = timeToMinutes(breakEnd)
  }

  appendCoursePeriods(timeToMinutes(daySchedule.course_end_time))
  return entries
}

export default function TimetableManagementPage() {
  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedClassId, setSelectedClassId] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [subjects, setSubjects] = useState([])
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [weeklyMinutesBySubjectId, setWeeklyMinutesBySubjectId] = useState({})
  const [configuration, setConfiguration] = useState(null)
  const [yearSchedules, setYearSchedules] = useState([])
  const [configurationStage, setConfigurationStage] = useState('HIGH_SCHOOL')
  const [configurationDay, setConfigurationDay] = useState(1)
  const [configurationSaving, setConfigurationSaving] = useState(false)
  const [generatedTimetable, setGeneratedTimetable] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [savedSlots, setSavedSlots] = useState([])
  const [savedSlotsLoading, setSavedSlotsLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [clearing, setClearing] = useState(false)

  const [students, setStudents] = useState([])
  const [specialCourses, setSpecialCourses] = useState([])
  const [specialCoursesLoading, setSpecialCoursesLoading] = useState(false)
  const [addingSpecialCourse, setAddingSpecialCourse] = useState(false)
  const [specialCourseForm, setSpecialCourseForm] = useState({
    studentId: '',
    subjectId: '',
    title: '',
    day: 1,
    startTime: '',
    endTime: '',
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
      setConfiguration(null)
      setStudents([])
      setGeneratedTimetable(null)
      setSavedSlots([])
      setSpecialCourses([])
      return
    }
    setActiveTab('overview')
    setSubjectsLoading(true)
    setSavedSlotsLoading(true)
    setSpecialCoursesLoading(true)
    setWeeklyMinutesBySubjectId({})
    setGeneratedTimetable(null)
    async function load() {
      try {
        const [subjectData, studentData, timetableData, specialCourseData, configurationData] = await Promise.all([
          getSchoolClassSubjects(selectedClassId),
          listStudents({ class_id: selectedClassId, limit: 100 }),
          getClassTimetable(selectedClassId),
          getClassSpecialCourses(selectedClassId),
          getTimetableConfiguration(selectedClassId),
        ])
        setSubjects(subjectData)
        setStudents(Array.isArray(studentData) ? studentData : studentData.items ?? [])
        setSavedSlots(timetableData)
        setSpecialCourses(specialCourseData)
        setConfiguration(configurationData)
        setYearSchedules(configurationData.days ?? [])
        setWeeklyMinutesBySubjectId(
          Object.fromEntries(configurationData.requirements.map((requirement) => [
            requirement.class_subject_id,
            requirement.weekly_minutes,
          ])),
        )
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

  function getStageSchedule(stage, day = configurationDay) {
    return yearSchedules.find((schedule) => schedule.education_stage === stage && schedule.day_of_week === day)
  }

  async function handleSaveConfiguration(event) {
    event.preventDefault()
    if (!selectedClass?.school_year_id) return
    const formData = new FormData(event.currentTarget)
    setConfigurationSaving(true)
    setError('')
    try {
      await saveSchoolDaySchedule(selectedClass.school_year_id, {
        education_stage: configurationStage,
        day_of_week: configurationDay,
        course_start_time: formData.get('course_start_time'),
        course_end_time: formData.get('course_end_time'),
        lesson_duration_minutes: Number(formData.get('lesson_duration_minutes')),
      })
      const refreshed = await getSchoolDaySchedules(selectedClass.school_year_id)
      setYearSchedules(refreshed)
      setConfiguration((current) => ({ ...current, days: refreshed }))
    } catch (e) {
      setError(e.message)
    } finally {
      setConfigurationSaving(false)
    }
  }

  async function refreshYearSchedules() {
    const refreshed = await getSchoolDaySchedules(selectedClass.school_year_id)
    setYearSchedules(refreshed)
    setConfiguration((current) => ({ ...current, days: refreshed }))
  }

  async function handleAddBreak(event) {
    event.preventDefault()
    if (!selectedStageSchedule?.id) {
      setError("Enregistrez d'abord les horaires de ce cycle et de ce jour.")
      return
    }
    const formData = new FormData(event.currentTarget.form)
    setError('')
    try {
      await createBreakSchedule({
        school_day_schedule_id: selectedStageSchedule.id,
        label: formData.get('break_label'),
        start_time: formData.get('break_start_time'),
        end_time: formData.get('break_end_time'),
      })
      await refreshYearSchedules()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDeleteBreak(breakId) {
    setError('')
    try {
      await deleteBreakSchedule(breakId)
      await refreshYearSchedules()
    } catch (e) {
      setError(e.message)
    }
  }

  function handleMinutesChange(subjectId, value) {
    const minutes = Number(value)
    setWeeklyMinutesBySubjectId((current) => ({
      ...current,
      [subjectId]: Number.isInteger(minutes) && minutes > 0 ? minutes : undefined,
    }))
  }

  const selectedClass = classes.find((schoolClass) => schoolClass.id === selectedClassId)
  const configuredDays = configuration?.days ?? []
  const configuredDayNumbers = [...new Set(configuredDays.map((day) => day.day_of_week))].sort((a, b) => a - b)
  const gridDays = configuredDayNumbers.length > 0 ? configuredDayNumbers : [1, 2, 3, 4, 5]
  const daySchedule = configuredDays.length > 0
    ? buildDaySchedule(configuredDays[0])
    : []

  async function handleGenerate() {
    const requirements = subjects
      .filter((subject) => weeklyMinutesBySubjectId[subject.id] > 0)
      .map((subject) => ({
        class_subject_id: subject.id,
        weekly_minutes: weeklyMinutesBySubjectId[subject.id],
      }))

    if (requirements.length === 0) {
      setError('Renseignez au moins une matière avec un volume hebdomadaire avant de générer.')
      return
    }
    setError('')
    setGenerating(true)
    try {
      const proposal = await generateTimetable(selectedClassId, requirements)
      setGeneratedTimetable(proposal)
      setSavedSlots(await getClassTimetable(selectedClassId))
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleValidateGeneratedTimetable() {
    if (!generatedTimetable) return
    setValidating(true)
    setError('')
    try {
      await validateTimetable(selectedClassId)
      const refreshed = await getClassTimetable(selectedClassId)
      setSavedSlots(refreshed)
      setGeneratedTimetable(null)
      setActiveTab('schedule')
    } catch (e) {
      setError(e.message)
    } finally {
      setValidating(false)
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
    if (!specialCourseForm.studentId || !specialCourseForm.subjectId || !specialCourseForm.title.trim()) {
      setError('Choisissez un élève, une matière et saisissez un intitulé.')
      return
    }
    if (specialCourseForm.endTime <= specialCourseForm.startTime) {
      setError('L\'heure de fin doit être après l\'heure de début.')
      return
    }
    setAddingSpecialCourse(true)
    setError('')
    try {
      await createSpecialCourse(selectedClassId, {
        student_id: specialCourseForm.studentId,
        subject_id: specialCourseForm.subjectId,
        title: specialCourseForm.title.trim(),
        day_of_week: Number(specialCourseForm.day),
        start_time: specialCourseForm.startTime,
        end_time: specialCourseForm.endTime,
        note: specialCourseForm.note.trim() || null,
      })
      const refreshed = await getClassSpecialCourses(selectedClassId)
      setSpecialCourses(refreshed)
      setSpecialCourseForm((current) => ({ ...current, subjectId: '', title: '', note: '' }))
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
  const firstDay = configuredDays[0]
  const selectedStageSchedule = getStageSchedule(configurationStage)

  function renderScheduleGrid(slotsByDayAndTime, periods) {
    return (
      <div className="tmp-grid-wrapper">
        <div className="tmp-grid" style={{ gridTemplateColumns: `64px repeat(${gridDays.length}, minmax(120px, 1fr))` }}>
          <div className="tmp-grid__corner" />
          {gridDays.map((dayNumber) => (
            <div key={dayNumber} className="tmp-grid__day-head">{DAY_LABELS[dayNumber - 1]}</div>
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
                {gridDays.map((dayNumber) => {
                  const slot = slotsByDayAndTime.get(`${dayNumber}-${entry.start}`)
                  return (
                    <div key={`${dayNumber}-${entry.start}`} className={slot ? 'tmp-cell' : 'tmp-cell tmp-cell--free'}>
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

      {!selectedClassId && (
        <section className="tmp-landing">
          <div>
            <h2>Organisez les emplois du temps de l'établissement</h2>
            <p>Choisissez une classe pour consulter son planning, configurer les horaires de son cycle ou créer une proposition.</p>
          </div>
          <div className="tmp-landing__stats">
            <span><strong>{classes.length}</strong> classes actives</span>
            <span><strong>4</strong> cycles configurables</span>
            <span><strong>5</strong> étapes de gestion</span>
          </div>
        </section>
      )}

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
                <div><span>Début des cours</span><strong>{timeLabel(firstDay?.course_start_time) || 'Non configuré'}</strong></div>
                <div><span>Fin des cours</span><strong>{timeLabel(firstDay?.course_end_time) || 'Non configuré'}</strong></div>
                <div><span>Durée d'un cours</span><strong>{firstDay ? `${firstDay.lesson_duration_minutes} min` : 'Non configuré'}</strong></div>
                <div><span>Pauses</span><strong>{firstDay?.breaks?.length ?? 0}</strong></div>
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
                {activeTab === 'overview' && (
                  <section className="tmp-overview">
                    <h3>Vue d'ensemble</h3>
                    <p className="tmp-section-hint">Le planning de cette classe est préparé en brouillon, puis validé par l'administration.</p>
                    <div className="tmp-overview__cards">
                      <div><span>État</span><strong>{savedSlots.length ? 'Planning disponible' : 'À configurer'}</strong></div>
                      <div><span>Matières</span><strong>{subjects.length}</strong></div>
                      <div><span>Élèves inscrits</span><strong>{students.length}</strong></div>
                      <div><span>Créneaux</span><strong>{savedSlots.length}</strong></div>
                    </div>
                    <div className="tmp-overview__actions">
                      <button type="button" className="tmp-btn-primary" onClick={() => setActiveTab('configuration')}>Configurer les horaires</button>
                      <button type="button" className="tmp-btn-secondary" onClick={() => setActiveTab('generate')}>Préparer le planning</button>
                    </div>
                  </section>
                )}
                {activeTab === 'configuration' && (
                  <form className="tmp-config" onSubmit={handleSaveConfiguration}>
                    <h3>Configuration</h3>
                    <p className="tmp-section-hint">Les horaires s'appliquent à toutes les classes du cycle pour l'année sélectionnée.</p>
                    <label className="tmp-config__stage">Niveau
                      <select value={configurationStage} onChange={(event) => setConfigurationStage(event.target.value)}>
                        {Object.entries(STAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label className="tmp-config__stage">Jour
                      <select value={configurationDay} onChange={(event) => setConfigurationDay(Number(event.target.value))}>
                        {DAY_LABELS.slice(0, 5).map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                      </select>
                    </label>
                    <section className="tmp-config__card">
                      <h4><Clock3 size={16} aria-hidden="true" /> Horaires généraux</h4>
                      <div className="tmp-config__fields">
                        <label>Heure de début<input name="course_start_time" type="time" defaultValue={timeLabel(selectedStageSchedule?.course_start_time) ?? ''} required /></label>
                        <label>Heure de fin<input name="course_end_time" type="time" defaultValue={timeLabel(selectedStageSchedule?.course_end_time) ?? ''} required /></label>
                        <label>Durée d'une heure de cours<select name="lesson_duration_minutes" defaultValue={selectedStageSchedule?.lesson_duration_minutes ?? 55}>{[45, 50, 55, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
                      </div>
                    </section>
                    <section className="tmp-config__card">
                      <h4>Heures de pause</h4>
                      {selectedStageSchedule?.breaks?.length ? selectedStageSchedule.breaks.map((schoolBreak) => <p key={schoolBreak.id} className="tmp-config__break"><strong>{schoolBreak.label}</strong> {timeLabel(schoolBreak.start_time)} à {timeLabel(schoolBreak.end_time)}</p>) : <p className="tmp-empty">Aucune pause configurée pour ce cycle.</p>}
                      <div className="tmp-break-form">
                        <input name="break_label" placeholder="Ex. Pause du matin" required />
                        <input name="break_start_time" type="time" required />
                        <input name="break_end_time" type="time" required />
                        <button className="tmp-btn-secondary" type="button" onClick={handleAddBreak}>Ajouter une pause</button>
                      </div>
                    </section>
                    <section className="tmp-config__card">
                      <h4>Configuration par niveau</h4>
                      <div className="tmp-config__table-wrap"><table className="tmp-config__table"><thead><tr><th>Niveau</th><th>Début</th><th>Fin</th><th>Durée</th><th>Pauses</th></tr></thead><tbody>
                        {Object.entries(STAGE_LABELS).map(([stage, label]) => { const item = getStageSchedule(stage); return <tr key={stage}><td>{label}</td><td>{timeLabel(item?.course_start_time) ?? '—'}</td><td>{timeLabel(item?.course_end_time) ?? '—'}</td><td>{item?.lesson_duration_minutes ? `${item.lesson_duration_minutes} min` : '—'}</td><td>{item?.breaks?.map((schoolBreak) => `${schoolBreak.label} (${timeLabel(schoolBreak.start_time)})`).join(', ') || '—'}</td></tr> })}
                      </tbody></table></div>
                    </section>
                    <button className="tmp-btn-primary tmp-config__save" type="submit" disabled={configurationSaving}>{configurationSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>
                  </form>
                )}
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
                    <h3>Minutes par semaine et par matière</h3>
                    {subjectsLoading ? (
                      <p className="tmp-empty">Chargement des matières…</p>
                    ) : (
                      <div className="tmp-hours-grid">
                        {subjects.map((subject) => (
                          <label key={subject.id} className="tmp-hours-item">
                            <span>{subject.name}</span>
                            <input
                              type="number"
                              min="15"
                              step="15"
                              value={weeklyMinutesBySubjectId[subject.id] ?? ''}
                              onChange={(e) => handleMinutesChange(subject.id, e.target.value)}
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
                        {renderScheduleGrid(savedSlotsByDayAndTime, daySchedule)}
                        {generatedTimetable.unplaced_requirements.length > 0 && (
                          <p className="tmp-warning">
                            Minutes non placées : {generatedTimetable.unplaced_requirements
                              .map((entry) => `${entry.subject_name} (${entry.remaining_minutes} min)`)
                              .join(', ')}
                          </p>
                        )}
                        <button type="button" className="tmp-btn-primary" disabled={validating} onClick={handleValidateGeneratedTimetable}>
                          {validating ? 'Validation…' : "Valider l'emploi du temps"}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'special' && (
                  <>
                    <p className="tmp-section-hint">
                      Ajoutez un cours individuel pour un élève précis. Les conflits de classe, enseignant, salle et élève sont contrôlés par la base.
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
                        <span>Intitulé</span>
                        <input
                          type="text"
                          value={specialCourseForm.title}
                          onChange={(e) => setSpecialCourseForm((c) => ({ ...c, title: e.target.value }))}
                          placeholder="Ex. Rattrapage de mathématiques"
                        />
                      </label>
                      <label>
                        <span>Jour</span>
                        <select
                          value={specialCourseForm.day}
                          onChange={(e) => setSpecialCourseForm((c) => ({ ...c, day: e.target.value }))}
                        >
                          {gridDays.map((dayNumber) => <option key={dayNumber} value={dayNumber}>{DAY_LABELS[dayNumber - 1]}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Début</span>
                        <input
                          type="time"
                          value={specialCourseForm.startTime}
                          onChange={(e) => setSpecialCourseForm((c) => ({ ...c, startTime: e.target.value }))}
                        />
                      </label>
                      <label>
                        <span>Fin</span>
                        <input
                          type="time"
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
                              <strong>{course.title}</strong>
                              <span>
                                {course.student_first_name} {course.student_last_name} · {course.subject_name} · {DAY_LABELS[course.day_of_week - 1]}{' '}
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
                {activeTab === 'history' && <p className="tmp-empty">L'historique des versions validées sera disponible ici.</p>}
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
