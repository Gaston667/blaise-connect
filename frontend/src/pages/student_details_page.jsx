import { useEffect, useState } from 'react'
import {
  getStudent,
  updateStudent,
  archiveStudent,
  deactivateStudent,
  reactivateStudent,
  getStudentStatusHistory,
} from '../services/students_service.js'
import '../styles/student_details_page.css'

const STATUS_LABEL = { ACTIVE: 'Actif', INACTIVE: 'Inactif', ARCHIVED: 'Archivé' }
const STATUS_CLASS = { ACTIVE: 'sdp-badge--active', INACTIVE: 'sdp-badge--inactive', ARCHIVED: 'sdp-badge--archived' }

function StatusBadge({ status }) {
  return (
    <span className={`sdp-badge ${STATUS_CLASS[status] ?? ''}`}>
      <span className="sdp-badge__dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

export default function StudentDetailsPage({ student, onNavigate }) {
  const [details, setDetails] = useState(student)
  const [history, setHistory] = useState([])
  const [classes, setClasses] = useState([])
  const [schoolYears, setSchoolYears] = useState([])
  const [activeTab, setActiveTab] = useState('info')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
    // Recharge uniquement lorsque l'élève sélectionné change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id])

  async function load() {
    if (!student?.id) return
    try {
      const [full, hist, yearsRes, classesRes] = await Promise.all([
        getStudent(student.id),
        getStudentStatusHistory(student.id),
        import('../services/school_year_service.js').then((m) => m.getSchoolYears()),
        import('../services/school_class_service.js').then((m) => m.getSchoolClasses()),
      ])
      setDetails(full)
      setHistory(hist)
      setSchoolYears(yearsRes)
      setClasses(classesRes)
      resetForm(full)
    } catch (e) {
      console.error(e)
    }
  }

  function resetForm(d) {
    setForm({
      first_name: d.first_name ?? '',
      last_name: d.last_name ?? '',
      gender: d.gender ?? '',
      birth_date: d.birth_date ?? '',
      birth_place: d.birth_place ?? '',
      nationality: d.nationality ?? '',
      phone: d.phone ?? '',
      email: d.email ?? '',
      address: d.address ?? '',
      previous_level: d.previous_level ?? '',
      admission_date: d.admission_date ?? '',
      observations: d.observations ?? '',
    })
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function className(id) {
    return classes.find((c) => c.id === id)?.name ?? '—'
  }
  function yearName(id) {
    return schoolYears.find((y) => y.id === id)?.name ?? '—'
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
      )
      const updated = await updateStudent(details.id, payload)
      setDetails(updated)
      setEditing(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAction(actionFn) {
    setMenuOpen(false)
    setError('')
    try {
      const updated = await actionFn(details.id)
      setDetails(updated)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!details) return <div className="sdp-main">Élève non trouvé.</div>

  return (
    <main className="sdp-main">
      <nav className="sdp-breadcrumb">
        <button type="button" onClick={() => onNavigate?.('students')}>← Élèves</button>
        <span>›</span>
        <span>Détail de l'élève</span>
      </nav>

      <div className="sdp-header">
        <div className="sdp-header__identity">
          <span className="sdp-avatar">{initials(details.first_name, details.last_name)}</span>
          <div>
            <h1>{details.first_name} {details.last_name}</h1>
            <div className="sdp-header__meta">N° d'identification : {details.registration_number ?? details.account_id}</div>
            <div className="sdp-header__badges">
              <StatusBadge status={details.status} />
              <span className="sdp-chip">{className(details.class_id)}</span>
              <span className="sdp-chip">Année {yearName(details.school_year_id)}</span>
            </div>
          </div>
        </div>

        <div className="sdp-header__actions">
          <button type="button" className="sdp-btn-outline" onClick={() => setEditing((v) => !v)}>
            ✎ {editing ? 'Annuler' : 'Modifier'}
          </button>
          <div className="sdp-menu-wrapper">
            <button type="button" className="sdp-btn-primary" onClick={() => setMenuOpen((v) => !v)}>
              Actions ▾
            </button>
            {menuOpen && (
              <div className="sdp-menu">
                <button onClick={() => handleAction(archiveStudent)} disabled={details.status === 'ARCHIVED'}>
                  🗄 Archiver l'élève
                </button>
                <button onClick={() => handleAction(deactivateStudent)} disabled={details.status !== 'ACTIVE'}>
                  ⏸ Désactiver l'élève
                </button>
                <button onClick={() => handleAction(reactivateStudent)} disabled={details.status === 'ACTIVE'}>
                  ↻ Réactiver l'élève
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="sdp-error">{error}</p>}

      <div className="sdp-body">
        <section className="sdp-content">
          <div className="sdp-tabs">
            <button className={activeTab === 'info' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'} onClick={() => setActiveTab('info')}>Informations personnelles</button>
            <button className={activeTab === 'school' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'} onClick={() => setActiveTab('school')}>Scolarité</button>
            <button className={activeTab === 'guardians' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'} onClick={() => setActiveTab('guardians')}>Responsables légaux</button>
            <button className={activeTab === 'grades' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'} onClick={() => setActiveTab('grades')}>Notes et évaluations</button>
            <button className={activeTab === 'absences' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'} onClick={() => setActiveTab('absences')}>Absences et retards</button>
            <button className={activeTab === 'docs' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'} onClick={() => setActiveTab('docs')}>Documents</button>
          </div>

          {activeTab === 'info' && (
            editing ? (
              <form onSubmit={handleSave} className="sdp-form">
                <h3>Informations personnelles</h3>
                <div className="sdp-row">
                  <label>Nom *<input required value={form.last_name} onChange={(e) => update('last_name', e.target.value)} /></label>
                  <label>Prénom *<input required value={form.first_name} onChange={(e) => update('first_name', e.target.value)} /></label>
                  <label>
                    Sexe
                    <select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                      <option value="">—</option>
                      <option value="F">Féminin</option>
                      <option value="M">Masculin</option>
                    </select>
                  </label>
                </div>
                <div className="sdp-row">
                  <label>Date de naissance<input type="date" value={form.birth_date ?? ''} onChange={(e) => update('birth_date', e.target.value)} /></label>
                  <label>Lieu de naissance<input value={form.birth_place} onChange={(e) => update('birth_place', e.target.value)} /></label>
                  <label>Nationalité<input value={form.nationality} onChange={(e) => update('nationality', e.target.value)} /></label>
                </div>
                <div className="sdp-row">
                  <label>Téléphone<input value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label>
                  <label>Email<input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
                </div>
                <label className="sdp-full">Adresse<input value={form.address} onChange={(e) => update('address', e.target.value)} /></label>

                <h3>Informations complémentaires</h3>
                <div className="sdp-row">
                  <label>Niveau d'étude précédent<input value={form.previous_level} onChange={(e) => update('previous_level', e.target.value)} /></label>
                  <label>Date d'admission<input type="date" value={form.admission_date ?? ''} onChange={(e) => update('admission_date', e.target.value)} /></label>
                </div>
                <label className="sdp-full">
                  Observations
                  <textarea rows={3} value={form.observations} onChange={(e) => update('observations', e.target.value)} />
                </label>

                <div className="sdp-form-actions">
                  <button type="button" className="sdp-btn-outline" onClick={() => { setEditing(false); resetForm(details) }}>Annuler</button>
                  <button type="submit" className="sdp-btn-primary" disabled={saving}>
                    {saving ? 'Enregistrement…' : '💾 Enregistrer les modifications'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="sdp-view">
                <h3>Informations personnelles</h3>
                <dl>
                  <div><dt>Date de naissance</dt><dd>{details.birth_date ?? '—'}</dd></div>
                  <div><dt>Lieu de naissance</dt><dd>{details.birth_place ?? '—'}</dd></div>
                  <div><dt>Sexe</dt><dd>{details.gender ?? '—'}</dd></div>
                  <div><dt>Nationalité</dt><dd>{details.nationality ?? '—'}</dd></div>
                  <div><dt>Téléphone</dt><dd>{details.phone ?? '—'}</dd></div>
                  <div><dt>Email</dt><dd>{details.email ?? '—'}</dd></div>
                  <div><dt>Adresse</dt><dd>{details.address ?? '—'}</dd></div>
                </dl>
                <h3>Informations complémentaires</h3>
                <dl>
                  <div><dt>Niveau d'étude précédent</dt><dd>{details.previous_level ?? '—'}</dd></div>
                  <div><dt>Date d'admission</dt><dd>{details.admission_date ?? '—'}</dd></div>
                  <div><dt>Observations</dt><dd>{details.observations ?? '—'}</dd></div>
                </dl>
              </div>
            )
          )}

          {activeTab === 'school' && (
            <div className="sdp-view">
              <h3>Scolarité</h3>
              <dl>
                <div><dt>Classe actuelle</dt><dd>{className(details.class_id)}</dd></div>
                <div><dt>Année scolaire</dt><dd>{yearName(details.school_year_id)}</dd></div>
                <div><dt>Date d'admission</dt><dd>{details.admission_date ?? '—'}</dd></div>
              </dl>
            </div>
          )}
          {activeTab === 'guardians' && <p className="sdp-placeholder">Aucun responsable renseigné pour le moment.</p>}
          {activeTab === 'grades' && <p className="sdp-placeholder">Notes et évaluations non disponibles pour le moment.</p>}
          {activeTab === 'absences' && <p className="sdp-placeholder">Absences et retards non disponibles pour le moment.</p>}
          {activeTab === 'docs' && <p className="sdp-placeholder">Aucun document pour le moment.</p>}
        </section>

        <aside className="sdp-sidebar">
          <div className="sdp-card">
            <h4>Informations actuelles</h4>
            <div className="sdp-fact"><span>Classe actuelle</span><strong>{className(details.class_id)}</strong></div>
            <div className="sdp-fact"><span>Année scolaire</span><strong>{yearName(details.school_year_id)}</strong></div>
            <div className="sdp-fact"><span>Statut</span><StatusBadge status={details.status} /></div>
            <div className="sdp-fact"><span>Admission</span><strong>{details.admission_date ?? '—'}</strong></div>
            {details.internal_code && (
              <div className="sdp-fact"><span>Code interne</span><strong>{details.internal_code}</strong></div>
            )}
          </div>

          <div className="sdp-card">
            <h4>Historique du statut</h4>
            {history.length === 0 ? (
              <p className="sdp-placeholder">Aucun changement enregistré.</p>
            ) : (
              <ul className="sdp-history">
                {history.map((h, i) => (
                  <li key={i}>
                    <span className={`sdp-dot ${STATUS_CLASS[h.status] ?? ''}`} />
                    <div>
                      <strong>{STATUS_LABEL[h.status] ?? h.status}</strong>
                      <div className="sdp-history__date">
                        {new Date(h.changed_at).toLocaleDateString('fr-FR')} à {new Date(h.changed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="sdp-card">
            <h4>Dernière modification</h4>
            <div className="sdp-fact"><span>👤</span><strong>Administrateur</strong></div>
            <div className="sdp-fact"><span>📅</span><strong>{new Date(details.updated_at).toLocaleString('fr-FR')}</strong></div>
          </div>
        </aside>
      </div>
    </main>
  )
}
