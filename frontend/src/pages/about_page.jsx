import {
  ArrowLeft,
  Code2,
  Database,
  Globe2,
  Laptop,
  Terminal,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import logo from '../assets/logo-blaise-connect.png.png'

/**
 * Icône GitHub (absente de lucide-react depuis le retrait des icônes de marques).
 */
function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 2.87-.39c.97.01 1.95.13 2.87.39 2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.73.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

const DEVELOPERS = [
  {
    name: 'Barry Mamadou Hassimiou',
    role: 'Développeur',
    bio: 'Co-développeur de BlaiseConnect, en charge de la conception et de la réalisation de la plateforme de gestion scolaire.',
  },
  {
    name: 'Algassimou Pellel Diallo',
    role: 'Développeur',
    bio: 'Co-développeur de BlaiseConnect, en charge de la conception et de la réalisation de la plateforme de gestion scolaire.',
  },
]

/**
 * Petite carte de visite façon "hero" de portfolio, en miniature, pour Barry.
 */
function BusinessCard() {
  return (
    <div className="business-card-mini">
      <div className="business-card-mini-avatar">BH</div>

      <div className="business-card-mini-body">
        <h3 className="business-card-mini-name">Mamadou Hassimiou BARRY</h3>
        <p className="business-card-mini-status">
          2ᵉ année Informatique · 19 ans · Développeur
        </p>

        <div className="business-card-mini-stack">
          <span className="business-card-mini-icon" title="Développement">
            <Code2 aria-hidden="true" size={15} />
          </span>
          <span className="business-card-mini-icon" title="Terminal">
            <Terminal aria-hidden="true" size={15} />
          </span>
          <span className="business-card-mini-icon" title="Bases de données">
            <Database aria-hidden="true" size={15} />
          </span>
          <span className="business-card-mini-icon" title="Développement web">
            <Laptop aria-hidden="true" size={15} />
          </span>
        </div>

        <div className="business-card-mini-links">
          <a
            className="business-card-mini-link"
            href="https://github.com/hassimiou07"
            target="_blank"
            rel="noreferrer noopener"
          >
            <GithubIcon />
            GitHub
          </a>
          <a
            className="business-card-mini-link"
            href="https://hassimiou07.github.io/Portfolio-Hassimiou/index.html"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Globe2 aria-hidden="true" size={16} />
            Portfolio
          </a>
        </div>
      </div>
    </div>
  )
}

/**
 * Page publique présentant les développeurs de BlaiseConnect.
 */
export default function AboutPage() {
  const navigate = useNavigate()

  return (
    <div className="public-page">
      <header className="public-page-header">
        <button
          className="public-page-back"
          type="button"
          onClick={() => navigate('/login')}
        >
          <ArrowLeft aria-hidden="true" size={19} />
          Retour à la connexion
        </button>

        <div className="public-page-brand">
          <img className="public-page-logo" src={logo} alt="Logo BlaiseConnect" />
        </div>
      </header>

      <main className="public-page-main">
        <section className="public-page-intro" aria-labelledby="about-title">
          <h1 id="about-title" className="public-page-title">À propos de BlaiseConnect</h1>
          <p className="public-page-description">
            BlaiseConnect est une plateforme de gestion scolaire pensée pour simplifier
            le suivi des élèves, des enseignants et de la vie académique au quotidien.
          </p>
        </section>

        <section className="about-developers" aria-label="Équipe de développement">
          {DEVELOPERS.map((developer) => (
            <article className="about-developer-card" key={developer.name}>
              <span className="about-developer-avatar">
                <Code2 aria-hidden="true" size={26} />
              </span>
              <h2 className="about-developer-name">{developer.name}</h2>
              <p className="about-developer-role">{developer.role}</p>
              <p className="about-developer-bio">{developer.bio}</p>

              {developer.name === 'Barry Mamadou Hassimiou' ? (
                <>
                  <p className="about-developer-bio">
                    Passionné d’informatique depuis le collège, je développe des projets
                    web et logiciels par curiosité et par plaisir. Aujourd’hui en 2ᵉ année
                    d’études en informatique, je continue d’apprendre en construisant des
                    applications concrètes comme BlaiseConnect.
                  </p>
                  <BusinessCard />
                </>
              ) : null}
            </article>
          ))}
        </section>

        <section className="about-footer-note">
          <Globe2 aria-hidden="true" size={18} />
          <p>Développé avec soin pour accompagner les établissements scolaires.</p>
        </section>
      </main>
    </div>
  )
}
