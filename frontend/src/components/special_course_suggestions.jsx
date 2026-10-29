import { useState } from 'react'
import { Clock, Search } from 'lucide-react'

import { getSpecialCourseSuggestions } from '../services/timetable_service.js'

const DURATIONS = [30, 45, 60, 90, 120]

function shortTime(value) {
  return value?.slice(0, 5)
}

/**
 * Propose les créneaux où l'élève n'a pas cours, l'enseignant est libre et une
 * salle est disponible (fin de journée, heure libre, samedi si l'école y enseigne…).
 */
export default function SpecialCourseSuggestions({ classId, studentId, subjectId, onPick }) {
  const [minutes, setMinutes] = useState(60)
  const [suggestions, setSuggestions] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function search() {
    setError('')
    setIsLoading(true)
    try {
      setSuggestions(await getSpecialCourseSuggestions(classId, studentId, subjectId, minutes))
    } catch (searchError) {
      setSuggestions(null)
      setError(searchError.message)
    } finally {
      setIsLoading(false)
    }
  }

  const isReady = Boolean(studentId && subjectId)

  return (
    <div className="tmp-suggestions tmp-field--wide">
      <div className="tmp-suggestions__bar">
        <label className="tmp-field">
          <span>Durée</span>
          <select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
            {DURATIONS.map((value) => <option key={value} value={value}>{value} min</option>)}
          </select>
        </label>
        <button type="button" className="tmp-btn-secondary" onClick={search} disabled={!isReady || isLoading}>
          <Search aria-hidden="true" size={16} /> {isLoading ? 'Recherche…' : 'Proposer des créneaux libres'}
        </button>
      </div>
      {!isReady && <small className="tmp-field-hint">Choisissez l’élève et la matière pour voir les créneaux où il n’a pas cours.</small>}
      {error && <p className="tmp-error" role="alert">{error}</p>}
      {suggestions && suggestions.length === 0 && (
        <p className="tmp-field-hint">Aucun créneau libre commun à l’élève et à l’enseignant n’a été trouvé.</p>
      )}
      {suggestions && suggestions.length > 0 && (
        <ul className="tmp-suggestions__list">
          {suggestions.map((item) => (
            <li key={`${item.day_of_week}-${item.start_time}`}>
              <button type="button" onClick={() => onPick(item)}>
                <Clock aria-hidden="true" size={14} />
                <strong>{item.day_label} {shortTime(item.start_time)}–{shortTime(item.end_time)}</strong>
                <small>{item.teacher_name}{item.room_name ? ` · ${item.room_name}` : ''}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
