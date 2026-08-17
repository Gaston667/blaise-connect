import { useState } from 'react'

import AppHeader from '../components/app_header.jsx'
import MobileBottomNav from '../components/mobile_bottom_nav.jsx'
import Sidebar from '../components/sidebar.jsx'

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

  const hasMobileBottomNav = account?.role === 'STUDENT'

  return (
    <div className={hasMobileBottomNav ? 'layout-page layout-page--has-bottom-nav' : 'layout-page'}>
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

      <MobileBottomNav account={account} currentPage={currentPage} onNavigate={onNavigate} />
    </div>
  )
}
