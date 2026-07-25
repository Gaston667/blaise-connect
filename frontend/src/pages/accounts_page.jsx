import { useEffect, useState } from 'react'
import {
  GraduationCap,
  Plus,
  School,
  ShieldCheck,
  UserRoundCheck,
  UserX,
  UsersRound,
} from 'lucide-react'
import { getAccounts } from '../services/account_service'

function isAdministrator(account) {
  return account.role === 'ADMIN'
}

function isTeacher(account) {
  return account.role === 'TEACHER'
}

function isInactive(account) {
  return !account.is_active || account.archived_at !== null
}

/** Affiche la gestion des comptes de l'US-002. */
export default function AccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(function loadAccountsEffect() {
    async function loadAccounts() {
      try {
        setAccounts(await getAccounts())
      } catch (error) {
        setErrorMessage(error.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadAccounts()
  }, [])

  const administratorCount = accounts.filter(isAdministrator).length
  const teacherCount = accounts.filter(isTeacher).length
  const inactiveCount = accounts.filter(isInactive).length

  return (
    <main className="comptes-main">
      <header className="comptes-heading">
        <div>
          <p className="comptes-breadcrumb">Accueil / Comptes</p>
          <h1 className="comptes-title">Gestion des comptes</h1>
          <p className="comptes-description">
            Consultez et gérez les comptes autorisés dans BlaiseConnect.
          </p>
        </div>
        <button className="comptes-add-button" type="button" disabled>
          <Plus aria-hidden="true" size={19} />
          Ajouter un compte
        </button>
      </header>

      {errorMessage && <p className="comptes-error" role="alert">{errorMessage}</p>}

      <section className="comptes-stats" aria-label="Résumé des comptes">
        <article className="comptes-stat-card">
          <span className="comptes-stat-icon comptes-stat-icon-total">
            <UsersRound aria-hidden="true" size={25} />
          </span>
          <div>
            <strong>{isLoading ? '—' : accounts.length}</strong>
            <h2>Total comptes</h2>
            <p>Tous les utilisateurs</p>
          </div>
        </article>

        <article className="comptes-stat-card">
          <span className="comptes-stat-icon comptes-stat-icon-admin">
            <ShieldCheck aria-hidden="true" size={25} />
          </span>
          <div>
            <strong>{isLoading ? '—' : administratorCount}</strong>
            <h2>Administrateurs</h2>
            <p>Accès complet</p>
          </div>
        </article>

        <article className="comptes-stat-card">
          <span className="comptes-stat-icon comptes-stat-icon-teacher">
            <GraduationCap aria-hidden="true" size={25} />
          </span>
          <div>
            <strong>{isLoading ? '—' : teacherCount}</strong>
            <h2>Enseignants</h2>
            <p>Accès enseignant</p>
          </div>
        </article>

        <article className="comptes-stat-card">
          <span className="comptes-stat-icon comptes-stat-icon-inactive">
            <UserX aria-hidden="true" size={25} />
          </span>
          <div>
            <strong>{isLoading ? '—' : inactiveCount}</strong>
            <h2>Comptes inactifs</h2>
            <p>Désactivés ou archivés</p>
          </div>
        </article>

        <article className="comptes-stat-card">
          <span className="comptes-stat-icon comptes-stat-icon-student">
            <School aria-hidden="true" size={25} />
          </span>
          <div>
            <strong>0</strong>
            <h2>Élèves</h2>
            <p>Interface uniquement</p>
          </div>
        </article>

        <article className="comptes-stat-card">
          <span className="comptes-stat-icon comptes-stat-icon-guardian">
            <UserRoundCheck aria-hidden="true" size={25} />
          </span>
          <div>
            <strong>0</strong>
            <h2>Responsables</h2>
            <p>Interface uniquement</p>
          </div>
        </article>
      </section>

      <section className="comptes-placeholder">
        <span className="comptes-placeholder-icon">
          <UsersRound aria-hidden="true" size={30} />
        </span>
        <h2>Liste des comptes</h2>
        <p>La prochaine étape affichera ici le tableau détaillé des comptes.</p>
      </section>
    </main>
  )
}
