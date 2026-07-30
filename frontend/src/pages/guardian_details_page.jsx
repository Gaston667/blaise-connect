import { useEffect, useState } from 'react'
import { getGuardianDetail } from '../services/guardians_overview_service.js'
import '../styles/guardian_details_page.css'

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

const STATUS_LABEL = { ACTIVE: 'Actif', INACTIVE: 'Inactif', ARCHIVED: 'Archivé' }
const STATUS_CLASS = { ACTIVE: 'gdp-badge--active', INACTIVE: 'gdp-badge--inactive', ARCHIVED: 'gdp-badge--archived' }

function StatusBadge({ status }) {
  return (
    <span className={`gdp-badge ${STATUS_CLASS[status] ?? ''}`}>
      <span className="gdp-badge__dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default function GuardianDetailsPage({ guardian, onNavigate }) {
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [guardian?.id])

  async function load() {
    if (!guardian?.id) return
    setLoading(true)
    try {
      const data = await getGuardianDetail(guardian.id)
      setDetails(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <main className="gdp-main">Chargement…</main>
  if (!details) return <main className="gdp-main">Responsable non trouvé.</main>

  return (
    <main className="gdp-main">
      <nav className="gdp-breadcrumb">
        <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
        <span>›</span>
        <button type="button" onClick={() => onNavigate?.('guardians')}>Responsables</button>
        <span>›</span>
        <span>{details.first_name} {details.last_name}</span>
      </nav>

      <div className="gdp-header">
        <span className="gdp-avatar">{initials(details.first_name, details.last_name)}</span>
        <div>
          <h1>{details.first_name} {details.last_name}</h1>
          <dl className="gdp-summary">
            <div><dt>Téléphone</dt><dd>{details.phone ?? '—'}</dd></div>
            <div><dt>Email</dt><dd>{details.email ?? '—'}</dd></div>
            <div><dt>Enfants rattachés</dt><dd>{details.students.length}</dd></div>
          </dl>
        </div>
      </div>

      <div className="gdp-body">
        <section className="gdp-content">
          <h3>Informations de contact</h3>
          <dl className="gdp-info-list">
            <div><dt>Adresse</dt><dd>{details.address ?? '—'}</dd></div>
            <div><dt>Profession</dt><dd>{details.occupation ?? '—'}</dd></div>
            <div><dt>Employeur</dt><dd>{details.employer ?? '—'}</dd></div>
          </dl>
        </section>

        <aside className="gdp-sidebar">
          <div className="gdp-card">
            <h4>Élèves rattachés</h4>
            {details.students.length === 0 ? (
              <p className="gdp-placeholder">Aucun élève rattaché à ce responsable.</p>
            ) : (
              <ul className="gdp-student-list">
                {details.students.map((s) => (
                  <li key={s.id} onClick={() => onNavigate?.('student-details', s)}>
                    <div>
                      <strong>{s.first_name} {s.last_name}</strong>
                      <span className="gdp-student-meta">
                        {s.relationship_label}
                        {s.is_primary_contact && ' · Contact principal'}
                      </span>
                      {s.class_name && <span className="gdp-student-meta">{s.class_name}</span>}
                    </div>
                    <StatusBadge status={s.status} />
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