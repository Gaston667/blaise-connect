import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, BadgeInfo, Briefcase, CalendarDays, Clock, Mail, MapPin, Pencil, Phone, ShieldCheck, UserRound } from 'lucide-react'
import defaultPhoto from '../assets/image_phtoto_default.png'

import { getAdministratorOverview, updateAdministrator } from '../services/administrators_overview_service.js'
import { formatProfileName } from '../utils/profileDisplay.js'
import { INTERNATIONAL_PHONE_PATTERN, normalizeInternationalPhone } from '../utils/phone.js'
import { uploadAccountPhoto } from '../services/account_service.js'
import '../styles/administrator_details_page.css'

const DEFAULT_PHOTO = defaultPhoto

function ProfilePhoto({ photoPath }) {
  return (
    <span className="addp-avatar">
      <img
        src={photoPath || DEFAULT_PHOTO}
        alt=""
        onError={(e) => { e.currentTarget.src = DEFAULT_PHOTO }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </span>
  )
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function buildForm(details) {
  return {
    first_name: details.first_name ?? '',
    last_name: details.last_name ?? '',
    gender: details.gender ?? '',
    email: details.email ?? '',
    phone: details.phone ?? '',
    address: details.address ?? '',
    job_title: details.job_title ?? '',
  }
}

export default function AdministratorDetailsPage({ administrator, onNavigate }) {
  const [details, setDetails] = useState(administrator?.first_name ? administrator : null)
  const [loading, setLoading] = useState(!administrator?.first_name)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState('personal')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const photoInputRef = useRef(null)

  useEffect(function loadAdministratorDetailsEffect() {
    if (details || !administrator?.id) return

    async function loadAdministrator() {
      try {
        setDetails(await getAdministratorOverview(administrator.id))
      } catch (error) {
        setErrorMessage(error.message)
      } finally {
        setLoading(false)
      }
    }

    loadAdministrator()
  }, [details, administrator?.id])

  function startEditing() {
    setForm(buildForm(details))
    setSaveError('')
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setSaveError('')
  }

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handlePhotoChange(event) {
    const photo = event.target.files?.[0]
    event.target.value = ''
    if (!photo || !details?.account_id) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
      setSaveError('La photo doit être en JPEG, PNG ou WebP et ne pas dépasser 5 Mo.')
      return
    }
    try {
      await uploadAccountPhoto(details.account_id, photo)
      setDetails(await getAdministratorOverview(details.id))
      setSuccessMessage('Photo de l’administrateur mise à jour.')
    } catch (error) {
      setSaveError(error.message)
    }
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const updated = await updateAdministrator(details.id, {
        first_name: form.first_name,
        last_name: form.last_name,
        gender: form.gender || null,
        email: form.email || null,
        phone: form.phone ? normalizeInternationalPhone(form.phone) : null,
        address: form.address || null,
        job_title: form.job_title,
      })
      setDetails(updated)
      setEditing(false)
      setSuccessMessage('Les informations ont été mises à jour avec succès.')
    } catch (error) {
      setSaveError(error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="addp-main"><p>Chargement de l’administrateur…</p></main>
  if (!details) return <main className="addp-main"><p className="addp-error">{errorMessage || 'Administrateur introuvable.'}</p></main>

  return (
    <main className="addp-main">
      <header className="addp-page-header">
        <button type="button" className="addp-back" onClick={() => onNavigate?.('administrators')} aria-label="Retour aux administrateurs">
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div>
          <h1>Dossier de l’administrateur</h1>
          <nav className="addp-breadcrumb" aria-label="Fil d’Ariane">
            <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
            <span>›</span>
            <button type="button" onClick={() => onNavigate?.('administrators')}>Administrateurs</button>
            <span>›</span>
            <span aria-current="page">Détail</span>
          </nav>
        </div>
        {activeTab === 'personal' && !editing && (
          <button type="button" className="addp-edit-button" onClick={startEditing}>
            Modifier
          </button>
        )}
      </header>

      {successMessage && (
        <div className="addp-confirmation" role="status">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage('')} aria-label="Fermer">×</button>
        </div>
      )}

      <section className="addp-identity">
        <div className="addp-photo-wrap"><ProfilePhoto photoPath={details.photo_path} /><input ref={photoInputRef} className="addp-photo-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} /><button type="button" className="addp-photo-edit" onClick={function openPhotoPicker() { photoInputRef.current?.click() }} aria-label="Modifier la photo"><Pencil size={14} /></button></div>
        <div className="addp-name">
          <h2>{formatProfileName(details.first_name, details.last_name, details.gender)}</h2>
          <span className={`adp-badge ${details.status === 'ACTIVE' ? 'adp-badge--active' : 'adp-badge--inactive'}`}>
            <span className="adp-badge__dot" />
            {details.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
          </span>
        </div>
        <dl className="addp-summary">
          <div><dt>Matricule</dt><dd>{details.registration_number}</dd></div>
          <div><dt>Fonction</dt><dd>{details.job_title}</dd></div>
        </dl>
      </section>

      <nav className="addp-tabs" aria-label="Onglets du dossier administrateur">
        <button
          type="button"
          className={activeTab === 'personal' ? 'addp-tab addp-tab--active' : 'addp-tab'}
          onClick={() => setActiveTab('personal')}
        >
          Informations personnelles
        </button>
        <button
          type="button"
          className={activeTab === 'account' ? 'addp-tab addp-tab--active' : 'addp-tab'}
          onClick={() => { setActiveTab('account'); setEditing(false) }}
        >
          Compte
        </button>
      </nav>

      {activeTab === 'personal' && (
        editing ? (
          <section className="addp-information">
            <h2>Modifier les informations</h2>
            <form className="addp-form" onSubmit={handleSave}>
              <div className="addp-form-grid">
                <label>Prénom *<input name="first_name" value={form.first_name} onChange={updateField} maxLength="100" required /></label>
                <label>Nom *<input name="last_name" value={form.last_name} onChange={updateField} maxLength="100" required /></label>
                <label>
                  Sexe
                  <select name="gender" value={form.gender} onChange={updateField}>
                    <option value="">Non renseigné</option>
                    <option value="MALE">Masculin</option>
                    <option value="FEMALE">Féminin</option>
                  </select>
                </label>
                <label>Fonction / Rôle *<input name="job_title" value={form.job_title} onChange={updateField} maxLength="100" required /></label>
                <label>Email<input name="email" type="email" value={form.email} onChange={updateField} maxLength="254" /></label>
                <label>Téléphone<input name="phone" value={form.phone} onChange={updateField} placeholder="+224 610 70 08 00" pattern={INTERNATIONAL_PHONE_PATTERN} title="Exemple : +224 610 70 08 00" inputMode="tel" maxLength="30" /></label>
                <label className="addp-form-wide">Adresse<input name="address" value={form.address} onChange={updateField} /></label>
              </div>

              {saveError && <p className="addp-form-error" role="alert">{saveError}</p>}

              <div className="addp-form-actions">
                <button type="button" className="addp-btn-outline" onClick={cancelEditing}>Annuler</button>
                <button type="submit" className="addp-btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="addp-information">
            <h2>Informations de l’administrateur</h2>
            <div className="addp-information-grid">
              <article>
                <UserRound aria-hidden="true" size={20} />
                <div><span>Nom complet</span><strong>{formatProfileName(details.first_name, details.last_name, details.gender)}</strong></div>
              </article>
              <article>
                <Briefcase aria-hidden="true" size={20} />
                <div><span>Fonction</span><strong>{details.job_title}</strong></div>
              </article>
              <article>
                <Mail aria-hidden="true" size={20} />
                <div><span>Email</span><strong>{details.email ?? 'Non renseigné'}</strong></div>
              </article>
              <article>
                <Phone aria-hidden="true" size={20} />
                <div><span>Téléphone</span><strong>{details.phone ?? 'Non renseigné'}</strong></div>
              </article>
              <article>
                <MapPin aria-hidden="true" size={20} />
                <div><span>Adresse</span><strong>{details.address ?? 'Non renseignée'}</strong></div>
              </article>
              <article>
                <CalendarDays aria-hidden="true" size={20} />
                <div><span>Date d’embauche</span><strong>{formatDate(details.hire_date)}</strong></div>
              </article>
            </div>
          </section>
        )
      )}

      {activeTab === 'account' && (
        <section className="addp-information">
          <h2>Informations du compte</h2>
          <div className="addp-information-grid">
            <article>
              <BadgeInfo aria-hidden="true" size={20} />
              <div><span>Matricule</span><strong>{details.registration_number}</strong></div>
            </article>
            <article>
              <ShieldCheck aria-hidden="true" size={20} />
              <div><span>Statut</span><strong>{details.status === 'ACTIVE' ? 'Actif' : 'Inactif'}</strong></div>
            </article>
            <article>
              <CalendarDays aria-hidden="true" size={20} />
              <div><span>Compte créé le</span><strong>{formatDateTime(details.account_created_at)}</strong></div>
            </article>
            <article>
              <Clock aria-hidden="true" size={20} />
              <div><span>Dernière connexion</span><strong>{formatDateTime(details.last_login_at)}</strong></div>
            </article>
          </div>
        </section>
      )}
    </main>
  )
}
