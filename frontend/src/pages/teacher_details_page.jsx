import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, Mail, Phone, UserRound } from 'lucide-react'
import defaultPhoto from '../assets/image_phtoto_default.png'

import { getTeacherOverview } from '../services/teachers_overview_service.js'
import '../styles/teacher_details_page.css'

function initials(firstName, lastName) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase()
}

const DEFAULT_PHOTO = defaultPhoto

function ProfilePhoto({ photoPath }) {
  return (
    <span className="tdp-avatar">
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

export default function TeacherDetailsPage({ teacher, onNavigate }) {
  const [details, setDetails] = useState(teacher?.first_name ? teacher : null)
  const [loading, setLoading] = useState(!teacher?.first_name)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(function loadTeacherDetailsEffect() {
    if (details || !teacher?.id) return

    async function loadTeacher() {
      try {
        setDetails(await getTeacherOverview(teacher.id))
      } catch (error) {
        setErrorMessage(error.message)
      } finally {
        setLoading(false)
      }
    }

    loadTeacher()
  }, [details, teacher?.id])

  if (loading) return <main className="tdp-main"><p>Chargement de l’enseignant…</p></main>
  if (!details) return <main className="tdp-main"><p className="tdp-error">{errorMessage || 'Enseignant introuvable.'}</p></main>

  return (
    <main className="tdp-main">
      <header className="tdp-page-header">
        <button type="button" className="tdp-back" onClick={() => onNavigate?.('teachers')} aria-label="Retour aux enseignants">
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div>
          <h1>Dossier de l’enseignant</h1>
          <nav className="tdp-breadcrumb" aria-label="Fil d’Ariane">
            <button type="button" onClick={() => onNavigate?.('home')}>Accueil</button>
            <span>›</span>
            <button type="button" onClick={() => onNavigate?.('teachers')}>Enseignants</button>
            <span>›</span>
            <span aria-current="page">Détail</span>
          </nav>
        </div>
      </header>

      <section className="tdp-identity">
        <ProfilePhoto photoPath={details.photo_path} />
        <div className="tdp-name">
          <h2>{details.first_name} {details.last_name}</h2>
          <span className={`tp-badge ${details.status === 'ACTIVE' ? 'tp-badge--active' : 'tp-badge--inactive'}`}>
            <span className="tp-badge__dot" />
            {details.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
          </span>
        </div>
        <dl className="tdp-summary">
          <div><dt>Matricule</dt><dd>{details.registration_number}</dd></div>
          <div><dt>Date d’embauche</dt><dd>{formatDate(details.hire_date)}</dd></div>
        </dl>
      </section>

      <section className="tdp-information">
        <h2>Informations de l’enseignant</h2>
        <div className="tdp-information-grid">
          <article>
            <UserRound aria-hidden="true" size={20} />
            <div><span>Nom complet</span><strong>{details.first_name} {details.last_name}</strong></div>
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
            <CalendarDays aria-hidden="true" size={20} />
            <div><span>Date d’embauche</span><strong>{formatDate(details.hire_date)}</strong></div>
          </article>
        </div>
      </section>
    </main>
  )
}
