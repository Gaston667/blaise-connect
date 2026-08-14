import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Pencil, School, Trophy, Users } from 'lucide-react'

import AlertBanner from '../components/feedback/AlertBanner.jsx'
import { useToast } from '../components/feedback/ToastProvider.jsx'
import { getSubjectDetail, updateSubject } from '../services/subject_service.js'
import '../styles/subject_details_page.css'


function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(value))
}


function formatAverage(value) {
  return value === null || value === undefined ? 'Indisponible' : `${Number(value).toFixed(2)} / 20`
}


export default function SubjectDetailsPage({ account, subject, onNavigate }) {
  const canEdit = account?.role === 'ADMIN'
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    is_active: true,
    is_specialty: false,
  })
  const toast = useToast()
  const subjectId = subject?.id

  useEffect(function loadSubjectEffect() {
    loadSubject()
  }, [subjectId])

  async function loadSubject() {
    if (!subjectId) {
      setErrorMessage('Matière introuvable.')
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')
    try {
      const loadedDetails = await getSubjectDetail(subjectId)
      setDetails(loadedDetails)
      setForm({
        name: loadedDetails.name,
        description: loadedDetails.description || '',
        is_active: loadedDetails.is_active,
        is_specialty: loadedDetails.is_specialty,
      })
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  function startEditing() {
    setForm({
      name: details.name,
      description: details.description || '',
      is_active: details.is_active,
      is_specialty: details.is_specialty,
    })
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setErrorMessage('')
  }

  function updateForm(event) {
    const { name, value, type, checked } = event.target
    const fieldValue = type === 'checkbox'
      ? checked
      : name === 'is_active'
        ? value === 'true'
        : value
    setForm(function updateSubjectForm(current) {
      return { ...current, [name]: fieldValue }
    })
  }

  async function saveSubject(event) {
    event.preventDefault()
    if (!form.name.trim()) return

    setSaving(true)
    setErrorMessage('')
    try {
      await updateSubject(subjectId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        is_active: form.is_active,
        is_specialty: form.is_specialty,
      })
      await loadSubject()
      setEditing(false)
      toast.success('La matière a été mise à jour.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  function openClass(classRow) {
    onNavigate('school-class-details', { id: classRow.class_id })
  }

  if (loading) {
    return <main className="sdt-main"><p>Chargement de la matière…</p></main>
  }

  if (!details) {
    return (
      <main className="sdt-main">
        <AlertBanner type="error" message={errorMessage || 'Matière introuvable.'} />
      </main>
    )
  }

  return (
    <main className="sdt-main">
      <header className="sdt-page-header">
        <div>
          <h1>Détails de la matière</h1>
          <nav className="sdt-breadcrumb" aria-label="Fil d’Ariane">
            <button type="button" onClick={() => onNavigate('home')}>Accueil</button>
            <span>›</span>
            <button type="button" onClick={() => onNavigate('subjects')}>Matières</button>
            <span>›</span>
            <span>{details.name}</span>
          </nav>
        </div>
        <button type="button" className="sdt-back-button" onClick={() => onNavigate('subjects')}>
          <ArrowLeft aria-hidden="true" size={18} /> Retour
        </button>
      </header>

      {errorMessage && (
        <AlertBanner type="error" message={errorMessage} onDismiss={() => setErrorMessage('')} />
      )}

      <section className="sdt-information-card">
        <div className="sdt-information-card__header">
          <div className="sdt-subject-title">
            <span className="sdt-subject-icon"><BookOpen aria-hidden="true" size={24} /></span>
            <div>
              <h2>{details.name}</h2>
              <span className={details.is_active ? 'sdt-status sdt-status--active' : 'sdt-status sdt-status--inactive'}>
                {details.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          {canEdit && !editing && (
            <button type="button" className="sdt-edit-button" onClick={startEditing}>
              <Pencil aria-hidden="true" size={16} /> Modifier
            </button>
          )}
        </div>

        {canEdit && editing ? (
          <form className="sdt-edit-form" onSubmit={saveSubject}>
            <label>
              Nom *
              <input name="name" value={form.name} onChange={updateForm} maxLength="100" required />
            </label>
            <label>
              Statut *
              <select name="is_active" value={form.is_active ? 'true' : 'false'} onChange={updateForm}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            <label className="sdt-edit-form__wide">
              Description
              <textarea name="description" value={form.description} onChange={updateForm} rows="3" />
            </label>
            <label className="sdt-edit-form__checkbox sdt-edit-form__wide">
              <input
                type="checkbox"
                name="is_specialty"
                checked={form.is_specialty}
                onChange={updateForm}
              />
              Matiere de specialite
            </label>
            <div className="sdt-edit-form__actions">
              <button type="button" onClick={cancelEditing} disabled={saving}>Annuler</button>
              <button type="submit" className="sdt-primary-button" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        ) : (
          <div className="sdt-information-grid">
            <div><span>Specialite</span><strong>{details.is_specialty ? 'Oui' : 'Non'}</strong></div>
            <div><span>Description</span><strong>{details.description || 'Non renseignée'}</strong></div>
            <div><span>Date de création</span><strong>{formatDate(details.created_at)}</strong></div>
            <div><span>Dernière modification</span><strong>{formatDate(details.updated_at)}</strong></div>
          </div>
        )}
      </section>

      <section className="sdt-summary-grid" aria-label="Résumé de la matière">
        <article>
          <span className="sdt-summary-icon sdt-summary-icon--blue"><School aria-hidden="true" size={22} /></span>
          <div><strong>{details.class_count}</strong><span>Classes associées</span></div>
        </article>
        <article>
          <span className="sdt-summary-icon sdt-summary-icon--green"><Users aria-hidden="true" size={22} /></span>
          <div><strong>{details.teacher_count}</strong><span>Enseignants affectés</span></div>
        </article>
        <article>
          <span className="sdt-summary-icon sdt-summary-icon--gold"><Trophy aria-hidden="true" size={22} /></span>
          <div>
            <strong>{formatAverage(details.best_establishment_average)}</strong>
            <span>Meilleure moyenne de l’établissement</span>
            <small>{details.best_establishment_student_name || 'Aucune moyenne calculable'}</small>
          </div>
        </article>
      </section>

      <section className="sdt-classes-card">
        <header>
          <div>
            <h2>Résultats par classe</h2>
            <p>Configuration de la matière et meilleure moyenne obtenue dans chaque classe.</p>
          </div>
          <span>Moyennes officielles sur 20</span>
        </header>

        <div className="sdt-table-wrapper">
          <table className="sdt-table">
            <thead>
              <tr>
                <th>Classe</th>
                <th>Année scolaire</th>
                <th>Coefficient</th>
                <th>Enseignant</th>
                <th>Meilleure moyenne</th>
              </tr>
            </thead>
            <tbody>
              {details.classes.length === 0 ? (
                <tr><td colSpan="5" className="sdt-empty">Cette matière n’est associée à aucune classe.</td></tr>
              ) : details.classes.map(function renderClassRow(classRow) {
                return (
                  <tr key={classRow.class_id} onClick={() => openClass(classRow)}>
                    <td><strong>{classRow.class_name}</strong><small>{classRow.level_name}</small></td>
                    <td>{classRow.school_year_name}</td>
                    <td>{Number(classRow.coefficient).toFixed(2)}</td>
                    <td>{classRow.teacher_name || 'Non affecté'}</td>
                    <td>{formatAverage(classRow.best_average)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
