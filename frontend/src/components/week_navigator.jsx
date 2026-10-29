import { ChevronLeft, ChevronRight } from 'lucide-react'

import { addDays, formatWeekRange, getWeekStart } from '../utils/timetable_week.js'

/** Boutons « semaine précédente / aujourd'hui / semaine suivante » d'un emploi du temps. */
export default function WeekNavigator({ weekStart, onChange, lastDayIndex = 4 }) {
  const isCurrentWeek = weekStart === getWeekStart()
  return (
    <div className="stp-week-nav">
      <div className="stp-week-nav__buttons" role="group" aria-label="Navigation par semaine">
        <button type="button" onClick={() => onChange(addDays(weekStart, -7))} aria-label="Semaine précédente">
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          className="stp-week-nav__today"
          onClick={() => onChange(getWeekStart())}
          disabled={isCurrentWeek}
        >
          Aujourd’hui
        </button>
        <button type="button" onClick={() => onChange(addDays(weekStart, 7))} aria-label="Semaine suivante">
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </div>
      <strong className="stp-week-nav__range">{formatWeekRange(weekStart, lastDayIndex)}</strong>
    </div>
  )
}
