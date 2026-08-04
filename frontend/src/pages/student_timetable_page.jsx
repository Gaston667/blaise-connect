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

import { getMyTimetable } from '../services/student_timetable_service.js'
import { DEFAULT_DAYS, getDayScheduleForStage } from '../utils/timetable_generator.js'
import '../styles/student_timetable_page.css'

const PALETTE = ['violet', 'green', 'blue', 'orange']

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

export default function StudentTimetablePage() {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(function loadTimetableEffect() {
    async function load() {
      try {
        setSlots(await getMyTimetable())
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

  const subjectColorByName = new Map()
  slots.forEach((slot) => {
    if (!subjectColorByName.has(slot.subject_name)) {
      subjectColorByName.set(slot.subject_name, PALETTE[subjectColorByName.size % PALETTE.length])
    }
  })

  const slotsByDayAndTime = new Map(
    slots.map((slot) => [`${slot.day_of_week}-${timeLabel(slot.start_time)}`, slot])
  )
  const daySchedule = getDayScheduleForStage(slots[0]?.education_stage, { fullDay: true })

  return (
    <main className="stp-main">
      <header className="stp-header">
        <div>
          <h1><CalendarDays aria-hidden="true" size={22} /> Emploi du temps</h1>
          <p>Établissement ouvert de 8h00 à 19h00.</p>
        </div>
      </header>

      <section className="stp-section">
        {slots.length === 0 ? (
          <p className="stp-empty">Aucun emploi du temps disponible pour le moment.</p>
        ) : (
          <div className="stp-grid-wrapper">
            <div className="stp-grid" style={{ '--stp-period-count': daySchedule.length }}>
              <div className="stp-grid__corner" />
              {DEFAULT_DAYS.map((day) => (
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
                    {DEFAULT_DAYS.map((day, dayIndex) => {
                      const slot = slotsByDayAndTime.get(`${dayIndex + 1}-${entry.start}`)
                      if (!slot) {
                        return <div key={`${day}-${entry.start}`} className="stp-cell stp-cell--free">Libre</div>
                      }
                      const SubjectIcon = getSubjectIcon(slot.subject_name)
                      const color = subjectColorByName.get(slot.subject_name) ?? 'violet'
                      return (
                        <div key={`${day}-${entry.start}`} className={`stp-cell stp-cell--${color}`}>
                          <span className="stp-cell__title"><SubjectIcon aria-hidden="true" size={14} /> {slot.subject_name}</span>
                          <span className="stp-cell__meta">{slot.teacher_name}{slot.room_name ? ` · ${slot.room_name}` : ''}</span>
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
