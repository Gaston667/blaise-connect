import { Fragment } from 'react'
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

// Données simulées le temps que le backend (nouvelle table timetable_slots) soit disponible.
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']

const PERIODS = [
  { start: '08h', end: '09h' },
  { start: '09h', end: '10h' },
  { start: '10h15', end: '11h15' },
  { start: '11h15', end: '12h15' },
]

// index = position de la période dans PERIODS ; null = créneau libre
const GRID = {
  Lundi: [
    { subject_name: 'Mathématiques', teacher_name: 'M. Camara', room: 'Salle 12' },
    { subject_name: 'Français', teacher_name: 'Mme Diallo', room: 'Salle 4' },
    { subject_name: 'Anglais', teacher_name: 'Mme Barry', room: 'Salle 8' },
    { subject_name: 'EPS', teacher_name: 'M. Barry', room: 'Gymnase' },
  ],
  Mardi: [
    { subject_name: 'Français', teacher_name: 'Mme Diallo', room: 'Salle 4' },
    { subject_name: 'Histoire-Géo', teacher_name: 'M. Koné', room: 'Salle 6' },
    { subject_name: 'Mathématiques', teacher_name: 'M. Camara', room: 'Salle 12' },
    null,
  ],
  Mercredi: [
    { subject_name: 'Anglais', teacher_name: 'Mme Barry', room: 'Salle 8' },
    { subject_name: 'Anglais', teacher_name: 'Mme Barry', room: 'Salle 8' },
    null,
    null,
  ],
  Jeudi: [
    { subject_name: 'Mathématiques', teacher_name: 'M. Camara', room: 'Salle 12' },
    { subject_name: 'SVT', teacher_name: 'M. Touré', room: 'Labo 2' },
    { subject_name: 'Histoire-Géo', teacher_name: 'M. Koné', room: 'Salle 6' },
    { subject_name: 'Français', teacher_name: 'Mme Diallo', room: 'Salle 4' },
  ],
  Vendredi: [
    { subject_name: 'Physique-Chimie', teacher_name: 'M. Sylla', room: 'Labo 1' },
    null,
    { subject_name: 'Français', teacher_name: 'Mme Diallo', room: 'Salle 4' },
    null,
  ],
}

export default function StudentTimetablePage() {
  const subjectColorByName = new Map()
  Object.values(GRID).flat().forEach((slot) => {
    if (slot && !subjectColorByName.has(slot.subject_name)) {
      subjectColorByName.set(slot.subject_name, PALETTE[subjectColorByName.size % PALETTE.length])
    }
  })

  return (
    <main className="stp-main">
      <header className="stp-header">
        <div>
          <h1><CalendarDays aria-hidden="true" size={22} /> Emploi du temps</h1>
          <p>Semaine du 1 au 5 septembre</p>
        </div>
      </header>

      <p className="stp-mock-banner">
        Données de démonstration — l'emploi du temps réel sera branché une fois le backend disponible.
      </p>

      <section className="stp-section">
        <div className="stp-grid-wrapper">
          <div className="stp-grid" style={{ '--stp-period-count': PERIODS.length }}>
            <div className="stp-grid__corner" />
            {DAYS.map((day) => (
              <div key={day} className="stp-grid__day-head">{day}</div>
            ))}

            {PERIODS.map((period, periodIndex) => (
              <Fragment key={`period-${period.start}`}>
                <div className="stp-grid__time">
                  <strong>{period.start}</strong>
                  <span>{period.end}</span>
                </div>
                {DAYS.map((day) => {
                  const slot = GRID[day]?.[periodIndex]
                  if (!slot) {
                    return <div key={`${day}-${periodIndex}`} className="stp-cell stp-cell--free">Libre</div>
                  }
                  const SubjectIcon = getSubjectIcon(slot.subject_name)
                  const color = subjectColorByName.get(slot.subject_name) ?? 'violet'
                  return (
                    <div key={`${day}-${periodIndex}`} className={`stp-cell stp-cell--${color}`}>
                      <span className="stp-cell__title"><SubjectIcon aria-hidden="true" size={14} /> {slot.subject_name}</span>
                      <span className="stp-cell__meta">{slot.teacher_name} · {slot.room}</span>
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
