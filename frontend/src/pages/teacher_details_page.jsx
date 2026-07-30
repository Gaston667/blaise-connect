import { useEffect, useState } from 'react'
import { getTeacherDetail } from '../services/teachers_overview_service.js'
import '../styles/teacher_details_page.css'

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(value))
}

export default function TeacherDetailsPage({ teacher, onNavigate }) {
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [teacher?.id])

  async function load() {
    if (!teacher?.id) return
    setLoading(true)
    try {
      const data = await getTeacherDetail(teacher.id)
      setDetails(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <main className="tdp-main">Chargement…</main>
  if (!details) return <main className="tdp-main">Enseignant non trouvé.</main>

  return (
    <main className="tdp-main">
      <nav className="tdp-breadcrumb">
        <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
        <span>›</span>
        <button type="button" onClick={() => onNavigate?.('teachers')}>Enseignants</button>
        <span>›</span>
        <span>{details.first_name} {details.last_name}</span>
      </nav>

      <div className="tdp-header">
        <span className="tdp-avatar">{initials(details.first_name, details.last_name)}</span>
        <div>
          <h1>{details.first_name} {details.last_name}</h1>
          <div className="tdp-header__badges">
            <span className="tdp-badge tdp-badge--active">
              <span className="tdp-badge__dot" />
              Actif
            </span>
          </div>
          <dl className="tdp-summary">
            <div><dt>Matricule</dt><dd>{details.registration_number}</dd></div>
            <div><dt>Date d'embauche</dt><dd>{formatDate(details.hire_date)}</dd></div>
            <div><dt>Élèves encadrés</dt><dd>{details.total_students}</dd></div>
          </dl>
        </div>
      </div>

      <div className="tdp-body">
        <section className="tdp-content">
          <h3>Informations de contact</h3>
          <dl className="tdp-info-list">
            <div><dt>Email</dt><dd>{details.email ?? '—'}</dd></div>
            <div><dt>Téléphone</dt><dd>{details.phone ?? '—'}</dd></div>
            <div><dt>Adresse</dt><dd>{details.address ?? '—'}</dd></div>
            <div><dt>Qualification</dt><dd>{details.qualification ?? '—'}</dd></div>
          </dl>

          <h3>Matières enseignées</h3>
          {details.subjects.length === 0 ? (
            <p className="tdp-placeholder">Aucune matière renseignée pour cet enseignant.</p>
          ) : (
            <div className="tdp-chips">
              {details.subjects.map((s) => (
                <span key={s} className="tdp-chip">{s}</span>
              ))}
            </div>
          )}
        </section>

        <aside className="tdp-sidebar">
          <div className="tdp-card">
            <h4>Classes en charge (professeur principal)</h4>
            {details.classes.length === 0 ? (
              <p className="tdp-placeholder">Aucune classe rattachée.</p>
            ) : (
              <ul className="tdp-class-list">
                {details.classes.map((c) => (
                  <li key={c.id}>
                    <div>
                      <strong>{c.name}</strong>
                      <span className="tdp-class-meta">{c.school_year_name}</span>
                    </div>
                    <span className="tdp-class-count">{c.student_count} élèves</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}