import { CircleAlert, CircleCheck, X } from 'lucide-react'

/** Affiche un message applicatif important dans une fenêtre accessible. */
export default function NotificationPopup({ message, type = 'info', onClose }) {
  if (!message) return null

  const Icon = type === 'error' ? CircleAlert : CircleCheck
  return (
    <div className="notification-popup-backdrop" role="presentation">
      <section
        className={`notification-popup notification-popup--${type}`}
        role={type === 'error' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={type === 'error' ? 'Erreur' : 'Information'}
      >
        <Icon aria-hidden="true" size={24} />
        <p>{message}</p>
        <button type="button" onClick={onClose} aria-label="Fermer le message">
          <X aria-hidden="true" size={20} />
        </button>
      </section>
    </div>
  )
}
