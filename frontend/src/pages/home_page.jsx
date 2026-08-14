import {
  CalendarDays,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserRoundX,
} from 'lucide-react'

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

const QUICK_LINKS_BY_ROLE = {
  STUDENT: [
    { page: 'student-grades', label: 'Mes notes', description: 'Consulter mes évaluations et moyennes', icon: NotebookPen, tone: 'violet' },
    { page: 'student-timetable', label: 'Mon emploi du temps', description: 'Voir mes cours de la semaine', icon: CalendarDays, tone: 'blue' },
    { page: 'attendance', label: 'Mes absences', description: 'Suivre mes absences et retards', icon: UserRoundX, tone: 'orange' },
  ],
  TEACHER: [
    { page: 'teacher-timetable', label: 'Mon emploi du temps', description: 'Voir mes cours de la semaine', icon: CalendarDays, tone: 'blue' },
    { page: 'notes', label: 'Notes', description: 'Saisir et consulter les évaluations', icon: NotebookPen, tone: 'violet' },
  ],
}

/**
 * Affiche le premier écran après une authentification réussie.
 */
export default function HomePage({ account, onNavigate }) {
  const quickLinks = QUICK_LINKS_BY_ROLE[account.role] ?? []
  const greetingName = account.first_name || getRoleLabel(account.role).toLowerCase()

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
          Bienvenue sur BlaiseConnect. Accédez aux fonctionnalités autorisées depuis le menu principal.
        </p>
      </header>

      {quickLinks.length > 0 && (
        <section className="accueil-quicklinks">
          {quickLinks.map(function renderQuickLink(link) {
            const Icon = link.icon
            return (
              <button
                key={link.page}
                type="button"
                className={`accueil-quicklink accueil-quicklink--${link.tone}`}
                onClick={() => onNavigate?.(link.page)}
              >
                <span className="accueil-quicklink__icon">
                  <Icon aria-hidden="true" size={22} />
                </span>
                <span className="accueil-quicklink__text">
                  <strong>{link.label}</strong>
                  <span>{link.description}</span>
                </span>
              </button>
            )
          })}
        </section>
      )}

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
    </main>
  )
}
