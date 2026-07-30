import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import defaultPhoto from '../assets/image_phtoto_default.png'
import { getGuardianDetail, updateGuardian } from '../services/guardians_service.js'
import '../styles/guardian_details_page.css'

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

const DEFAULT_PHOTO = defaultPhoto

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
  const [details, setDetails] = useState(
    guardian ? { ...guardian, students: guardian.students ?? [] } : null,
  )
  const [loading, setLoading] = useState(!guardian?.first_name)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState('personal')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    first_name: guardian?.first_name ?? '',
    last_name: guardian?.last_name ?? '',
    gender: guardian?.gender ?? '',
    phone: guardian?.phone ?? '',
    email: guardian?.email ?? '',
    address: guardian?.address ?? '',
    occupation: guardian?.occupation ?? '',
    employer: guardian?.employer ?? '',
  })

  useEffect(() => {
    setDetails(guardian ? { ...guardian, students: guardian.students ?? [] } : null)
    setForm({
      first_name: guardian?.first_name ?? '',
      last_name: guardian?.last_name ?? '',
      gender: guardian?.gender ?? '',
      phone: guardian?.phone ?? '',
      email: guardian?.email ?? '',
      address: guardian?.address ?? '',
      occupation: guardian?.occupation ?? '',
      employer: guardian?.employer ?? '',
    })
    setErrorMessage('')
    load()
  }, [guardian?.id])

  async function load() {
    if (!guardian?.id) return
    setLoading(true)
    try {
      const data = await getGuardianDetail(guardian.id)
      setDetails(data)
      setForm({
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        gender: data.gender ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        address: data.address ?? '',
        occupation: data.occupation ?? '',
        employer: data.employer ?? '',
      })
      setErrorMessage('')
    } catch (e) {
      setErrorMessage(e.message)
    } finally {
      setLoading(false)
    }
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleEdit() {
    setEditing(true)
  }

  function handleCancelEdit() {
    if (details) {
      setForm({
        first_name: details.first_name ?? '',
        last_name: details.last_name ?? '',
        gender: details.gender ?? '',
        phone: details.phone ?? '',
        email: details.email ?? '',
        address: details.address ?? '',
        occupation: details.occupation ?? '',
        employer: details.employer ?? '',
      })
    }
    setEditing(false)
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!details?.id) return
    setSaving(true)
    setErrorMessage('')
    try {
      const updated = await updateGuardian(details.id, {
        first_name: form.first_name,
        last_name: form.last_name,
        gender: form.gender || null,
        phone: form.phone,
        email: form.email || null,
        address: form.address || null,
        occupation: form.occupation || null,
        employer: form.employer || null,
      })
      setDetails((current) => ({
        ...(current ?? {}),
        ...updated,
        students: current?.students ?? [],
      }))
      setEditing(false)
    } catch (e) {
      setErrorMessage(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="gdp-main">Chargement…</main>
  if (!details) return <main className="gdp-main">{errorMessage || 'Responsable non trouvé.'}</main>

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
        <span className="gdp-avatar">
          <img
            src={details.photo_path || DEFAULT_PHOTO}
            alt={`Photo de ${details.first_name} ${details.last_name}`}
            onError={(event) => { event.currentTarget.src = DEFAULT_PHOTO }}
          />
        </span>
        <div>
          <h1>{details.first_name} {details.last_name}</h1>
          <dl className="gdp-summary">
            <div><dt>Téléphone</dt><dd>{details.phone ?? '—'}</dd></div>
            <div><dt>Email</dt><dd>{details.email ?? '—'}</dd></div>
            <div><dt>Élèves rattachés</dt><dd>{details.students.length}</dd></div>
          </dl>
        </div>
      </div>

      {errorMessage && <p className="gdp-error">{errorMessage}</p>}

      <nav className="gdp-tabs">
        <button
          type="button"
          className={activeTab === 'personal' ? 'gdp-tab gdp-tab--active' : 'gdp-tab'}
          onClick={() => setActiveTab('personal')}
        >
          Informations personnelles
        </button>
        <button
          type="button"
          className={activeTab === 'students' ? 'gdp-tab gdp-tab--active' : 'gdp-tab'}
          onClick={() => setActiveTab('students')}
        >
          Élèves
        </button>
      </nav>

      <div className="gdp-body">
        {activeTab === 'personal' && (
          <section className="gdp-content">
            {editing ? (
              <form className="gdp-form" onSubmit={handleSave}>
                <div className="gdp-section-heading">
                  <h3>Modifier les informations personnelles</h3>
                  <div className="gdp-form-actions">
                    <button type="button" className="gdp-btn-outline" onClick={handleCancelEdit}>Annuler</button>
                    <button type="submit" className="gdp-btn-primary" disabled={saving}>
                      {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
                <div className="gdp-form-grid">
                  <label><span>Nom</span><input value={form.last_name} onChange={(event) => update('last_name', event.target.value)} required /></label>
                  <label><span>Prénom</span><input value={form.first_name} onChange={(event) => update('first_name', event.target.value)} required /></label>
                  <label>
                    <span>Genre</span>
                    <select value={form.gender} onChange={(event) => update('gender', event.target.value)}>
                      <option value="">Non renseigné</option>
                      <option value="MALE">Masculin</option>
                      <option value="FEMALE">Féminin</option>
                    </select>
                  </label>
                  <label><span>Téléphone</span><input value={form.phone} onChange={(event) => update('phone', event.target.value)} required /></label>
                  <label><span>Email</span><input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
                  <label><span>Adresse</span><input value={form.address} onChange={(event) => update('address', event.target.value)} /></label>
                  <label><span>Profession</span><input value={form.occupation} onChange={(event) => update('occupation', event.target.value)} /></label>
                  <label><span>Employeur</span><input value={form.employer} onChange={(event) => update('employer', event.target.value)} /></label>
                </div>
              </form>
            ) : (
              <>
                <div className="gdp-section-heading">
                  <h3>Informations personnelles</h3>
                  <button type="button" className="gdp-btn-outline" onClick={handleEdit}>
                    <Pencil aria-hidden="true" size={16} />
                    Modifier
                  </button>
                </div>
                <dl className="gdp-info-list">
                  <div><dt>Nom</dt><dd>{details.last_name}</dd></div>
                  <div><dt>Prénom</dt><dd>{details.first_name}</dd></div>
                  <div><dt>Genre</dt><dd>{details.gender === 'MALE' ? 'Masculin' : details.gender === 'FEMALE' ? 'Féminin' : '—'}</dd></div>
                  <div><dt>Téléphone</dt><dd>{details.phone ?? '—'}</dd></div>
                  <div><dt>Email</dt><dd>{details.email ?? '—'}</dd></div>
                  <div><dt>Adresse</dt><dd>{details.address ?? '—'}</dd></div>
                  <div><dt>Profession</dt><dd>{details.occupation ?? '—'}</dd></div>
                  <div><dt>Employeur</dt><dd>{details.employer ?? '—'}</dd></div>
                  <div><dt>Statut</dt><dd>{details.archived_at ? 'Archivé' : 'Actif'}</dd></div>
                </dl>
              </>
            )}
          </section>
        )}

        {activeTab === 'students' && (
          <section className="gdp-content">
            <h3>Élèves rattachés</h3>
            {details.students.length === 0 ? (
              <p className="gdp-placeholder">Aucun élève rattaché à ce responsable.</p>
            ) : (
              <div className="gdp-table-wrapper">
                <table className="gdp-table">
                  <thead>
                    <tr>
                      <th>Élève</th>
                      <th>Matricule</th>
                      <th>Lien</th>
                      <th>Classe</th>
                      <th>Année scolaire</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.students.map((student) => (
                      <tr
                        key={student.id}
                        className="gdp-row"
                        tabIndex="0"
                        onClick={() => onNavigate?.('student-details', student)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onNavigate?.('student-details', student)
                          }
                        }}
                      >
                        <td>
                          <strong>{student.first_name} {student.last_name}</strong>
                          {student.is_primary_contact && (
                            <span className="gdp-student-meta">Contact principal</span>
                          )}
                        </td>
                        <td>{student.registration_number ?? '—'}</td>
                        <td>
                          {student.relationship_label}
                          {student.is_legal_guardian ? ' · Responsable légal' : ''}
                        </td>
                        <td>{student.class_name ?? '—'}</td>
                        <td>{student.school_year_name ?? '—'}</td>
                        <td><StatusBadge status={student.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}