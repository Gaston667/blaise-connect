import { useEffect, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { listStudents } from '../services/students_service.js'
import defaultPhoto from '../assets/image_phtoto_default.png'
import { formatProfileName } from '../utils/profileDisplay.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import '../styles/students_page.css'
const AVATAR_PALETTE = [
  { bg: '#E8ECFB', fg: '#3355DD' },
  { bg: '#FDEBEA', fg: '#D9534F' },
  { bg: '#FFF3DC', fg: '#B8860B' },
  { bg: '#E9F7EF', fg: '#2E9E6B' },
  { bg: '#F3E9FB', fg: '#8E44AD' },
  { bg: '#FCE9F3', fg: '#C2185B' },
]

function avatarStyle(name) {
  const idx = (name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[idx]
}

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

const DEFAULT_PHOTO = defaultPhoto

function ProfilePhoto({ photoPath }) {
  return (
    <span className="sp-avatar">
      <img
        src={photoPath || DEFAULT_PHOTO}
        alt=""
        onError={(e) => { e.currentTarget.src = DEFAULT_PHOTO }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </span>
  )
}

function formatDate(dateValue) {
  if (!dateValue) {
    return '—'
  }

  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${dateValue}T00:00:00`))
}

function genderLabel(gender) {
  if (gender === 'MALE') {
    return 'M'
  }

  if (gender === 'FEMALE') {
    return 'F'
  }

  return '—'
}

const STATUS_LABEL = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  ARCHIVED: 'Archivé',
}

const STATUS_CLASS = {
  ACTIVE: 'sp-badge--active',
  INACTIVE: 'sp-badge--inactive',
  ARCHIVED: 'sp-badge--archived',
}

function StatusBadge({ status }) {
  return (
    <span className={`sp-badge ${STATUS_CLASS[status] ?? ''}`}>
      <span className="sp-badge__dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

const PAGE_SIZE = 10

export default function StudentsPage({ onNavigate }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [classId, setClassId] = useState('')
  const [schoolYearId, setSchoolYearId] = useState('')
  const [students, setStudents] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [classes, setClasses] = useState([])
  const [schoolYears, setSchoolYears] = useState([])
  const debouncedQuery = useDebouncedValue(query)
  const debouncedStatus = useDebouncedValue(status)
  const debouncedClassId = useDebouncedValue(classId)
  const debouncedSchoolYearId = useDebouncedValue(schoolYearId)

  async function fetchStudents(pageIndex = page, overrides = {}) {
    setLoading(true)
    try {
      const data = await listStudents({
        q: 'q' in overrides ? overrides.q || null : query || null,
        status: 'status' in overrides ? overrides.status || null : status || null,
        class_id: 'classId' in overrides ? overrides.classId || null : classId || null,
        school_year_id: 'schoolYearId' in overrides ? overrides.schoolYearId || null : schoolYearId || null,
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
      })
      const rows = Array.isArray(data) ? data : data.items ?? []
      setStudents(rows)
      setTotal(Array.isArray(data) ? rows.length : data.total ?? rows.length)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function fetchInitialData() {
    setLoading(true)
    try {
      const [yearsRes, classesRes] = await Promise.all([
        import('../services/school_year_service.js').then((m) => m.getSchoolYears()),
        import('../services/school_class_service.js').then((m) => m.getSchoolClasses()),
      ])
      setSchoolYears(yearsRes)
      setClasses(classesRes)
      await fetchStudents(0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(function loadInitialDataEffect() {
    Promise.resolve().then(fetchInitialData)
    // Le chargement initial ne doit être exécuté qu'au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchStudents(0, {
      q: debouncedQuery,
      status: debouncedStatus,
      classId: debouncedClassId,
      schoolYearId: debouncedSchoolYearId,
    })
    setPage(0)
  }, [debouncedQuery, debouncedStatus, debouncedClassId, debouncedSchoolYearId])

  function handleReset() {
    setQuery('')
    setStatus('')
    setClassId('')
    setSchoolYearId('')
  }

  function goToPage(next) {
    setPage(next)
    fetchStudents(next)
  }

  function className(id) {
    return classes.find((c) => c.id === id)?.name ?? '—'
  }
  function yearName(id) {
    return schoolYears.find((y) => y.id === id)?.name ?? '—'
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <main className="sp-main">
      <div className="sp-topbar">
        <div>
          <h1 className="sp-title">Élèves</h1>
          <nav className="sp-breadcrumb" aria-label="Fil d’Ariane">
            <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
            <ChevronRight aria-hidden="true" size={14} />
            <span className="sp-breadcrumb-current">Élèves</span>
          </nav>
        </div>
      </div>

      <form className="sp-filters" onSubmit={(event) => event.preventDefault()}>
        <div className="sp-search">
          <Search className="sp-search__icon" aria-hidden="true" size={17} />
          <div>
            <input
              type="search"
              placeholder="Nom, prénom ou matricule..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select value={schoolYearId} onChange={(e) => setSchoolYearId(e.target.value)}>
          <option value="">Toutes les années</option>
          {schoolYears.map((y) => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="INACTIVE">Inactif</option>
          <option value="ARCHIVED">Archivé</option>
        </select>

        <button type="button" className="sp-btn-reset" onClick={handleReset}>
          ⟲ Réinitialiser
        </button>
      </form>

      <div className="sp-body">
        <section className="sp-list">
          <div className="sp-list__meta">
            {loading ? 'Chargement…' : `Total : ${total} élèves`}
          </div>

          <div className="sp-table-wrapper">
            <table className="sp-table">
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Photo</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Sexe</th>
                <th>Classe</th>
                <th>Année scolaire</th>
                <th>Statut</th>
                <th>Date d’inscription</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                return (
                  <tr
                    key={s.id}
                    className="sp-row"
                    onClick={() => onNavigate?.('student-details', s)}
                  >
                    <td className="sp-registration-number">
                      {s.registration_number ?? '—'}
                    </td>
                    <td>
                      <ProfilePhoto photoPath={s.photo_path} />
                    </td>
                    <td>{formatProfileName(s.first_name, s.last_name, s.gender, { fallback: '—' })}</td>
                    <td>{s.first_name ?? '—'}</td>
                    <td>{genderLabel(s.gender)}</td>
                    <td>{s.class_name ?? className(s.class_id)}</td>
                    <td>{s.school_year_name ?? yearName(s.school_year_id)}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>{formatDate(s.admission_date)}</td>
                  </tr>
                )
              })}
            </tbody>
            </table>
          </div>

          <div className="sp-pagination">
            <button disabled={page === 0} onClick={() => goToPage(page - 1)}>‹</button>
            {Array.from({ length: pageCount }).slice(0, 5).map((_, i) => (
              <button
                key={i}
                className={i === page ? 'sp-page sp-page--active' : 'sp-page'}
                onClick={() => goToPage(i)}
              >
                {i + 1}
              </button>
            ))}
            {pageCount > 5 && <span>…</span>}
            <button disabled={page >= pageCount - 1} onClick={() => goToPage(page + 1)}>›</button>
          </div>
        </section>
      </div>
    </main>
  )
}
