import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'

import { getTimetableAlerts } from '../services/timetable_service.js'

/** Incohérences apparues après la publication (spécialités changées, enseignant remplacé). */
export default function TimetableAlerts() {
  const [alerts, setAlerts] = useState([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(function loadAlertsEffect() {
    let cancelled = false
    async function load() {
      try {
        const data = await getTimetableAlerts()
        if (!cancelled) setAlerts(data)
      } catch {
        if (!cancelled) setAlerts([])
      }
    }
    load()
    return function cancelLoad() { cancelled = true }
  }, [])

  if (alerts.length === 0) return null

  return (
    <section className="tmp-alerts" role="status" aria-label="Alertes sur les emplois du temps publiés">
      <button type="button" className="tmp-alerts__head" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen}>
        <TriangleAlert aria-hidden="true" size={18} />
        <strong>{alerts.length} alerte(s) sur les emplois du temps publiés</strong>
        <span>{isOpen ? 'Masquer' : 'Voir'}</span>
      </button>
      {isOpen && (
        <ul>
          {alerts.map((alert, index) => (
            <li key={`${alert.class_id}-${index}`}><strong>{alert.class_name}</strong> — {alert.message}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
