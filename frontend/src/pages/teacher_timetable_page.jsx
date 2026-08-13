import { Fragment, useEffect, useState } from 'react'
import {
  BookOpen,
  Calculator,
  CalendarDays,
  FlaskConical,
  Globe2,
  Languages,
  Laptop2,
  Palette,
} from 'lucide-react'

import { getMyTeacherTimetable } from '../services/teacher_timetable_service.js'
import { DAY_LABELS, getScheduleRows } from '../utils/timetable_display.js'
import '../styles/student_timetable_page.css'

const PALETTE = ['violet', 'green', 'blue', 'orange', 'pink', 'teal', 'yellow', 'red']

const SUBJECT_ICON_RULES = [
  [/math/i, Calculator],
  [/(fran[cç]ais|litt[ée]rature|lettres)/i, BookOpen],
  [/(sciences|physique|chimie|svt|biolog)/i, FlaskConical],
  [/(histoire|g[ée]o)/i, Globe2],
  [/(anglais|espagnol|allemand|langue)/i, Languages],
  [/(informatique|numérique|nsi)/i, Laptop2],
  [/(art|dessin|musique|eps|sport)/i, Palette],
]

function getSubjectIcon(subjectName) {
  const match = SUBJECT_ICON_RULES.find(([pattern]) => pattern.test(subjectName ?? ''))
  return match ? match[1] : BookOpen
}

function timeLabel(value) {
  return value?.slice(0, 5) ?? value
}

export default function TeacherTimetablePage() {
  const [slots, setSlots] = useState([])
  const [breaks, setBreaks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(function loadTimetableEffect() {
    async function load() {
      try {
        const timetable = await getMyTeacherTimetable()
        setSlots(timetable.slots ?? [])
        setBreaks(timetable.breaks ?? [])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <main className="stp-main"><p>Chargement de votre emploi du temps…</p></main>
  if (error) return <main className="stp-main"><p className="stp-error">{error}</p></main>

  const classColorByName = new Map()
  slots.forEach((slot) => {
    if (!classColorByName.has(slot.class_name)) {
      classColorByName.set(slot.class_name, PALETTE[classColorByName.size % PALETTE.length])
    }
  })

  function findSlotForCell(dayIndex, period) {
    return slots.find(
      (slot) =>
        slot.day_of_week === dayIndex + 1 &&
        timeLabel(slot.start_time) < period.end &&
        timeLabel(slot.end_time) > period.start
    )
  }
  const daySchedule = getScheduleRows(slots, breaks)

  return (
    <main className="stp-main">
      <header className="stp-header">
        <div>
          <h1><CalendarDays aria-hidden="true" size={22} /> Mon emploi du temps</h1>
          <p>Consultez les créneaux validés de toutes vos classes.</p>
        </div>
      </header>

      <section className="stp-section">
        {slots.length === 0 ? (
          <p className="stp-empty">Aucun emploi du temps disponible pour le moment.</p>
        ) : (
          <div className="stp-grid-wrapper">
            <div className="stp-grid" style={{ '--stp-period-count': daySchedule.length }}>
              <div className="stp-grid__corner" />
              {DAY_LABELS.map((day) => (
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
                    {DAY_LABELS.map((day, dayIndex) => {
                      const slot = findSlotForCell(dayIndex, entry)
                      if (!slot) {
                        return <div key={`${day}-${entry.start}`} className="stp-cell stp-cell--free">Libre</div>
                      }
                      const SubjectIcon = getSubjectIcon(slot.subject_name)
                      const color = classColorByName.get(slot.class_name) ?? 'violet'
                      return (
                        <div key={`${day}-${entry.start}`} className={`stp-cell stp-cell--${color}`}>
                          <span className="stp-cell__title"><SubjectIcon aria-hidden="true" size={14} /> {slot.subject_name}</span>
                          <span className="stp-cell__meta">
                            {slot.class_name}{slot.room_name ? ` · ${slot.room_name}` : ''}
                          </span>
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
    </main>
  )
}
