import { useEffect, useMemo, useState } from 'react'
import { getTeachersOverview } from '../services/teachers_overview_service.js'
import '../styles/teachers_page.css'
import { Users, UserCheck, UserPlus, UserX } from 'lucide-react'
function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

const STATUS_LABEL = { ACTIVE: 'Actif', INACTIVE: 'Inactif' }
const STATUS_CLASS = { ACTIVE: 'tp-badge--active', INACTIVE: 'tp-badge--inactive' }

function StatusBadge({ status }) {
  return (
    <span className={`tp-badge ${STATUS_CLASS[status] ?? ''}`}>
      <span className="tp-badge__dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

const PAGE_SIZE = 6

export default function TeachersPage({ onNavigate }) {
  const [query, setQuery] = useState('')
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    fetchTeachers()
  }, [])

  async function fetchTeachers(q = query) {
    setLoading(true)
    try {
      const data = await getTeachersOverview(q || null)
      setTeachers(data)
      setPage(0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    fetchTeachers(query)
  }

  const stats = useMemo(() => {
    const now = new Date()
    const total = teachers.length
    const active = teachers.filter((t) => t.status === 'ACTIVE').length
    const inactive = teachers.filter((t) => t.status !== 'ACTIVE').length
    const newThisMonth = teachers.filter((t) => {
      if (!t.hire_date) return false
      const d = new Date(t.hire_date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length
    return { total, active, inactive, newThisMonth }
  }, [teachers])

  const pageCount = Math.max(1, Math.ceil(teachers.length / PAGE_SIZE))
  const pageItems = teachers.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <main className="tp-main">
      <div className="tp-topbar">
        <div>
          <h1 className="tp-title">Enseignants</h1>
          <nav className="tp-breadcrumb">
            <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
            <span>›</span>
            <span>Enseignants</span>
          </nav>
        </div>
      </div>

      <div className="tp-stats">
        <div className="tp-stat-card">
          <span className="tp-stat-icon tp-stat-icon--blue">
            <Users aria-hidden="true" size={22} />
          </span>
          <div>
            <span className="tp-stat-label">Total enseignants</span>
            <strong>{stats.total}</strong>
            <span className="tp-stat-sub">enseignants</span>
          </div>
        </div>
        <div className="tp-stat-card">
          <span className="tp-stat-icon tp-stat-icon--green">
            <UserCheck aria-hidden="true" size={22} />
          </span>
          <div>
            <span className="tp-stat-label">Enseignants actifs</span>
            <strong>{stats.active}</strong>
            <span className="tp-stat-sub">actifs</span>
          </div>
        </div>
        <div className="tp-stat-card">
          <span className="tp-stat-icon tp-stat-icon--orange">
            <UserPlus aria-hidden="true" size={22} />
          </span>
          <div>
            <span className="tp-stat-label">Nouveaux ce mois</span>
            <strong>{stats.newThisMonth}</strong>
            <span className="tp-stat-sub">enseignants</span>
          </div>
        </div>
        <div className="tp-stat-card">
          <span className="tp-stat-icon tp-stat-icon--purple">
            <UserX aria-hidden="true" size={22} />
          </span>
          <div>
            <span className="tp-stat-label">Retirés / Inactifs</span>
            <strong>{stats.inactive}</strong>
            <span className="tp-stat-sub">enseignants</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSearch} className="tp-filters">
        <div className="tp-search">
          <span className="tp-search__icon">⌕</span>
          <input
            type="search"
            placeholder="Rechercher par nom, prénom ou matricule..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="tp-btn-search">Rechercher</button>
        <button type="button" className="tp-btn-primary" disabled title="Fonctionnalité à venir">
          + Ajouter un enseignant
        </button>
      </form>

      <section className="tp-list">
        <table className="tp-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Matricule</th>
              <th>Nom et prénom</th>
              <th>Matières principales</th>
              <th>Statut</th>
              <th>Email</th>
              <th>Téléphone</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="tp-loading">Chargement…</td></tr>
            ) : pageItems.length === 0 ? (
              <tr><td colSpan={7} className="tp-loading">Aucun enseignant trouvé.</td></tr>
            ) : (
              pageItems.map((t) => (
                <tr key={t.id} className="tp-row">
                  <td>
                    <span className="tp-avatar">{initials(t.first_name, t.last_name)}</span>
                  </td>
                  <td>{t.registration_number}</td>
                  <td>
                    <div className="tp-name-cell">
                      {t.first_name} {t.last_name}
                      {t.is_main_teacher && <span className="tp-chip">Professeur principal</span>}
                    </div>
                  </td>
                  <td>{t.subjects.length > 0 ? t.subjects.join(', ') : '—'}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>{t.email ?? '—'}</td>
                  <td>{t.phone ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="tp-pagination">
          <span>Affichage {teachers.length === 0 ? 0 : page * PAGE_SIZE + 1} à {Math.min(teachers.length, (page + 1) * PAGE_SIZE)} sur {teachers.length} enseignants</span>
          <div className="tp-pagination__buttons">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
            {Array.from({ length: pageCount }).slice(0, 5).map((_, i) => (
              <button
                key={i}
                className={i === page ? 'tp-page tp-page--active' : 'tp-page'}
                onClick={() => setPage(i)}
              >
                {i + 1}
              </button>
            ))}
            <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </section>
    </main>
  )
}