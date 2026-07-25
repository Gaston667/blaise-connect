import { ShieldCheck, UserRound } from 'lucide-react'

/**
 * Traduit le rôle technique pour l'interface utilisateur.
 */
function getRoleLabel(role) {
  if (role === 'ADMIN') {
    return 'Administrateur'
  }

  if (role === 'TEACHER') {
    return 'Enseignant'
  }

  return role
}

/**
 * Affiche le premier écran après une authentification réussie.
 */
export default function HomePage({ account }) {
  return (
    <main className="accueil-main">
      <header className="accueil-heading">
        <p className="accueil-eyebrow">Accueil</p>
        <h1 className="accueil-title">Bienvenue sur BlaiseConnect</h1>
        <p className="accueil-description">
          Accédez aux fonctionnalités autorisées depuis le menu principal.
        </p>
      </header>

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
