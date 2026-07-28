import { useEffect, useState } from 'react'
import { getSchoolClassDetail, updateSchoolClass, deleteSchoolClass } from '../services/school_classes_overview_service.js'
import './../styles/school_class_details_page.css'

const STATUS_LABEL = { ACTIVE: 'Actif', ARCHIVEE: 'Archivée' }
const STATUS_CLASS = { ACTIVE: 'scd-badge--active', ARCHIVEE: 'scd-badge--archived' }

function StatusBadge({ status }) {
  return (
    <span className={`scd-badge ${STATUS_CLASS[status] ?? ''}`}>
      <span className="scd-badge__dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(value))
}

export default function SchoolClassDetailsPage({ schoolClass, onNavigate }) {
  const [details, setDetails] = useState(schoolClass)
  const [activeTab, setActiveTab] = useState('info')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    load()
  }, [schoolClass?.id])

  async function load() {
    if (!schoolClass?.id) return
    try {
      const full = await getSchoolClassDetail(schoolClass.id)
      setDetails(full)
      resetForm(full)
    } catch (e) {
      console.error(e)
    }
  }

  function resetForm(d) {
    setForm({
      group_label: d.group_label ?? '',
      capacity: d.capacity ?? '',
      observations: d.observations ?? '',
    })
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        group_label: form.group_label,
        capacity: form.capacity === '' ? null : Number(form.capacity),
        observations: form.observations === '' ? null : form.observations,
      }
      await updateSchoolClass(details.id, payload)
      setEditing(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setError('')
    try {
      await deleteSchoolClass(details.id)
      onNavigate?.('school-classes')
    } catch (err) {
      setError(err.message)
      setConfirmingDelete(false)
    }
  }

  if (!details) return <div className="scd-main">Classe non trouvée.</div>

  const className = `${details.level_name} ${details.group_label}`
  const fillRate = details.capacity ? Math.round((details.student_count / details.capacity) * 100) : null

  return (
    <main className="scd-main">
      <nav className="scd-breadcrumb">
        <button type="button" onClick={() => onNavigate?.('school-classes')}>← Classes</button>
        <span>›</span>
        <span>{className}</span>
      </nav>

      <div className="scd-header">
        <div>
          <h1>{className}</h1>
          <div className="scd-header__badges">
            <StatusBadge status={details.status} />
          </div>
          <div className="scd-summary-line">
            <span>Année scolaire : {details.school_year_name}</span>
            <span>Niveau : {details.level_name}</span>
            <span>Groupe : {details.group_label}</span>
            <span>Capacité : {details.capacity ?? '—'} élèves</span>
          </div>
        </div>

        <div className="scd-header__actions">
          <button type="button" className="scd-btn-outline" onClick={() => setEditing((v) => !v)}>
            ✎ {editing ? 'Annuler' : 'Modifier'}
          </button>
          <div className="scd-menu-wrapper">
            <button type="button" className="scd-btn-primary" onClick={() => setMenuOpen((v) => !v)}>
              Actions ▾
            </button>
            {menuOpen && (
              <div className="scd-menu">
                <button className="scd-menu__danger" onClick={() => { setMenuOpen(false); setConfirmingDelete(true) }}>
                  🗑 Supprimer la classe
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="scd-error">{error}</p>}

      {confirmingDelete && (
        <div className="scd-confirm-overlay" onClick={() => setConfirmingDelete(false)}>
          <div className="scd-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Supprimer définitivement cette classe ?</h3>
            <p>
              Cette action est irréversible. La suppression sera refusée si des élèves ou des matières
              sont encore rattachés à « {className} ».
            </p>
            <div className="scd-confirm-actions">
              <button type="button" className="scd-btn-outline" onClick={() => setConfirmingDelete(false)}>Annuler</button>
              <button type="button" className="scd-btn-danger" onClick={handleDelete}>Oui, supprimer</button>
            </div>
          </div>
        </div>
      )}

      <div className="scd-body">
        <section className="scd-content">
          <nav className="scd-tabs">
            <button className={activeTab === 'info' ? 'scd-tab scd-tab--active' : 'scd-tab'} onClick={() => setActiveTab('info')}>Informations générales</button>
            <button className={activeTab === 'students' ? 'scd-tab scd-tab--active' : 'scd-tab'} onClick={() => setActiveTab('students')}>Élèves</button>
            <button className={activeTab === 'subjects' ? 'scd-tab scd-tab--active' : 'scd-tab'} onClick={() => setActiveTab('subjects')}>Matières</button>
            <button className={activeTab === 'teacher' ? 'scd-tab scd-tab--active' : 'scd-tab'} onClick={() => setActiveTab('teacher')}>Professeur principal</button>
          </nav>

          {activeTab === 'info' && (
            editing ? (
              <form onSubmit={handleSave} className="scd-form">
                <div className="scd-row">
                  <label>Groupe *<input required value={form.group_label} onChange={(e) => update('group_label', e.target.value)} /></label>
                  <label>Capacité<input type="number" min="1" value={form.capacity} onChange={(e) => update('capacity', e.target.value)} /></label>
                </div>
                <label className="scd-full">
                  Description / Observations
                  <textarea rows={3} value={form.observations} onChange={(e) => update('observations', e.target.value)} />
                </label>
                <div className="scd-form-actions">
                  <button type="button" className="scd-btn-outline" onClick={() => { setEditing(false); resetForm(details) }}>Annuler</button>
                  <button type="submit" className="scd-btn-primary" disabled={saving}>
                    {saving ? 'Enregistrement…' : '💾 Enregistrer'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="scd-info-grid">
                <div className="scd-view">
                  <h3>Informations générales</h3>
                  <dl>
                    <div><dt>Nom de la classe</dt><dd>{className}</dd></div>
                    <div><dt>Niveau</dt><dd>{details.level_name}</dd></div>
                    <div><dt>Groupe</dt><dd>{details.group_label}</dd></div>
                    <div><dt>Année scolaire</dt><dd>{details.school_year_name}</dd></div>
                    <div><dt>Capacité</dt><dd>{details.capacity ?? '—'} élèves</dd></div>
                    <div><dt>Effectif actuel</dt><dd>{details.student_count} élèves</dd></div>
                    <div><dt>Statut</dt><dd><StatusBadge status={details.status} /></dd></div>
                    <div><dt>Date de création</dt><dd>{formatDate(details.created_at)}</dd></div>
                    <div><dt>Dernière modification</dt><dd>{formatDate(details.updated_at)}</dd></div>
                  </dl>
                  {fillRate !== null && (
                    <div className="scd-fill-bar">
                      <div className="scd-fill-bar__track">
                        <div className="scd-fill-bar__fill" style={{ width: `${Math.min(fillRate, 100)}%` }} />
                      </div>
                      <span>{fillRate}%</span>
                    </div>
                  )}
                </div>

                <div className="scd-note-card">
                  <h4>📝 Description / Observations</h4>
                  <p>{details.observations || 'Aucune observation particulière.'}</p>
                </div>
              </div>
            )
          )}

          {activeTab === 'students' && <p className="scd-placeholder">{details.student_count} élève(s) inscrit(s). Consultez la liste depuis « Gestion des élèves » avec le filtre de classe.</p>}
          {activeTab === 'subjects' && <p className="scd-placeholder">{details.subject_count} matière(s) associée(s). Fonctionnalité de gestion à venir.</p>}
          {activeTab === 'teacher' && (
            <div className="scd-teacher-card">
              <span className="scd-avatar">{initials(details.teacher_first_name, details.teacher_last_name)}</span>
              <div>
                <strong>{details.teacher_first_name} {details.teacher_last_name}</strong>
                <div className="scd-teacher-meta">{details.teacher_email ?? 'Email non renseigné'}</div>
                <div className="scd-teacher-meta">{details.teacher_phone ?? 'Téléphone non renseigné'}</div>
              </div>
            </div>
          )}
        </section>

        <aside className="scd-sidebar">
          <div className="scd-card">
            <h4>Professeur principal</h4>
            <div className="scd-teacher-mini">
              <span className="scd-avatar">{initials(details.teacher_first_name, details.teacher_last_name)}</span>
              <div>
                <strong>{details.teacher_first_name} {details.teacher_last_name}</strong>
                <div className="scd-teacher-meta">{details.teacher_email ?? '—'}</div>
                <div className="scd-teacher-meta">{details.teacher_phone ?? '—'}</div>
              </div>
            </div>
          </div>

          <div className="scd-card">
            <h4>Résumé de la classe</h4>
            <div className="scd-stats-grid">
              <div className="scd-stat"><strong>{details.student_count}</strong><span>Élèves inscrits</span></div>
              <div className="scd-stat"><strong>{details.subject_count}</strong><span>Matières</span></div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}