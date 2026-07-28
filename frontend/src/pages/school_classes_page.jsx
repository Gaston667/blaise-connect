import { useEffect, useState } from 'react'
import { getSchoolYears } from '../services/school_year_service.js'
import { getClassLevels, getTeachers, getSchoolClassesOverview } from '../services/school_classes_overview_service.js'
import '../styles/school_classes_page.css'
const AVATAR_PALETTE = [
  { bg: '#E8ECFB', fg: '#3355DD' },
  { bg: '#FDEBEA', fg: '#D9534F' },
  { bg: '#FFF3DC', fg: '#B8860B' },
  { bg: '#E9F7EF', fg: '#2E9E6B' },
  { bg: '#F3E9FB', fg: '#8E44AD' },
  { bg: '#FCE9F3', fg: '#C2185B' },
]

function levelBadge(name) {
  const idx = (name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[idx]
}

function levelInitials(name, groupLabel) {
  const parts = (name ?? '').replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/)
  const short = parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  return `${short}${groupLabel ?? ''}`
}

const STATUS_LABEL = { ACTIVE: 'Actif', ARCHIVEE: 'Archivée' }
const STATUS_CLASS = { ACTIVE: 'scp-badge--active', ARCHIVEE: 'scp-badge--archived' }

function StatusBadge({ status }) {
  return (
    <span className={`scp-badge ${STATUS_CLASS[status] ?? ''}`}>
      <span className="scp-badge__dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

const PAGE_SIZE = 10

export default function SchoolClassesPage({ onNavigate }) {
  const [query, setQuery] = useState('')
  const [schoolYearId, setSchoolYearId] = useState('')
  const [classLevelId, setClassLevelId] = useState('')
  const [status, setStatus] = useState('')
  const [classes, setClasses] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [schoolYears, setSchoolYears] = useState([])
  const [classLevels, setClassLevels] = useState([])

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchClasses(pageIndex = page) {
    setLoading(true)
    try {
      const data = await getSchoolClassesOverview({
        q: query || null,
        schoolYearId: schoolYearId || null,
        classLevelId: classLevelId || null,
        status: status || null,
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
      })
      setClasses(data)
      setTotal(data.length < PAGE_SIZE && pageIndex === 0 ? data.length : Math.max(data.length, (pageIndex + 1) * PAGE_SIZE))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function fetchInitialData() {
    setLoading(true)
    try {
      const [years, levels] = await Promise.all([getSchoolYears(), getClassLevels()])
      setSchoolYears(years)
      setClassLevels(levels)
      await fetchClasses(0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    setPage(0)
    fetchClasses(0)
  }

  function handleReset() {
    setQuery('')
    setSchoolYearId('')
    setClassLevelId('')
    setStatus('')
    setPage(0)
    setTimeout(() => fetchClasses(0), 0)
  }

  function goToPage(next) {
    setPage(next)
    fetchClasses(next)
  }

  function handleExport() {
    const header = ['Classe', 'Niveau', 'Groupe', 'Année scolaire', 'Professeur principal', 'Élèves', 'Capacité', 'Statut']
    const rows = classes.map((c) => [
      `${c.level_name} ${c.group_label}`,
      c.level_name,
      c.group_label,
      c.school_year_name,
      c.teacher_name,
      c.student_count,
      c.capacity ?? '',
      STATUS_LABEL[c.status] ?? c.status,
    ])
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'classes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <main className="scp-main">
      <div className="scp-topbar">
        <div>
          <h1 className="scp-title">Gestion des classes</h1>
          <nav className="scp-breadcrumb">
            <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
            <span>›</span>
            <span>Classes</span>
          </nav>
        </div>
        <button type="button" className="scp-btn-primary" disabled title="Fonctionnalité à venir">
          <span className="scp-btn-primary__plus">+</span> Ajouter une classe
        </button>
      </div>

      <form onSubmit={handleSearch} className="scp-filters">
        <div className="scp-search">
          <span className="scp-search__icon">⌕</span>
          <div>
            <input
              type="search"
              placeholder="Rechercher une classe..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="scp-search__hint">Nom, niveau ou groupe</span>
          </div>
        </div>

        <select value={schoolYearId} onChange={(e) => setSchoolYearId(e.target.value)}>
          <option value="">Toutes les années</option>
          {schoolYears.map((y) => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </select>

        <select value={classLevelId} onChange={(e) => setClassLevelId(e.target.value)}>
          <option value="">Tous les niveaux</option>
          {classLevels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="ARCHIVEE">Archivée</option>
        </select>

        <button type="submit" className="scp-btn-search">Rechercher</button>
        <button type="button" className="scp-btn-reset" onClick={handleReset}>
          ⟲ Réinitialiser
        </button>
      </form>

      <section className="scp-list">
        <div className="scp-list__meta">
          <span>
            {loading ? 'Chargement…' : `Affichage de ${classes.length === 0 ? 0 : page * PAGE_SIZE + 1} à ${page * PAGE_SIZE + classes.length} classes`}
          </span>
          <button type="button" className="scp-btn-export" onClick={handleExport} disabled={classes.length === 0}>
            ⬇ Exporter
          </button>
        </div>

        <table className="scp-table">
          <thead>
            <tr>
              <th>Classe</th>
              <th>Niveau</th>
              <th>Groupe</th>
              <th>Année scolaire</th>
              <th>Professeur principal</th>
              <th>Élèves</th>
              <th>Capacité</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => {
              const badge = levelBadge(c.level_name)
              return (
                <tr key={c.id} className="scp-row" onClick={() => onNavigate?.('school-class-details', c)}>
                  <td>
                    <div className="scp-name-cell">
                      <span className="scp-avatar" style={{ background: badge.bg, color: badge.fg }}>
                        {levelInitials(c.level_name, c.group_label)}
                      </span>
                      {c.level_name} {c.group_label}
                    </div>
                  </td>
                  <td>{c.level_name}</td>
                  <td>{c.group_label}</td>
                  <td>{c.school_year_name}</td>
                  <td>{c.teacher_name}</td>
                  <td>{c.student_count}</td>
                  <td>{c.capacity ?? '—'}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="scp-row__chevron">›</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="scp-pagination">
          <button disabled={page === 0} onClick={() => goToPage(page - 1)}>‹</button>
          {Array.from({ length: pageCount }).slice(0, 5).map((_, i) => (
            <button
              key={i}
              className={i === page ? 'scp-page scp-page--active' : 'scp-page'}
              onClick={() => goToPage(i)}
            >
              {i + 1}
            </button>
          ))}
          {pageCount > 5 && <span>…</span>}
          <button disabled={page >= pageCount - 1} onClick={() => goToPage(page + 1)}>›</button>
        </div>
      </section>
    </main>
  )
}