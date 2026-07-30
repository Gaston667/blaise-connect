import { useEffect, useMemo, useState } from 'react'
import { Search, UserCheck, Users, UserX } from 'lucide-react'
import defaultPhoto from '../assets/image_phtoto_default.png'

import { getTeachersOverview } from '../services/teachers_overview_service.js'
import '../styles/teachers_page.css'

const PAGE_SIZE = 6
const STATUS_LABEL = { ACTIVE: 'Actif', INACTIVE: 'Inactif' }
const STATUS_CLASS = { ACTIVE: 'tp-badge--active', INACTIVE: 'tp-badge--inactive' }

function initials(firstName, lastName) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase()
}

const DEFAULT_PHOTO = defaultPhoto

function ProfilePhoto({ photoPath }) {
  return (
    <span className="tp-avatar">
      <img
        src={photoPath || DEFAULT_PHOTO}
        alt=""
        onError={(e) => { e.currentTarget.src = DEFAULT_PHOTO }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </span>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`tp-badge ${STATUS_CLASS[status] ?? ''}`}>
      <span className="tp-badge__dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default function TeachersPage({ onNavigate }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [hireYearFilter, setHireYearFilter] = useState('')
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(function loadTeachersEffect() {
    fetchTeachers()
  }, [])

  async function fetchTeachers() {
    setLoading(true)
    try {
      setTeachers(await getTeachersOverview())
      setPage(0)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(event) {
    event.preventDefault()
    setPage(0)
  }

  function handleReset() {
    setQuery('')
    setStatusFilter('')
    setHireYearFilter('')
    setPage(0)
  }

  function openTeacherDetails(teacher) {
    onNavigate?.('teacher-details', teacher)
  }

  function handleRowKeyDown(event, teacher) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openTeacherDetails(teacher)
    }
  }

  const hireYears = useMemo(function buildHireYearOptions() {
    return [...new Set(teachers
      .map((teacher) => teacher.hire_date?.slice(0, 4))
      .filter(Boolean))]
      .sort((first, second) => second.localeCompare(first))
  }, [teachers])

  const filteredTeachers = useMemo(function filterTeachers() {
    const normalizedQuery = query.trim().toLowerCase()

    return teachers.filter((teacher) => {
      const identity = `${teacher.first_name} ${teacher.last_name} ${teacher.registration_number}`.toLowerCase()
      const matchesQuery = !normalizedQuery || identity.includes(normalizedQuery)
      const matchesStatus = !statusFilter || teacher.status === statusFilter
      const matchesHireYear = !hireYearFilter || teacher.hire_date?.startsWith(hireYearFilter)
      return matchesQuery && matchesStatus && matchesHireYear
    })
  }, [query, statusFilter, hireYearFilter, teachers])

  const stats = useMemo(function calculateTeacherStats() {
    const active = teachers.filter((teacher) => teacher.status === 'ACTIVE').length
    return {
      total: teachers.length,
      active,
      inactive: teachers.length - active,
    }
  }, [teachers])

  const pageCount = Math.max(1, Math.ceil(filteredTeachers.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filteredTeachers.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <main className="tp-main">
      <header className="tp-topbar">
        <h1 className="tp-title">Enseignants</h1>
        <nav className="tp-breadcrumb" aria-label="Fil d’Ariane">
          <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
          <span>›</span>
          <span aria-current="page">Enseignants</span>
        </nav>
      </header>

      <section className="tp-stats" aria-label="Résumé des enseignants">
        <article className="tp-stat-card">
          <span className="tp-stat-icon tp-stat-icon--blue"><Users aria-hidden="true" size={22} /></span>
          <div><span className="tp-stat-label">Total enseignants</span><strong>{stats.total}</strong></div>
        </article>
        <article className="tp-stat-card">
          <span className="tp-stat-icon tp-stat-icon--green"><UserCheck aria-hidden="true" size={22} /></span>
          <div><span className="tp-stat-label">Enseignants actifs</span><strong>{stats.active}</strong></div>
        </article>
        <article className="tp-stat-card">
          <span className="tp-stat-icon tp-stat-icon--purple"><UserX aria-hidden="true" size={22} /></span>
          <div><span className="tp-stat-label">Enseignants inactifs</span><strong>{stats.inactive}</strong></div>
        </article>
      </section>

      <form onSubmit={handleSearch} className="tp-filters">
        <label className="tp-search">
          <Search className="tp-search__icon" aria-hidden="true" size={18} />
          <input
            type="search"
            aria-label="Rechercher un enseignant"
            placeholder="Nom, prénom ou matricule..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0) }}>
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actifs</option>
          <option value="INACTIVE">Inactifs</option>
        </select>
        <select value={hireYearFilter} onChange={(event) => { setHireYearFilter(event.target.value); setPage(0) }}>
          <option value="">Toutes les années d’embauche</option>
          {hireYears.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <button type="submit" className="tp-btn-search">Rechercher</button>
        <button type="button" className="tp-btn-reset" onClick={handleReset}>Réinitialiser</button>
      </form>

      <section className="tp-list">
        <div className="tp-table-wrapper">
          <table className="tp-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Matricule</th>
                <th>Nom et prénom</th>
                <th>Statut</th>
                <th>Email</th>
                <th>Téléphone</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="tp-loading">Chargement…</td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={6} className="tp-loading">Aucun enseignant trouvé.</td></tr>
              ) : (
                pageItems.map((teacher) => (
                  <tr
                    key={teacher.id}
                    className="tp-row"
                    tabIndex="0"
                    onClick={() => openTeacherDetails(teacher)}
                    onKeyDown={(event) => handleRowKeyDown(event, teacher)}
                    aria-label={`Voir le dossier de ${teacher.first_name} ${teacher.last_name}`}
                  >
                    <td><ProfilePhoto photoPath={teacher.photo_path} /></td>
                    <td>{teacher.registration_number}</td>
                    <td><strong>{teacher.first_name} {teacher.last_name}</strong></td>
                    <td><StatusBadge status={teacher.status} /></td>
                    <td>{teacher.email ?? '—'}</td>
                    <td>{teacher.phone ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="tp-pagination">
          <span>
            Affichage {filteredTeachers.length === 0 ? 0 : safePage * PAGE_SIZE + 1} à{' '}
            {Math.min(filteredTeachers.length, (safePage + 1) * PAGE_SIZE)} sur {filteredTeachers.length} enseignants
          </span>
          <div className="tp-pagination__buttons">
            <button type="button" disabled={safePage === 0} onClick={() => setPage((current) => current - 1)}>‹</button>
            {Array.from({ length: pageCount }).slice(0, 5).map((_, index) => (
              <button
                type="button"
                key={index}
                className={index === safePage ? 'tp-page tp-page--active' : 'tp-page'}
                onClick={() => setPage(index)}
              >
                {index + 1}
              </button>
            ))}
            <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage((current) => current + 1)}>›</button>
          </div>
        </footer>
      </section>
    </main>
  )
}
