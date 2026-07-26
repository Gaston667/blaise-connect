import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Plus,
  School,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserX,
  UsersRound,
} from 'lucide-react'
import { getAccounts } from '../services/account_service'

const PAGE_SIZE = 10
const STATS_PER_SLIDE = 3

const ROLE_OPTIONS = [
  { value: 'ALL', label: 'Toutes les rôles' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'TEACHER', label: 'Enseignant' },
  { value: 'STUDENT', label: 'Élève' },
  { value: 'GUARDIAN', label: 'Responsable' },
]

const ROLE_LABELS = {
  ADMIN: 'Administrateur',
  TEACHER: 'Enseignant',
  STUDENT: 'Élève',
  GUARDIAN: 'Responsable',
}

const ROLE_BADGE_CLASSES = {
  ADMIN: 'comptes-role-badge-admin',
  TEACHER: 'comptes-role-badge-teacher',
  STUDENT: 'comptes-role-badge-student',
  GUARDIAN: 'comptes-role-badge-guardian',
}

function isAdministrator(account) {
  return account.role === 'ADMIN'
}

function isTeacher(account) {
  return account.role === 'TEACHER'
}

function isStudent(account) {
  return account.role === 'STUDENT'
}

function isGuardian(account) {
  return account.role === 'GUARDIAN'
}

function isInactive(account) {
  return !account.is_active || account.archived_at !== null
}

function getInitials(registrationNumber) {
  if (!registrationNumber) return '?'
  return registrationNumber.slice(0, 2).toUpperCase()
}

function getFullName(account) {
  const fullName = [account.last_name, account.first_name]
    .filter(Boolean)
    .join(' ')

  return fullName || 'Non renseigné'
}

function formatDate(dateValue) {
  if (!dateValue) return '—'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR')
}

/** Construit la liste des pages à afficher, avec des '...' pour les longues listes. */
function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = [1]
  if (currentPage > 3) pages.push('…')

  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)
  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  if (currentPage < totalPages - 2) pages.push('…')
  pages.push(totalPages)

  return pages
}

