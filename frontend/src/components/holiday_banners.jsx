import { Palmtree } from 'lucide-react'

import { formatHolidayRange, getWeekHolidays } from '../utils/timetable_week.js'

/**
 * Bandeaux des vacances scolaires au-dessus d'un emploi du temps :
 * celles qui touchent la semaine affichée, et un rappel des prochaines vacances
 * avec un bouton pour aller directement à leur semaine.
 */
export default function HolidayBanners({ holidays, weekStart, weekEnd, onShowWeek }) {
  const weekHolidays = getWeekHolidays(holidays, weekStart, weekEnd)
  const nextHoliday = holidays.find((holiday) => holiday.start_date > weekEnd) ?? null

  return (
    <>
      {weekHolidays.map((holiday) => (
        <p key={holiday.id} className="stp-holiday-banner" role="status">
          <Palmtree aria-hidden="true" size={16} /> Vacances scolaires : {holiday.name} ({formatHolidayRange(holiday)}).
        </p>
      ))}
      {weekHolidays.length === 0 && nextHoliday ? (
        <p className="stp-holiday-banner stp-holiday-banner--upcoming" role="status">
          <Palmtree aria-hidden="true" size={16} />
          <span>Prochaines vacances : {nextHoliday.name} ({formatHolidayRange(nextHoliday)}).</span>
          {onShowWeek ? (
            <button type="button" className="stp-holiday-banner__button" onClick={() => onShowWeek(nextHoliday.start_date)}>
              Voir cette semaine
            </button>
          ) : null}
        </p>
      ) : null}
    </>
  )
}
