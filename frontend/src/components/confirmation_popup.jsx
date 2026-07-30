import { CircleAlert, X } from 'lucide-react'

/** Demande une confirmation dans une fenêtre propre à BlaiseConnect. */
export default function ConfirmationPopup({
  message,
  confirmLabel = 'Confirmer',
  onCancel,
  onConfirm,
}) {
  if (!message) return null

  return (
    <div className="notification-popup-backdrop" role="presentation">
      <section
        className="confirmation-popup"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-popup-title"
        aria-describedby="confirmation-popup-message"
      >
        <header>
          <CircleAlert aria-hidden="true" size={22} />
          <h2 id="confirmation-popup-title">Confirmation</h2>
          <button type="button" onClick={onCancel} aria-label="Fermer">
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <p id="confirmation-popup-message">{message}</p>
        <footer>
          <button type="button" className="confirmation-popup-cancel" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="confirmation-popup-confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  )
}