/** Découpe un tableau en groupes de `size` éléments, pour le carrousel de stats. */
function chunkArray(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/** Affiche la gestion des comptes de l'US-002. */
export default function AccountsPage({ onNavigate }) {
  const [accounts, setAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [statsSlide, setStatsSlide] = useState(0)

  useEffect(function loadAccountsEffect() {
    async function loadAccounts() {
      try {
        setAccounts(await getAccounts())
      } catch (error) {
        setErrorMessage(error.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadAccounts()
  }, [])

  function handleAccountClick(event) {
    const selectedId = event.currentTarget.dataset.accountId
    const selectedAccount = accounts.find(function findSelectedAccount(account) {
      return account.id === selectedId
    })

    if (selectedAccount) {
      onNavigate('account-details', selectedAccount)
    }
  }

  function handleAccountKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleAccountClick(event)
    }
  }

  function handleSearchChange(event) {
    setSearchQuery(event.target.value)
    setCurrentPage(1)
  }

  function handleRoleFilterChange(event) {
    setRoleFilter(event.target.value)
    setCurrentPage(1)
  }

  function handleHomeNavigation() {
    onNavigate('home')
  }

  function handleAccountsNavigation() {
    onNavigate('accounts')
  }

  const administratorCount = accounts.filter(isAdministrator).length
  const teacherCount = accounts.filter(isTeacher).length
  const studentCount = accounts.filter(isStudent).length
  const guardianCount = accounts.filter(isGuardian).length
  const inactiveCount = accounts.filter(isInactive).length

  const filteredAccounts = useMemo(function filterAccounts() {
    const query = searchQuery.trim().toLowerCase()

    return accounts.filter((account) => {
      const matchesRole = roleFilter === 'ALL' || account.role === roleFilter
      if (!matchesRole) return false

      if (!query) return true

      const registrationNumber = (
        account.registration_number || ''
      ).toLowerCase()
      const fullName = getFullName(account).toLowerCase()

      return registrationNumber.includes(query) || fullName.includes(query)
    })
  }, [accounts, searchQuery, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE
  const paginatedAccounts = filteredAccounts.slice(pageStart, pageStart + PAGE_SIZE)

  const statCards = [
    {
      key: 'total',
      icon: <UsersRound aria-hidden="true" size={25} />,
      iconClass: 'comptes-stat-icon-total',
      value: isLoading ? '—' : accounts.length,
      label: 'Total comptes',
      description: 'Tous les utilisateurs',
    },
    {
      key: 'admin',
      icon: <ShieldCheck aria-hidden="true" size={25} />,
      iconClass: 'comptes-stat-icon-admin',
      value: isLoading ? '—' : administratorCount,
      label: 'Administrateurs',
      description: 'Accès complet',
    },
    {
      key: 'teacher',
      icon: <GraduationCap aria-hidden="true" size={25} />,
      iconClass: 'comptes-stat-icon-teacher',
      value: isLoading ? '—' : teacherCount,
      label: 'Enseignants',
      description: 'Accès enseignant',
    },
    {
      key: 'inactive',
      icon: <UserX aria-hidden="true" size={25} />,
      iconClass: 'comptes-stat-icon-inactive',
      value: isLoading ? '—' : inactiveCount,
      label: 'Comptes inactifs',
      description: 'Désactivés ou archivés',
    },
    {
      key: 'student',
      icon: <School aria-hidden="true" size={25} />,
      iconClass: 'comptes-stat-icon-student',
      value: isLoading ? '—' : studentCount,
      label: 'Élèves',
      description: 'Comptes élèves',
    },
    {
      key: 'guardian',
      icon: <UserRoundCheck aria-hidden="true" size={25} />,
      iconClass: 'comptes-stat-icon-guardian',
      value: isLoading ? '—' : guardianCount,
      label: 'Responsables',
      description: 'Comptes responsables',
    },
  ]

  const statsSlides = chunkArray(statCards, STATS_PER_SLIDE)
  const safeStatsSlide = Math.min(statsSlide, statsSlides.length - 1)

  return (
    <main className="comptes-main">
      <header className="comptes-heading">
        <div>
          <nav className="comptes-breadcrumb" aria-label="Fil d’Ariane">
            <button type="button" onClick={handleHomeNavigation}>
              Accueil
            </button>
            <ChevronRight aria-hidden="true" size={14} />
            <button
              type="button"
              className="comptes-breadcrumb-current"
              onClick={handleAccountsNavigation}
              aria-current="page"
            >
              Comptes
            </button>
          </nav>
          <h1 className="comptes-title">Gestion des comptes</h1>
          <p className="comptes-description">
            Consultez et gérez les comptes autorisés dans BlaiseConnect.
          </p>
        </div>
        <button className="comptes-add-button" type="button" disabled>
          <Plus aria-hidden="true" size={19} />
          Ajouter un compte
        </button>
      </header>

      {errorMessage && <p className="comptes-error" role="alert">{errorMessage}</p>}

      <section className="comptes-stats-carousel" aria-label="Résumé des comptes">
        <div className="comptes-stats-carousel-header">
          <button
            type="button"
            className="comptes-stats-nav-button"
            onClick={() => setStatsSlide((slide) => Math.max(0, slide - 1))}
            disabled={safeStatsSlide === 0}
            aria-label="Statistiques précédentes"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>

          <div className="comptes-stats-dots">
            {statsSlides.map((_, index) => (
              <button
                key={index}
                type="button"
                className={`comptes-stats-dot ${
                  index === safeStatsSlide ? 'comptes-stats-dot-active' : ''
                }`}
                onClick={() => setStatsSlide(index)}
                aria-label={`Aller au groupe de statistiques ${index + 1}`}
                aria-current={index === safeStatsSlide}
              />
            ))}
          </div>

          <button
            type="button"
            className="comptes-stats-nav-button"
            onClick={() =>
              setStatsSlide((slide) => Math.min(statsSlides.length - 1, slide + 1))
            }
            disabled={safeStatsSlide === statsSlides.length - 1}
            aria-label="Statistiques suivantes"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="comptes-stats-track-wrapper">
          <div
            className="comptes-stats-track"
            style={{ transform: `translateX(-${safeStatsSlide * 100}%)` }}
          >
            {statsSlides.map((slide, slideIndex) => (
              <div className="comptes-stats-slide" key={slideIndex}>
                {slide.map((card) => (
                  <article className="comptes-stat-card" key={card.key}>
                    <span className={`comptes-stat-icon ${card.iconClass}`}>
                      {card.icon}
                    </span>
                    <div>
                      <strong>{card.value}</strong>
                      <h2>{card.label}</h2>
                      <p>{card.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="comptes-list" aria-label="Liste des comptes">
        <div className="comptes-toolbar">
          <div className="comptes-search-wrapper">
            <Search aria-hidden="true" size={18} className="comptes-search-icon" />
            <input
              type="search"
              className="comptes-search-input"
              placeholder="Rechercher un compte…"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          <div className="comptes-filter-wrapper">
            <select
              className="comptes-filter-select"
              value={roleFilter}
              onChange={handleRoleFilterChange}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={16} className="comptes-filter-icon" />
          </div>
        </div>

        {isLoading ? (
          <p className="comptes-table-status">Chargement des comptes…</p>
        ) : filteredAccounts.length === 0 ? (
          <div className="comptes-empty-state">
            <UsersRound aria-hidden="true" size={28} />
            <p>Aucun compte ne correspond à votre recherche.</p>
          </div>
        ) : (
          <>
            <div className="comptes-table-wrapper">
              <table className="comptes-table">
                <thead>
                  <tr>
                    <th>Identifiant</th>
                    <th>Nom et prénom</th>
                    <th>Rôle</th>
                    <th>Statut</th>
                    <th>Date de création</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAccounts.map((account) => {
                    const inactive = isInactive(account)
                    return (
                      <tr
                        key={account.id}
                        data-account-id={account.id}
                        className="comptes-table-row-clickable"
                        onClick={handleAccountClick}
                        role="button"
                        tabIndex={0}
                        onKeyDown={handleAccountKeyDown}
                      >
                        <td>
                          <div className="comptes-table-identity">
                            <span className="comptes-table-avatar">
                              {getInitials(account.registration_number)}
                            </span>
                            <span>{account.registration_number || '—'}</span>
                          </div>
                        </td>
                        <td>{getFullName(account)}</td>
                        <td>
                          <span
                            className={`comptes-role-badge ${
                              ROLE_BADGE_CLASSES[account.role] || ''
                            }`}
                          >
                            {ROLE_LABELS[account.role] || account.role}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`comptes-status ${
                              inactive ? 'comptes-status-inactive' : 'comptes-status-active'
                            }`}
                          >
                            <span className="comptes-status-dot" aria-hidden="true" />
                            {inactive ? 'Inactif' : 'Actif'}
                          </span>
                        </td>
                        <td>{formatDate(account.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="comptes-pagination">
              <p className="comptes-pagination-info">
                Affichage de {pageStart + 1} à{' '}
                {Math.min(pageStart + PAGE_SIZE, filteredAccounts.length)} sur{' '}
                {filteredAccounts.length} comptes
              </p>

              <div className="comptes-pagination-controls">
                <button
                  type="button"
                  className="comptes-pagination-button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                  aria-label="Page précédente"
                >
                  <ChevronLeft aria-hidden="true" size={16} />
                </button>

                {getPageNumbers(safeCurrentPage, totalPages).map((page, index) =>
                  page === '…' ? (
                    <span key={`ellipsis-${index}`} className="comptes-pagination-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      className={`comptes-pagination-button ${
                        page === safeCurrentPage ? 'comptes-pagination-button-active' : ''
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  type="button"
                  className="comptes-pagination-button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                  aria-label="Page suivante"
                >
                  <ChevronRight aria-hidden="true" size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

    </main>
  )
}
