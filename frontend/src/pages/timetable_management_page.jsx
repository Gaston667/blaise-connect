import { Fragment, useEffect, useState } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'

import { getSchoolClassesOverview, getSchoolClassSubjects } from '../services/school_classes_overview_service.js'
import { listStudents } from '../services/students_service.js'
import { getClassTimetable, createTimetableSlot, clearClassTimetable } from '../services/timetable_service.js'
import { generateWeeklyTimetable, DEFAULT_DAYS, getRegularPeriodsForStage, getDayScheduleForStage } from '../utils/timetable_generator.js'
import { formatProfileName } from '../utils/profileDisplay.js'
import '../styles/timetable_management_page.css'

// Page centralisant toute la gestion de l'emploi du temps : c'est ici (et pas
// dans les détails d'une classe) que doivent vivre les futures modifications
// - saisie des heures/semaine, génération, cours particuliers.
// Les cours réguliers sont enregistrés en base (timetable_slots) ; les cours
// particuliers restent une maquette locale, la table ne portant pas encore
// de notion de créneau propre à un seul élève.

function timeLabel(value) {
  return value?.slice(0, 5) ?? value
}

export default function TimetableManagementPage() {
  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedClassId, setSelectedClassId] = useState('')
  const [subjects, setSubjects] = useState([])
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [weeklyHoursBySubjectId, setWeeklyHoursBySubjectId] = useState({})
  const [generatedTimetable, setGeneratedTimetable] = useState(null)
  const [savedSlots, setSavedSlots] = useState([])
  const [savedSlotsLoading, setSavedSlotsLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [students, setStudents] = useState([])
  const [specialCoursesByClassId, setSpecialCoursesByClassId] = useState({})
  const [specialCourseForm, setSpecialCourseForm] = useState({
    studentId: '',
    subjectName: '',
    day: DEFAULT_DAYS[0],
    startTime: '08:00',
    endTime: '09:00',
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
      return
    }
    setSubjectsLoading(true)
    setSavedSlotsLoading(true)
    setWeeklyHoursBySubjectId({})
    setGeneratedTimetable(null)
    async function load() {
      try {
        const [subjectData, studentData, timetableData] = await Promise.all([
          getSchoolClassSubjects(selectedClassId),
          listStudents({ class_id: selectedClassId, limit: 100 }),
          getClassTimetable(selectedClassId),
        ])
        setSubjects(subjectData)
        setStudents(Array.isArray(studentData) ? studentData : studentData.items ?? [])
        setSavedSlots(timetableData)
      } catch (e) {
        setError(e.message)
      } finally {
        setSubjectsLoading(false)
        setSavedSlotsLoading(false)
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

  function handleGenerate() {
    const subjectHours = subjects
      .filter((subject) => weeklyHoursBySubjectId[subject.id] > 0)
      .map((subject) => ({
        subjectId: subject.id,
        subjectName: subject.name,
        hours: weeklyHoursBySubjectId[subject.id],
      }))

    if (subjectHours.length === 0) {
      setError('Renseignez au moins une matière avec des heures/semaine avant de générer un aperçu.')
      return
    }
    setError('')
    setGeneratedTimetable(generateWeeklyTimetable(subjectHours, { periods: regularPeriods }))
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
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const specialCourses = specialCoursesByClassId[selectedClassId] ?? []

  function handleAddSpecialCourse(event) {
    event.preventDefault()
    if (!specialCourseForm.studentId || !specialCourseForm.subjectName.trim()) {
      setError('Choisissez un élève et une matière pour le cours particulier.')
      return
    }
    if (specialCourseForm.endTime <= specialCourseForm.startTime) {
      setError('L\'heure de fin doit être après l\'heure de début.')
      return
    }
    if (specialCourseForm.startTime < '08:00' || specialCourseForm.endTime > '19:00') {
      setError('Un cours particulier doit rester entre 8h00 et 19h00.')
      return
    }
    const student = students.find((s) => s.id === specialCourseForm.studentId)
    const newCourse = {
      id: crypto.randomUUID(),
      studentId: specialCourseForm.studentId,
      studentName: student
        ? formatProfileName(student.first_name, student.last_name, student.gender)
        : '—',
      subjectName: specialCourseForm.subjectName.trim(),
      day: specialCourseForm.day,
      startTime: specialCourseForm.startTime,
      endTime: specialCourseForm.endTime,
      note: specialCourseForm.note.trim(),
    }
    setSpecialCoursesByClassId((current) => ({
      ...current,
      [selectedClassId]: [...(current[selectedClassId] ?? []), newCourse],
    }))
    setSpecialCourseForm((current) => ({ ...current, subjectName: '', note: '' }))
    setError('')
  }

  function handleRemoveSpecialCourse(courseId) {
    setSpecialCoursesByClassId((current) => ({
      ...current,
      [selectedClassId]: (current[selectedClassId] ?? []).filter((course) => course.id !== courseId),
    }))
  }

  const savedSlotsByDayAndTime = new Map(
    savedSlots.map((slot) => [`${slot.day_of_week}-${timeLabel(slot.start_time)}`, slot])
  )

  return (
    <main className="tmp-main">
      <header className="tmp-header">
        <div>
          <h1><CalendarDays aria-hidden="true" size={22} /> Emploi du temps</h1>
          <p>Gestion centralisée des emplois du temps : besoins horaires, génération et cours particuliers.</p>
        </div>
      </header>

      <p className="tmp-mock-banner">
        Établissement ouvert de 8h00 à 19h00. Les cours réguliers s'arrêtent au plus tard à 17h30 ;
        au-delà, seuls des cours particuliers peuvent être placés.
      </p>

      {error && <p className="tmp-error">{error}</p>}

      <section className="tmp-section">
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
          <p className="tmp-mock-banner">
            Récréation {selectedClass?.education_stage === 'PRESCHOOL' || selectedClass?.education_stage === 'PRIMARY'
              ? '9h30-9h50 (primaire/maternelle)'
              : '9h50-10h10 (collège/lycée)'} · Pause déjeuner 12h00-13h30.
          </p>

          <section className="tmp-section">
            <h2>Emploi du temps enregistré</h2>
            {savedSlotsLoading ? (
              <p className="tmp-empty">Chargement…</p>
            ) : savedSlots.length === 0 ? (
              <p className="tmp-empty">Aucun créneau enregistré pour cette classe. Générez-en un ci-dessous.</p>
            ) : (
              <div className="tmp-grid-wrapper">
                <div className="tmp-grid" style={{ gridTemplateColumns: `64px repeat(${DEFAULT_DAYS.length}, minmax(120px, 1fr))` }}>
                  <div className="tmp-grid__corner" />
                  {DEFAULT_DAYS.map((day) => (
                    <div key={day} className="tmp-grid__day-head">{day}</div>
                  ))}
                  {daySchedule.map((entry) => (
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
                          const slot = savedSlotsByDayAndTime.get(`${dayIndex + 1}-${entry.start}`)
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
            )}
          </section>

          <section className="tmp-section">
            <h2>Heures/semaine par matière</h2>
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

            <button type="button" className="tmp-btn-primary" onClick={handleGenerate}>
              Générer un aperçu d'emploi du temps
            </button>

            {generatedTimetable && (
              <div className="tmp-generated-preview">
                {generatedTimetable.warnings.map((warning) => (
                  <p key={warning} className="tmp-warning">{warning}</p>
                ))}
                <div className="tmp-grid-wrapper">
                  <div className="tmp-grid" style={{ gridTemplateColumns: `64px repeat(${DEFAULT_DAYS.length}, minmax(120px, 1fr))` }}>
                    <div className="tmp-grid__corner" />
                    {DEFAULT_DAYS.map((day) => (
                      <div key={day} className="tmp-grid__day-head">{day}</div>
                    ))}
                    {(() => {
                      let periodIndex = -1
                      return daySchedule.map((entry) => {
                        if (entry.type === 'break') {
                          return (
                            <div key={`gen-break-${entry.start}`} className="tmp-break-row">
                              {entry.label} ({entry.start}-{entry.end})
                            </div>
                          )
                        }
                        periodIndex += 1
                        const currentPeriodIndex = periodIndex
                        return (
                          <Fragment key={`gen-time-${entry.start}`}>
                            <div className="tmp-grid__time">
                              <strong>{entry.start}</strong>
                              <span>{entry.end}</span>
                            </div>
                            {DEFAULT_DAYS.map((day) => {
                              const classSubjectId = generatedTimetable.grid[day][currentPeriodIndex]
                              const subject = subjects.find((s) => s.id === classSubjectId)
                              return (
                                <div
                                  key={`${day}-${currentPeriodIndex}`}
                                  className={classSubjectId ? 'tmp-cell' : 'tmp-cell tmp-cell--free'}
                                >
                                  {subject ? subject.name : 'Libre'}
                                </div>
                              )
                            })}
                          </Fragment>
                        )
                      })
                    })()}
                  </div>
                </div>
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
          </section>

          <section className="tmp-section">
            <h2>Cours particuliers</h2>
            <p className="tmp-section-hint">
              Ajoutez un cours en dehors du planning commun pour un élève précis de cette classe (8h-19h).
              Non enregistré en base : la table actuelle ne porte pas de créneau propre à un seul élève.
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
                <input
                  type="text"
                  value={specialCourseForm.subjectName}
                  onChange={(e) => setSpecialCourseForm((c) => ({ ...c, subjectName: e.target.value }))}
                  placeholder="Ex. Soutien mathématiques"
                />
              </label>
              <label>
                <span>Jour</span>
                <select
                  value={specialCourseForm.day}
                  onChange={(e) => setSpecialCourseForm((c) => ({ ...c, day: e.target.value }))}
                >
                  {DEFAULT_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                </select>
              </label>
              <label>
                <span>Début</span>
                <input
                  type="time"
                  min="08:00"
                  max="19:00"
                  value={specialCourseForm.startTime}
                  onChange={(e) => setSpecialCourseForm((c) => ({ ...c, startTime: e.target.value }))}
                />
              </label>
              <label>
                <span>Fin</span>
                <input
                  type="time"
                  min="08:00"
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
              <button type="submit" className="tmp-btn-primary tmp-special-submit">
                <Plus aria-hidden="true" size={16} /> Ajouter
              </button>
            </form>

            <ul className="tmp-special-list">
              {specialCourses.length === 0 ? (
                <li className="tmp-empty">Aucun cours particulier pour cette classe.</li>
              ) : (
                specialCourses.map((course) => (
                  <li key={course.id} className="tmp-special-item">
                    <div>
                      <strong>{course.subjectName}</strong>
                      <span>{course.studentName} · {course.day} {course.startTime}–{course.endTime}</span>
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
          </section>
        </>
      )}
    </main>
  )
}
