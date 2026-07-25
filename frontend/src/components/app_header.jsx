import { Menu } from 'lucide-react'

import UserMenu from './user_menu.jsx'

/**
 * Affiche l'en-tête de l'espace connecté.
 */
export default function AppHeader({
  account,
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

      <UserMenu
        account={account}
        onLogoutSuccess={onLogoutSuccess}
      />
    </header>
  )
}
