import { Menu } from 'lucide-react'

import ChildSwitcher from './child_switcher.jsx'
import HeaderUserMenu from './header_user_menu.jsx'

/**
 * Affiche l'en-tête de l'espace connecté : menu (mobile), enfant consulté
 * (portail parents) et, en haut à droite, le compte connecté avec sa déconnexion.
 */
export default function AppHeader({
  account,
  currentPage,
  onMenuOpen,
  onLogoutSuccess,
}) {
  return (
    <header className="layout-header">
      <button
        className="layout-menu-button"
        type="button"
        onClick={onMenuOpen}
        aria-label="Ouvrir le menu"
      >
        <Menu aria-hidden="true" size={23} />
      </button>
      {/* Sur l'accueil du portail parents, le sélecteur est dans le bandeau de bienvenue. */}
      {currentPage === 'home' ? null : <ChildSwitcher />}
      <HeaderUserMenu account={account} onLogoutSuccess={onLogoutSuccess} />
    </header>
  )
}
