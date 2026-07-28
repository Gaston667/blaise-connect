import { useEffect, useState } from 'react'
import { listStudents, getStudent } from '../services/students_service.js'
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
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [activeTab, setActiveTab] = useState('info')

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchStudents(pageIndex = page) {
    setLoading(true)
    try {
      const data = await listStudents({
        q: query || null,
        status: status || null,
        class_id: classId || null,
        school_year_id: schoolYearId || null,
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
      })
      const rows = Array.isArray(data) ? data : data.items ?? []
      setStudents(rows)
      setTotal(Array.isArray(data) ? rows.length : data.total ?? rows.length)
      if (rows.length && !selected) {
        selectStudent(rows[0])
      }
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

  function handleSearch(e) {
    e.preventDefault()
    setPage(0)
    fetchStudents(0)
  }

  function handleReset() {
    setQuery('')
    setStatus('')
    setClassId('')
    setSchoolYearId('')
    setPage(0)
    setTimeout(() => fetchStudents(0), 0)
  }

  function goToPage(next) {
    setPage(next)
    fetchStudents(next)
  }

  async function selectStudent(s) {
    setSelected(s)
    setActiveTab('info')
    try {
      const full = await getStudent(s.id)
      setDetail(full)
    } catch (e) {
      console.error(e)
      setDetail(s)
    }
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
          <h1 className="sp-title">Gestion des élèves</h1>
          <nav className="sp-breadcrumb">
            <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
            <span>›</span>
            <span>Élèves</span>
          </nav>
        </div>
        <button type="button" className="sp-btn-primary">
          <span className="sp-btn-primary__plus">+</span> Ajouter un élève
        </button>
      </div>

      <form onSubmit={handleSearch} className="sp-filters">
        <div className="sp-search">
          <span className="sp-search__icon">⌕</span>
          <div>
            <input
              type="search"
              placeholder="Rechercher un élève..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="sp-search__hint">Nom, prénom ou n° d'identification</span>
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

        <button type="submit" className="sp-btn-search">Rechercher</button>
        <button type="button" className="sp-btn-reset" onClick={handleReset}>
          ⟲ Réinitialiser
        </button>
      </form>

      <div className="sp-body">
        <section className="sp-list">
          <div className="sp-list__meta">
            {loading ? 'Chargement…' : `Affichage de ${total === 0 ? 0 : page * PAGE_SIZE + 1} à ${Math.min(total, (page + 1) * PAGE_SIZE)} sur ${total} élèves`}
          </div>

          <table className="sp-table">
            <thead>
              <tr>
                <th>Nom et prénom</th>
                <th>N° d'identification</th>
                <th>Classe</th>
                <th>Année scolaire</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const av = avatarStyle(s.last_name)
                const isSelected = selected?.id === s.id
                return (
                  <tr
                    key={s.id}
                    className={isSelected ? 'sp-row sp-row--selected' : 'sp-row'}
                    onClick={() => selectStudent(s)}
                  >
                    <td>
                      <div className="sp-name-cell">
                        <span className="sp-avatar" style={{ background: av.bg, color: av.fg }}>
                          {initials(s.first_name, s.last_name)}
                        </span>
                        {s.first_name} {s.last_name}
                      </div>
                    </td>
                    <td>{s.registration_number ?? s.account_id}</td>
                    <td>{className(s.class_id)}</td>
                    <td>{yearName(s.school_year_id)}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="sp-row__chevron">›</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

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

        <aside className="sp-detail">
          {detail ? (
            <>
              <div className="sp-detail__header">
                <span
                  className="sp-avatar sp-avatar--lg"
                  style={avatarStyle(detail.last_name)}
                >
                  {initials(detail.first_name, detail.last_name)}
                </span>
                <div>
                  <div className="sp-detail__name">
                    {detail.first_name} {detail.last_name}
                    <StatusBadge status={detail.status} />
                  </div>
                  <div className="sp-detail__meta">N° d'identification : {detail.registration_number ?? detail.account_id}</div>
                  <div className="sp-detail__meta">Classe : {className(detail.class_id)}</div>
                  <div className="sp-detail__meta">Année scolaire : {yearName(detail.school_year_id)}</div>
                </div>
              </div>

              <div className="sp-tabs">
                <button className={activeTab === 'info' ? 'sp-tab sp-tab--active' : 'sp-tab'} onClick={() => setActiveTab('info')}>Informations</button>
                <button className={activeTab === 'guardians' ? 'sp-tab sp-tab--active' : 'sp-tab'} onClick={() => setActiveTab('guardians')}>Responsables</button>
                <button className={activeTab === 'path' ? 'sp-tab sp-tab--active' : 'sp-tab'} onClick={() => setActiveTab('path')}>Parcours scolaire</button>
              </div>

              {activeTab === 'info' && (
  <div className="sp-info">
    <h3>Informations personnelles</h3>
    <dl>
      {detail.birth_date && <div><dt>📅 Date de naissance</dt><dd>{detail.birth_date}</dd></div>}
      {detail.gender && <div><dt>⚧ Sexe</dt><dd>{detail.gender}</dd></div>}
      {detail.phone && <div><dt>📞 Téléphone</dt><dd>{detail.phone}</dd></div>}
      {detail.email && <div><dt>✉ Email</dt><dd>{detail.email}</dd></div>}
      {detail.address && <div><dt>🏠 Adresse</dt><dd>{detail.address}</dd></div>}
      {!detail.birth_date && !detail.gender && !detail.phone && !detail.email && !detail.address && (
        <p className="sp-placeholder">Aucune information personnelle renseignée.</p>
      )}
    </dl>

    <h3>Informations scolaires</h3>
    <dl>
      <div><dt>📅 Date d'inscription</dt><dd>{detail.admission_date ?? '—'}</dd></div>
      <div><dt>🏫 Classe actuelle</dt><dd>{className(detail.class_id)}</dd></div>
      <div><dt>⚑ Statut</dt><dd><StatusBadge status={detail.status} /></dd></div>
    </dl>
  </div>
)}

              {activeTab === 'guardians' && <p className="sp-placeholder">Aucun responsable renseigné pour le moment.</p>}
              {activeTab === 'path' && <p className="sp-placeholder">Parcours scolaire non disponible pour le moment.</p>}

              <div className="sp-readonly-note">
                ⓘ Cette fiche est en lecture seule.<br />
                Pour modifier les informations, utilisez les actions disponibles.
              </div>
            </>
          ) : (
            <p className="sp-placeholder">Sélectionnez un élève pour voir sa fiche.</p>
          )}
        </aside>
      </div>
    </main>
  )
}