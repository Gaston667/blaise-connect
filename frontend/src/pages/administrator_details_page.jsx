import { useEffect, useState } from 'react'
import { ArrowLeft, Briefcase, CalendarDays, Mail, Phone, UserRound } from 'lucide-react'
import defaultPhoto from '../assets/image_phtoto_default.png'

import { getAdministratorOverview } from '../services/administrators_overview_service.js'
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

export default function AdministratorDetailsPage({ administrator, onNavigate }) {
  const [details, setDetails] = useState(administrator?.first_name ? administrator : null)
  const [loading, setLoading] = useState(!administrator?.first_name)
  const [errorMessage, setErrorMessage] = useState('')

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
      </header>

      <section className="addp-identity">
        <ProfilePhoto photoPath={details.photo_path} />
        <div className="addp-name">
          <h2>{details.first_name} {details.last_name}</h2>
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

      <section className="addp-information">
        <h2>Informations de l’administrateur</h2>
        <div className="addp-information-grid">
          <article>
            <UserRound aria-hidden="true" size={20} />
            <div><span>Nom complet</span><strong>{details.first_name} {details.last_name}</strong></div>
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
            <CalendarDays aria-hidden="true" size={20} />
            <div><span>Date d’embauche</span><strong>{formatDate(details.hire_date)}</strong></div>
          </article>
        </div>
      </section>
    </main>
  )
}
