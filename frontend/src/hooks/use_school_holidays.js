import { useEffect, useState } from 'react'

import { getSchoolHolidays } from '../services/school_holiday_service.js'

/**
 * Vacances scolaires qui chevauchent la plage donnée (AAAA-MM-JJ).
 * En cas d'erreur, la liste reste vide : l'emploi du temps s'affiche quand même.
 */
export default function useSchoolHolidays(dateFrom, dateTo) {
  const [holidays, setHolidays] = useState([])

  useEffect(function loadHolidaysEffect() {
    let cancelled = false
    async function load() {
      try {
        const data = await getSchoolHolidays(dateFrom, dateTo)
        if (!cancelled) setHolidays(data)
      } catch {
        if (!cancelled) setHolidays([])
      }
    }
    load()
    return function cancelLoad() { cancelled = true }
  }, [dateFrom, dateTo])

  return holidays
}
