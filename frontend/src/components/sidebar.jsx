import { CalendarRange, House, UsersRound, X } from 'lucide-react'
import logo from '../assets/logo-blaise-connect.png.png'
import LogoutButton from './logout_button.jsx'


/**
 * Affiche la navigation principale de l'espace connecté.
 */
export default function Sidebar({
  account,
  currentPage,
  isOpen,
  onClose,
  onNavigate,
  onLogoutSuccess,
}) {
  const canManageAccounts = account.role === 'ADMIN'

  /**
   * Affiche la page choisie puis ferme le menu mobile.
   */
  function handleNavigation(event) {
    onNavigate(event.currentTarget.dataset.page)
    onClose()
  }

  return (
    <aside
      className={
        isOpen
          ? 'layout-sidebar layout-sidebar-open'
          : 'layout-sidebar'
      }
    >
      <div className="layout-sidebar-brand">
        <img
          className="layout-logo"
          src={logo}
          alt="Logo BlaiseConnect"
        />

        <button
          className="layout-sidebar-close"
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu"
        >
          <X aria-hidden="true" size={22} />
        </button>
      </div>

      <nav
        className="layout-navigation"
        aria-label="Navigation principale"
      >
        <button
          className={
            currentPage === 'home'
              ? 'layout-navigation-item layout-navigation-item-active'
              : 'layout-navigation-item'
          }
          type="button"
          data-page="home"
          onClick={handleNavigation}
        >
          <House aria-hidden="true" size={20} />
          Accueil
        </button>

       {canManageAccounts ? (
          <button
            className={
              currentPage === 'accounts' || currentPage === 'account-details'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="accounts"
            onClick={handleNavigation}
          >
            <UsersRound aria-hidden="true" size={20} />
            Gestion des comptes
          </button>
        ) : null}

        {canManageAccounts ? (
          <button
            className={
              currentPage === 'school-years'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="school-years"
            onClick={handleNavigation}
          >
            <CalendarRange aria-hidden="true" size={20} />
            Années scolaires
          </button>
        ) : null}
      </nav>

      <LogoutButton onLogoutSuccess={onLogoutSuccess} />
    </aside>
  )
}
