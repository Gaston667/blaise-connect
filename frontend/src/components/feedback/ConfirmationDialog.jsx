import { CircleAlert, X } from 'lucide-react'

export default function ConfirmationDialog({
  open,
  title = 'Confirmation',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'danger',
  loading = false,
  onCancel,
  onConfirm,
  children,
}) {
  if (!open) return null

  return (
    <div className="bc-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className={`bc-dialog bc-dialog--${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bc-dialog-title"
        aria-describedby="bc-dialog-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="bc-dialog__header">
          <span className="bc-dialog__icon"><CircleAlert aria-hidden="true" size={20} /></span>
          <div>
            <h2 id="bc-dialog-title">{title}</h2>
            {message && <p id="bc-dialog-message">{message}</p>}
          </div>
          <button type="button" className="bc-dialog__close" onClick={onCancel} aria-label="Fermer">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        {children}

        <footer className="bc-dialog__actions">
          <button type="button" className="bc-btn bc-btn--secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className={`bc-btn bc-btn--${tone}`} onClick={onConfirm} disabled={loading}>
            {loading ? 'En cours…' : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  )
}
