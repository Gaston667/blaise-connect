import { useEffect, useState } from 'react'
import {
  BriefcaseBusiness,
  Building2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import defaultPhoto from '../assets/image_phtoto_default.png'
import { getGuardianDetail, updateGuardian } from '../services/guardians_service.js'
import { formatProfileName } from '../utils/profileDisplay.js'
import { INTERNATIONAL_PHONE_PATTERN, normalizeInternationalPhone } from '../utils/phone.js'
import '../styles/guardian_details_page.css'

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

function genderLabel(gender) {
  if (gender === 'MALE') return 'Masculin'
  if (gender === 'FEMALE') return 'Féminin'
  return '—'
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

function formatBirthDateWithAge(value) {
  if (!value) return 'Date non renseignée'
  const birthDate = new Date(`${value}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const birthdayPassed =
    today.getMonth() > birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())
  if (!birthdayPassed) age -= 1
  return `${formatDate(value)}${age >= 0 ? ` (${age} ans)` : ''}`
}

export default function GuardianDetailsPage({ guardian, onNavigate }) {
  const [details, setDetails] = useState(
    guardian ? { ...guardian, students: guardian.students ?? [] } : null,
  )
  const [loading, setLoading] = useState(!guardian?.first_name)
  const [errorMessage, setErrorMessage] = useState('')
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
        phone: normalizeInternationalPhone(form.phone),
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

  const relatedStudents = details.students ?? []
  const emergencyStudents = relatedStudents.filter((student) => student.is_emergency_contact)
  const relationshipSummary = [...new Set(relatedStudents.map((student) => student.relationship_label))]
    .filter(Boolean)
    .join(', ')

  return (
    <main className="gdp-main">
      <nav className="gdp-breadcrumb">
        <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
        <span>›</span>
        <button type="button" onClick={() => onNavigate?.('guardians')}>Responsables</button>
        <span>›</span>
        <span>{formatProfileName(details.first_name, details.last_name, details.gender)}</span>
      </nav>

      <div className="gdp-header">
        <span className="gdp-avatar">
          <img
            src={details.photo_path || DEFAULT_PHOTO}
            alt={`Photo de ${formatProfileName(details.first_name, details.last_name, details.gender, { fallback: 'ce responsable' })}`}
            onError={(event) => { event.currentTarget.src = DEFAULT_PHOTO }}
          />
        </span>
        <div>
          <h1>{formatProfileName(details.first_name, details.last_name, details.gender)}</h1>
          <div className="gdp-header-meta">
            <StatusBadge status={details.archived_at ? 'ARCHIVED' : 'ACTIVE'} />
          </div>
        </div>
      </div>

      {errorMessage && <p className="gdp-error">{errorMessage}</p>}

      <div className="gdp-body">
        <section className="gdp-content gdp-content--main">
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
                <label><span>Téléphone</span><input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+224 610 70 08 00" pattern={INTERNATIONAL_PHONE_PATTERN} title="Exemple : +224 610 70 08 00" inputMode="tel" required /></label>
                <label><span>Email</span><input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
                <label><span>Adresse</span><input value={form.address} onChange={(event) => update('address', event.target.value)} /></label>
                <label><span>Profession</span><input value={form.occupation} onChange={(event) => update('occupation', event.target.value)} /></label>
                <label><span>Employeur</span><input value={form.employer} onChange={(event) => update('employer', event.target.value)} /></label>
              </div>
            </form>
          ) : (
            <>
              <div className="gdp-section-heading">
                <h3>Informations générales</h3>
                <button type="button" className="gdp-btn-outline" onClick={handleEdit}>
                  <Pencil aria-hidden="true" size={16} />
                  Modifier
                </button>
              </div>
              <dl className="gdp-info-list">
                <div><dt><UserRound aria-hidden="true" size={18} />Nom complet</dt><dd>{formatProfileName(details.first_name, details.last_name, details.gender)}</dd></div>
                <div><dt><ShieldCheck aria-hidden="true" size={18} />Genre</dt><dd>{genderLabel(details.gender)}</dd></div>
                <div><dt><MapPin aria-hidden="true" size={18} />Adresse complète</dt><dd>{details.address ?? '—'}</dd></div>
                <div><dt><Phone aria-hidden="true" size={18} />Téléphone</dt><dd>{details.phone ?? '—'}</dd></div>
                <div><dt><Mail aria-hidden="true" size={18} />Email</dt><dd>{details.email ?? '—'}</dd></div>
                <div><dt><BriefcaseBusiness aria-hidden="true" size={18} />Profession</dt><dd>{details.occupation ?? '—'}</dd></div>
                <div><dt><Building2 aria-hidden="true" size={18} />Employeur</dt><dd>{details.employer ?? '—'}</dd></div>
                <div><dt><UsersRound aria-hidden="true" size={18} />Lien avec les élèves</dt><dd>{relationshipSummary || '—'}</dd></div>
              </dl>
            </>
          )}
        </section>

        <aside className="gdp-sidebar">
          <section className="gdp-card gdp-card--summary">
            <h3>Résumé</h3>
            <div className="gdp-stats-grid">
              <article className="gdp-stat-card gdp-stat-card--students">
                <span className="gdp-stat-card__value">{relatedStudents.length}</span>
                <span className="gdp-stat-card__label">Élève(s) rattaché(s)</span>
              </article>
              <article className="gdp-stat-card gdp-stat-card--emergency">
                <span className="gdp-stat-card__value">{emergencyStudents.length}</span>
                <span className="gdp-stat-card__label">Contact(s) d’urgence</span>
              </article>
            </div>
          </section>

          <section className="gdp-card">
            <h3>Élèves rattachés</h3>
            {relatedStudents.length === 0 ? (
              <p className="gdp-placeholder">Aucun élève rattaché à ce responsable.</p>
            ) : (
              <div className="gdp-student-cards">
                {relatedStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className="gdp-student-card"
                    onClick={() => onNavigate?.('student-details', student)}
                  >
                    <span className="gdp-student-photo">
                      <img
                        src={student.photo_path || DEFAULT_PHOTO}
                        alt={`Photo de ${student.first_name} ${student.last_name}`}
                        onError={(event) => { event.currentTarget.src = DEFAULT_PHOTO }}
                      />
                    </span>
                    <span className="gdp-student-card__body">
                      <span className="gdp-student-card__topline">
                        <strong>{student.last_name} {student.first_name}</strong>
                        {student.class_name && <span className="gdp-class-chip">{student.class_name}</span>}
                      </span>
                      <span className="gdp-student-meta">Né le {formatBirthDateWithAge(student.birth_date)}</span>
                      <span className="gdp-student-meta">
                        {student.relationship_label}
                        {student.is_legal_guardian ? ' · Responsable légal' : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

        </aside>
      </div>
    </main>
  )
}
