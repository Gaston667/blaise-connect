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
import { useGuardianChild } from '../context/guardian_child_context.js'
import WeekNavigator from '../components/week_navigator.jsx'
import HolidayBanners from '../components/holiday_banners.jsx'
import useSchoolHolidays from '../hooks/use_school_holidays.js'
import { addDays, formatShortDate, getHolidayOn, getWeekHolidays, getWeekStart, isSlotOnDate } from '../utils/timetable_week.js'
import { DAY_LABELS, getMergedDayCells, getScheduleRows, getSlotSubtitle } from '../utils/timetable_display.js'
import '../styles/student_timetable_page.css'

// L'espace élève n'affiche que les jours de classe (Lundi à Vendredi).
const WEEKDAY_LABELS = DAY_LABELS.slice(0, 5)

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

/** Jour de la semaine actuel (0 = Lundi … 6 = Dimanche), replié sur Lundi le week-end. */
function getDefaultDayIndex() {
  const jsDay = new Date().getDay() // 0 = dimanche, 1 = lundi, …
  const index = jsDay === 0 ? 6 : jsDay - 1
  return index <= 4 ? index : 0
}

export default function StudentTimetablePage() {
  const { childId } = useGuardianChild()
  const [slots, setSlots] = useState([])
  const [breaks, setBreaks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDayIndex, setSelectedDayIndex] = useState(getDefaultDayIndex)
  const [weekStart, setWeekStart] = useState(getWeekStart)
  const holidays = useSchoolHolidays(weekStart, addDays(weekStart, 120))

  useEffect(function loadTimetableEffect() {
    async function load() {
      try {
        const timetable = await getMyTimetable(childId)
        setSlots(timetable.slots ?? [])
        setBreaks(timetable.breaks ?? [])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [childId])

  if (loading) return <main className="stp-main"><p>Chargement de votre emploi du temps…</p></main>
  if (error) return <main className="stp-main"><p className="stp-error">{error}</p></main>

  const subjectColorByName = new Map()
  slots.forEach((slot) => {
    if (!subjectColorByName.has(slot.subject_name)) {
      subjectColorByName.set(slot.subject_name, PALETTE[subjectColorByName.size % PALETTE.length])
    }
  })

  function findSlotsForCell(dayIndex, period) {
    const dateValue = addDays(weekStart, dayIndex)
    if (getHolidayOn(holidays, dateValue)) return []
    return slots.filter(
      (slot) =>
        isSlotOnDate(slot, dateValue, dayIndex) &&
        timeLabel(slot.start_time) < period.end &&
        timeLabel(slot.end_time) > period.start
    )
  }
  const daySchedule = getScheduleRows(slots, breaks)
  const weekHasCourses = WEEKDAY_LABELS.some((_, dayIndex) =>
    !getHolidayOn(holidays, addDays(weekStart, dayIndex))
    && slots.some((slot) => isSlotOnDate(slot, addDays(weekStart, dayIndex), dayIndex)))
  const mergedCellsByDay = WEEKDAY_LABELS.map((_, dayIndex) =>
    getMergedDayCells(daySchedule, (row) => findSlotsForCell(dayIndex, row)))

  return (
    <main className="stp-main">
      <header className="stp-header">
        <div>
          <h1><CalendarDays aria-hidden="true" size={22} /> Emploi du temps</h1>
          <p>Consultez les créneaux validés de votre classe.</p>
        </div>
      </header>

      <section className="stp-section">
        {slots.length === 0 ? (
          <p className="stp-empty">Aucun emploi du temps disponible pour le moment.</p>
        ) : (
          <>
            <WeekNavigator weekStart={weekStart} onChange={setWeekStart} lastDayIndex={4} />
            <HolidayBanners holidays={holidays} weekStart={weekStart} weekEnd={addDays(weekStart, 6)} onShowWeek={(date) => setWeekStart(getWeekStart(date))} />
            {!weekHasCourses && getWeekHolidays(holidays, weekStart, addDays(weekStart, 6)).length === 0 && <p className="stp-empty">Aucun cours cette semaine : elle est en dehors de la période de l’emploi du temps.</p>}
            {/* Grille complète : lisible uniquement à partir d'un écran d'ordinateur. */}
            <div className="stp-grid-wrapper stp-desktop-only">
              <div className="stp-grid stp-grid--5-days" style={{ '--stp-period-count': daySchedule.length }}>
                <div className="stp-grid__corner" />
                {WEEKDAY_LABELS.map((day, labelIndex) => (
                  <div key={day} className="stp-grid__day-head">{day} <small>{formatShortDate(addDays(weekStart, labelIndex))}</small></div>
                ))}

                {daySchedule.map((entry, rowIndex) => (
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
                      {WEEKDAY_LABELS.map((day, dayIndex) => {
                        const cell = mergedCellsByDay[dayIndex][rowIndex]
                        if (!cell) return null
                        const spanStyle = cell.span > 1 ? { gridRow: `span ${cell.span}` } : undefined
                        if (cell.slots.length === 0) {
                          return <div key={`${day}-${entry.start}`} className="stp-cell stp-cell--free" style={spanStyle}>Libre</div>
                        }
                        const parallel = cell.slots.length > 1
                        const renderedSlots = cell.slots.map((slot) => {
                          const SubjectIcon = getSubjectIcon(slot.subject_name)
                          const color = subjectColorByName.get(slot.subject_name) ?? 'violet'
                          return (
                            <div
                              key={slot.id ?? slot.subject_name}
                              className={`${parallel ? 'stp-cell__sub' : 'stp-cell'} stp-cell--${color}${slot.is_special ? ' stp-cell--special' : ''}`}
                              style={parallel ? undefined : spanStyle}
                            >
                              <span className="stp-cell__title"><SubjectIcon aria-hidden="true" size={parallel ? 12 : 14} /> {slot.subject_name}</span>
                              <span className="stp-cell__meta">
                                {getSlotSubtitle(slot)}
                                {slot.room_name ? ` · ${slot.room_name}` : ''}
                              </span>
                            </div>
                          )
                        })
                        if (!parallel) return <Fragment key={`${day}-${entry.start}`}>{renderedSlots}</Fragment>
                        return (
                          <div key={`${day}-${entry.start}`} style={spanStyle} className="stp-cell stp-cell--parallel" title={`${cell.slots.length} cours en parallèle`}>
                            {renderedSlots}
                          </div>
                        )
                      })}
                    </Fragment>
                  )
                ))}
              </div>
            </div>

            {/* Vue « agenda du jour » : un jour à la fois, en liste verticale, pour rester lisible sur téléphone. */}
            <div className="stp-mobile-only">
              <div className="stp-day-tabs" role="tablist" aria-label="Choisir un jour">
                {WEEKDAY_LABELS.map((day, dayIndex) => (
                  <button
                    key={day}
                    type="button"
                    role="tab"
                    aria-selected={selectedDayIndex === dayIndex}
                    className={selectedDayIndex === dayIndex ? 'stp-day-tab stp-day-tab--active' : 'stp-day-tab'}
                    onClick={() => setSelectedDayIndex(dayIndex)}
                  >
                    {day.slice(0, 3)}
                    <small>{formatShortDate(addDays(weekStart, dayIndex))}</small>
                  </button>
                ))}
              </div>

              <div className="stp-day-agenda">
                {daySchedule.map((entry, rowIndex) => {
                  if (entry.type === 'break') {
                    return (
                      <div key={`mobile-break-${entry.start}`} className="stp-day-agenda__break">
                        {entry.label} · {entry.start}-{entry.end}
                      </div>
                    )
                  }
                  const cell = mergedCellsByDay[selectedDayIndex][rowIndex]
                  if (!cell) return null
                  const endTime = daySchedule[rowIndex + cell.span - 1].end
                  if (cell.slots.length === 0) {
                    return (
                      <div key={`mobile-free-${entry.start}`} className="stp-day-agenda__row stp-day-agenda__row--free">
                        <div className="stp-day-agenda__time">
                          <strong>{entry.start}</strong>
                          <span>{endTime}</span>
                        </div>
                        <span>Libre</span>
                      </div>
                    )
                  }
                  return (
                    <div key={`mobile-${entry.start}`} className="stp-day-agenda__group">
                      {cell.slots.map((slot) => {
                        const SubjectIcon = getSubjectIcon(slot.subject_name)
                        const color = subjectColorByName.get(slot.subject_name) ?? 'violet'
                        return (
                          <div key={slot.id ?? slot.subject_name} className={`stp-day-agenda__row stp-day-agenda__row--${color}`}>
                            <div className="stp-day-agenda__time">
                              <strong>{entry.start}</strong>
                              <span>{endTime}</span>
                            </div>
                            <div className="stp-day-agenda__info">
                              <span className="stp-day-agenda__title"><SubjectIcon aria-hidden="true" size={15} /> {slot.subject_name}</span>
                              <span className="stp-day-agenda__meta">
                                {getSlotSubtitle(slot)}
                                {slot.room_name ? ` · ${slot.room_name}` : ''}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
