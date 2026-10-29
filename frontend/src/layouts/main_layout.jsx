import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import AppHeader from '../components/app_header.jsx'
import MobileBottomNav from '../components/mobile_bottom_nav.jsx'
import Sidebar from '../components/sidebar.jsx'

const COLLAPSED_STORAGE_KEY = 'blaise.sidebarCollapsed'

/** Lit le choix mémorisé (menu masqué), sans jamais échouer si le stockage est bloqué. */
function readCollapsedPreference() {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Assemble la navigation et le contenu de l'espace connecté.
 */
export default function MainLayout({
  account,
  children,
  currentPage,
  onNavigate,
  onLogoutSuccess,
  onStartTour,
  isTourActive,
}) {
  const [isSidebarOpenState, setIsSidebarOpen] = useState(false)
  // Sur ordinateur, le menu peut être masqué pour gagner de la place (choix mémorisé).
  const [isSidebarCollapsedState, setIsSidebarCollapsed] = useState(readCollapsedPreference)
  // Sur téléphone, la sidebar est repliée par défaut : pendant la visite
  // guidée, on la force ouverte pour que le halo pointe vers un élément
  // réellement visible à l'écran, au lieu de rester caché derrière le menu.
  const isSidebarOpen = isTourActive || isSidebarOpenState

  /**
   * Ouvre le menu sur téléphone.
   */
  function handleSidebarOpen() {
    setIsSidebarOpen(true)
  }

  /**
   * Ferme le menu sur téléphone.
   */
  function handleSidebarClose() {
    setIsSidebarOpen(false)
  }

  const hasMobileBottomNav = Boolean(account?.role)
  const isSidebarCollapsed = isSidebarCollapsedState && !isTourActive

  /**
   * Masque ou affiche le menu latéral sur ordinateur et mémorise le choix.
   */
  function toggleSidebarCollapsed() {
    setIsSidebarCollapsed(function toggle(current) {
      const next = !current
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Stockage indisponible : le choix vaut seulement pour cette session.
      }
      return next
    })
  }

  return (
    <div
      className={[
        'layout-page',
        hasMobileBottomNav ? 'layout-page--has-bottom-nav' : '',
        isSidebarCollapsed ? 'layout-page--collapsed' : '',
      ].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className={isSidebarCollapsed ? 'layout-sidebar-toggle layout-sidebar-toggle--collapsed' : 'layout-sidebar-toggle'}
        onClick={toggleSidebarCollapsed}
        aria-label={isSidebarCollapsed ? 'Afficher le menu' : 'Masquer le menu'}
        title={isSidebarCollapsed ? 'Afficher le menu' : 'Masquer le menu'}
        aria-pressed={isSidebarCollapsed}
      >
        {isSidebarCollapsed ? <PanelLeftOpen aria-hidden="true" size={20} /> : <PanelLeftClose aria-hidden="true" size={20} />}
      </button>
      <Sidebar
        account={account}
        currentPage={currentPage}
        isOpen={isSidebarOpen}
        onClose={handleSidebarClose}
        onNavigate={onNavigate}
        onLogoutSuccess={onLogoutSuccess}
        onStartTour={onStartTour}
      />

      {isSidebarOpen && !isTourActive ? (
        <button
          className="layout-overlay"
          type="button"
          onClick={handleSidebarClose}
          aria-label="Fermer le menu"
        />
      ) : null}

      <div className="layout-content">
        <AppHeader onMenuOpen={handleSidebarOpen} />

        {children}
      </div>

      <MobileBottomNav account={account} currentPage={currentPage} onNavigate={onNavigate} onMenuOpen={handleSidebarOpen} />
    </div>
  )
}
