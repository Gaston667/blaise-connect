import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import defaultPhoto from '../assets/image_phtoto_default.png'
import { getGuardiansOverview } from '../services/guardians_overview_service.js'
import '../styles/guardians_page.css'

const STATUS_LABEL = { ACTIVE: 'Actif', ARCHIVED: 'Archivé' }
const PAGE_SIZE = 10

function guardianStatus(guardian) {
  return guardian.archived_at ? 'ARCHIVED' : 'ACTIVE'
}

function ProfilePhoto({ photoPath, firstName, lastName }) {
  return (
    <span className="glp-avatar">
      <img
        src={photoPath || defaultPhoto}
        alt={`Photo de ${firstName} ${lastName}`}
        onError={(event) => { event.currentTarget.src = defaultPhoto }}
      />
    </span>
  )
}

export default function GuardiansPage({ onNavigate }) {
  const [query, setQuery] = useState('')
  const [guardians, setGuardians] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    loadGuardians()
  }, [])

  async function loadGuardians() {
    setLoading(true)
    try {
      setGuardians(await getGuardiansOverview(query))
      setPage(0)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(event) {
    event.preventDefault()
    loadGuardians()
  }

  function handleReset() {
    setQuery('')
    setTimeout(() => loadGuardians(), 0)
  }

  function openGuardianDetails(guardian) {
    onNavigate?.('guardian-details', guardian)
  }

  const pageItems = guardians.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(guardians.length / PAGE_SIZE))

  return (
    <main className="glp-main">
      <div className="glp-header">
        <div>
          <h1>Responsables légaux</h1>
          <nav className="glp-breadcrumb">
            <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
            <span>›</span>
            <span>Responsables légaux</span>
          </nav>
        </div>
      </div>

      <form className="glp-filters" onSubmit={handleSearch}>
        <label className="glp-search">
          <Search aria-hidden="true" size={18} />
          <input
            type="search"
            placeholder="Nom, prénom, téléphone ou email…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="submit" className="glp-btn-primary">Rechercher</button>
        <button type="button" className="glp-btn-outline" onClick={handleReset}>Réinitialiser</button>
      </form>

      <section className="glp-list-card">
        <div className="glp-list-meta">
          <span>{loading ? 'Chargement…' : `${guardians.length} responsable(s)`}</span>
        </div>

        <div className="glp-table-wrapper">
          <table className="glp-table">
            <thead>
              <tr>
                <th>Responsable</th>
                <th>Téléphone</th>
                <th className="glp-col-desktop">Email</th>
                <th className="glp-col-tablet">Profession</th>
                <th className="glp-col-desktop">Employeur</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((guardian) => {
                const status = guardianStatus(guardian)
                return (
                  <tr
                    key={guardian.id}
                    className="glp-row"
                    tabIndex="0"
                    onClick={() => openGuardianDetails(guardian)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openGuardianDetails(guardian)
                      }
                    }}
                  >
                    <td>
                      <span className="glp-identity">
                        <ProfilePhoto
                          photoPath={guardian.photo_path}
                          firstName={guardian.first_name}
                          lastName={guardian.last_name}
                        />
                        <span>
                          <strong>{guardian.first_name} {guardian.last_name}</strong>
                          <small>{guardian.gender === 'MALE' ? 'Masculin' : guardian.gender === 'FEMALE' ? 'Féminin' : '—'}</small>
                        </span>
                      </span>
                    </td>
                    <td>{guardian.phone ?? '—'}</td>
                    <td className="glp-col-desktop">{guardian.email ?? '—'}</td>
                    <td className="glp-col-tablet">{guardian.occupation ?? '—'}</td>
                    <td className="glp-col-desktop">{guardian.employer ?? '—'}</td>
                    <td>
                      <span className={status === 'ACTIVE' ? 'glp-badge glp-badge--active' : 'glp-badge glp-badge--archived'}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && guardians.length === 0 && (
            <p className="glp-empty">Aucun responsable trouvé.</p>
          )}
        </div>

        <div className="glp-pagination">
          <button type="button" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>‹</button>
          <span>Page {page + 1} / {pageCount}</span>
          <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((current) => current + 1)}>›</button>
        </div>
      </section>
    </main>
  )
}
