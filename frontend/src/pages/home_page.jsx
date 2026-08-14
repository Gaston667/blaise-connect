import { useEffect, useState } from 'react'
import {
  CalendarDays,
  ChevronRight,
  GraduationCap,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserRoundX,
} from 'lucide-react'

import { getMyProfile } from '../services/student_grades_service.js'

/**
 * Traduit le rôle technique pour l'interface utilisateur.
 */
function getRoleLabel(role) {
  if (role === 'ADMIN') return 'Administrateur'
  if (role === 'TEACHER') return 'Enseignant'
  if (role === 'STUDENT') return 'Élève'
  return role
}

/** Message d'accueil variant selon le moment de la journée. */
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

/** Initiales utilisées dans l'avatar rond du profil. */
function getInitials(firstName, lastName) {
  const source = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.trim()
  return source ? source.toUpperCase() : '?'
}

const QUICK_LINKS_BY_ROLE = {
  STUDENT: [
    { page: 'student-grades', label: 'Mes notes', description: 'Consulter mes évaluations et moyennes', icon: NotebookPen, tone: 'violet', hideOnMobile: true },
    { page: 'student-timetable', label: 'Mon emploi du temps', description: 'Voir mes cours de la semaine', icon: CalendarDays, tone: 'blue', hideOnMobile: true },
    { page: 'attendance', label: 'Mes absences', description: 'Suivre mes absences et retards', icon: UserRoundX, tone: 'orange', hideOnMobile: false },
  ],
  TEACHER: [
    { page: 'teacher-timetable', label: 'Mon emploi du temps', description: 'Voir mes cours de la semaine', icon: CalendarDays, tone: 'blue' },
    { page: 'notes', label: 'Notes', description: 'Saisir et consulter les évaluations', icon: NotebookPen, tone: 'violet' },
  ],
}

/**
 * Carte de profil dédiée à l'élève : avatar, classe et année scolaire.
 * Remplace les cartes génériques "compte / session" sur cet écran.
 */
function StudentProfileCard({ account, profile }) {
  return (
    <article className="accueil-profile-card">
      <span className="accueil-profile-card__avatar">
        {getInitials(account.first_name, account.last_name)}
      </span>
      <div className="accueil-profile-card__body">
        <strong>{account.first_name} {account.last_name}</strong>
        <span className="accueil-profile-card__meta">
          <GraduationCap aria-hidden="true" size={14} />
          {profile?.class_name ?? 'Classe non renseignée'}
          {profile?.school_year_name ? ` · ${profile.school_year_name}` : ''}
        </span>
        <span className="accueil-profile-card__registration">Matricule {account.registration_number}</span>
      </div>
    </article>
  )
}

/**
 * Affiche le premier écran après une authentification réussie.
 */
export default function HomePage({ account, onNavigate }) {
  const [studentProfile, setStudentProfile] = useState(null)
  const quickLinks = QUICK_LINKS_BY_ROLE[account.role] ?? []
  const isStudent = account.role === 'STUDENT'
  const greetingName = account.first_name || getRoleLabel(account.role).toLowerCase()

  useEffect(function loadStudentProfileEffect() {
    if (!isStudent) return
    let isCancelled = false
    getMyProfile()
      .then(function applyProfile(data) {
        if (!isCancelled) setStudentProfile(data)
      })
      .catch(function ignoreProfileError() {
        // La carte de profil reste simplement moins détaillée.
      })
    return function cancelEffect() {
      isCancelled = true
    }
  }, [isStudent])

  return (
    <main className="accueil-main">
      <header className="accueil-hero">
        <p className="accueil-eyebrow">
          <Sparkles aria-hidden="true" size={15} /> Accueil
        </p>
        <h1 className="accueil-title">
          {getGreeting()}, {greetingName} !
        </h1>
        <p className="accueil-description">
          {isStudent
            ? 'Retrouvez vos notes, votre emploi du temps et vos absences en un coup d’œil.'
            : 'Bienvenue sur BlaiseConnect. Accédez aux fonctionnalités autorisées depuis le menu principal.'}
        </p>
      </header>

      {isStudent && (
        <section className="accueil-profile-section">
          <StudentProfileCard account={account} profile={studentProfile} />
        </section>
      )}

      {quickLinks.length > 0 && (
        <section className="accueil-quicklinks">
          {quickLinks.map(function renderQuickLink(link) {
            const Icon = link.icon
            return (
              <button
                key={link.page}
                type="button"
                className={`accueil-quicklink accueil-quicklink--${link.tone}${link.hideOnMobile ? ' accueil-quicklink--hide-on-mobile' : ''}`}
                onClick={() => onNavigate?.(link.page)}
              >
                <span className="accueil-quicklink__icon">
                  <Icon aria-hidden="true" size={22} />
                </span>
                <span className="accueil-quicklink__text">
                  <strong>{link.label}</strong>
                  <span>{link.description}</span>
                </span>
                <ChevronRight aria-hidden="true" size={18} className="accueil-quicklink__chevron" />
              </button>
            )
          })}
        </section>
      )}

      {!isStudent && (
        <section className="accueil-grid">
          <article className="accueil-card">
            <span className="accueil-card-icon">
              <UserRound aria-hidden="true" size={26} />
            </span>
            <h2>Votre compte</h2>
            <p>{account.registration_number}</p>
            <strong>{getRoleLabel(account.role)}</strong>
          </article>

          <article className="accueil-card">
            <span className="accueil-card-icon">
              <ShieldCheck aria-hidden="true" size={26} />
            </span>
            <h2>Session sécurisée</h2>
            <p>Votre session expire après 15 minutes sans activité.</p>
          </article>
        </section>
      )}
    </main>
  )
}
