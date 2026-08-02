import { useEffect, useMemo, useState } from 'react'
import { Search, ShieldCheck, Users, UserX } from 'lucide-react'
import defaultPhoto from '../assets/image_phtoto_default.png'

import { getAdministratorsOverview } from '../services/administrators_overview_service.js'
import { formatProfileName } from '../utils/profileDisplay.js'
import '../styles/administrators_page.css'

const PAGE_SIZE = 6
const STATUS_LABEL = { ACTIVE: 'Actif', INACTIVE: 'Inactif' }
const STATUS_CLASS = { ACTIVE: 'adp-badge--active', INACTIVE: 'adp-badge--inactive' }

function initials(firstName, lastName) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase()
}

const DEFAULT_PHOTO = defaultPhoto

function ProfilePhoto({ photoPath }) {
  return (
    <span className="adp-avatar">
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
    <span className={`adp-badge ${STATUS_CLASS[status] ?? ''}`}>
      <span className="adp-badge__dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default function AdministratorsPage({ onNavigate }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [administrators, setAdministrators] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(function loadAdministratorsEffect() {
    fetchAdministrators()
  }, [])

  useEffect(() => {
    setPage(0)
  }, [query, statusFilter])

  async function fetchAdministrators() {
    setLoading(true)
    try {
      setAdministrators(await getAdministratorsOverview())
      setPage(0)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setQuery('')
    setStatusFilter('')
    setPage(0)
  }

  function openAdministratorDetails(administrator) {
    onNavigate?.('administrator-details', administrator)
  }

  function handleRowKeyDown(event, administrator) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openAdministratorDetails(administrator)
    }
  }

  const filteredAdministrators = useMemo(function filterAdministrators() {
    const normalizedQuery = query.trim().toLowerCase()

    return administrators.filter((administrator) => {
      const identity = `${administrator.first_name} ${administrator.last_name} ${administrator.registration_number}`.toLowerCase()
      const matchesQuery = !normalizedQuery || identity.includes(normalizedQuery)
      const matchesStatus = !statusFilter || administrator.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [query, statusFilter, administrators])

  const stats = useMemo(function calculateAdministratorStats() {
    const active = administrators.filter((administrator) => administrator.status === 'ACTIVE').length
    return {
      total: administrators.length,
      active,
      inactive: administrators.length - active,
    }
  }, [administrators])

  const pageCount = Math.max(1, Math.ceil(filteredAdministrators.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filteredAdministrators.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <main className="adp-main">
      <header className="adp-topbar">
        <h1 className="adp-title">Administrateurs</h1>
        <nav className="adp-breadcrumb" aria-label="Fil d’Ariane">
          <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
          <span>›</span>
          <span aria-current="page">Administrateurs</span>
        </nav>
      </header>

      <section className="adp-stats" aria-label="Résumé des administrateurs">
        <article className="adp-stat-card">
          <span className="adp-stat-icon adp-stat-icon--blue"><Users aria-hidden="true" size={22} /></span>
          <div><span className="adp-stat-label">Total administrateurs</span><strong>{stats.total}</strong></div>
        </article>
        <article className="adp-stat-card">
          <span className="adp-stat-icon adp-stat-icon--green"><ShieldCheck aria-hidden="true" size={22} /></span>
          <div><span className="adp-stat-label">Administrateurs actifs</span><strong>{stats.active}</strong></div>
        </article>
        <article className="adp-stat-card">
          <span className="adp-stat-icon adp-stat-icon--purple"><UserX aria-hidden="true" size={22} /></span>
          <div><span className="adp-stat-label">Administrateurs inactifs</span><strong>{stats.inactive}</strong></div>
        </article>
      </section>

      <form className="adp-filters" onSubmit={(event) => event.preventDefault()}>
        <label className="adp-search">
          <Search className="adp-search__icon" aria-hidden="true" size={18} />
          <input
            type="search"
            aria-label="Rechercher un administrateur"
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
        <button type="button" className="adp-btn-reset" onClick={handleReset}>Réinitialiser</button>
      </form>

      <section className="adp-list">
        <div className="adp-table-wrapper">
          <table className="adp-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Matricule</th>
                <th>Nom et prénom</th>
                <th>Fonction</th>
                <th>Statut</th>
                <th>Email</th>
                <th>Téléphone</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="adp-loading">Chargement…</td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={7} className="adp-loading">Aucun administrateur trouvé.</td></tr>
              ) : (
                pageItems.map((administrator) => (
                  <tr
                    key={administrator.id}
                    className="adp-row"
                    tabIndex="0"
                    onClick={() => openAdministratorDetails(administrator)}
                    onKeyDown={(event) => handleRowKeyDown(event, administrator)}
                    aria-label={`Voir le dossier de ${formatProfileName(administrator.first_name, administrator.last_name, administrator.gender, { fallback: 'cet administrateur' })}`}
                  >
                    <td><ProfilePhoto photoPath={administrator.photo_path} /></td>
                    <td>{administrator.registration_number}</td>
                    <td><strong>{formatProfileName(administrator.first_name, administrator.last_name, administrator.gender)}</strong></td>
                    <td>{administrator.job_title}</td>
                    <td><StatusBadge status={administrator.status} /></td>
                    <td>{administrator.email ?? '—'}</td>
                    <td>{administrator.phone ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="adp-pagination">
          <span>
            Affichage {filteredAdministrators.length === 0 ? 0 : safePage * PAGE_SIZE + 1} à{' '}
            {Math.min(filteredAdministrators.length, (safePage + 1) * PAGE_SIZE)} sur {filteredAdministrators.length} administrateurs
          </span>
          <div className="adp-pagination__buttons">
            <button type="button" disabled={safePage === 0} onClick={() => setPage((current) => current - 1)}>‹</button>
            {Array.from({ length: pageCount }).slice(0, 5).map((_, index) => (
              <button
                type="button"
                key={index}
                className={index === safePage ? 'adp-page adp-page--active' : 'adp-page'}
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
