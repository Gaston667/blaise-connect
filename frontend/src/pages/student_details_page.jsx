import { useEffect, useState } from 'react'
import { getStudent } from '../services/students_service.js'

export default function StudentDetailsPage({ student, onNavigate }) {
  const [details, setDetails] = useState(student)

  useEffect(() => {
    async function load() {
      if (student?.id) {
        try {
          const full = await getStudent(student.id)
          setDetails(full)
        } catch (e) {
          console.error(e)
        }
      }
    }
    load()
  }, [student])

  if (!details) return <div>Élève non trouvé.</div>

  return (
    <aside className="student-details">
      <div className="student-header">
        <div className="student-avatar">{(details.first_name?.[0] ?? '') + (details.last_name?.[0] ?? '')}</div>
        <h2>{details.first_name} {details.last_name}</h2>
        <div className="student-meta">{details.registration_number}</div>
      </div>

      <div className="student-info">
        <h3>Informations personnelles</h3>
        <p><strong>Date de naissance:</strong> {details.birth_date ?? '—'}</p>
        <p><strong>Sexe:</strong> {details.gender ?? '—'}</p>
        <p><strong>Téléphone:</strong> {details.phone ?? '—'}</p>
        <p><strong>Email:</strong> {details.email ?? '—'}</p>
      </div>

      <div className="student-school">
        <h3>Informations scolaires</h3>
        <p><strong>Date d'inscription:</strong> {details.admission_date ?? '—'}</p>
        <p><strong>Statut:</strong> {details.status}</p>
      </div>
    </aside>
  )
}
