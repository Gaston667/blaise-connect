import { Menu } from 'lucide-react'

/**
 * Affiche l'en-tête de l'espace connecté. L'identité du compte connecté vit
 * désormais dans la sidebar (voir SidebarProfile), plus dans l'en-tête.
 */
export default function AppHeader({
  onMenuOpen,
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
    </header>
  )
}
