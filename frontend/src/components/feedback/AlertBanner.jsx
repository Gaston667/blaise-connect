import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'

function getIcon(type) {
  if (type === 'success') return CircleCheck
  if (type === 'warning') return TriangleAlert
  if (type === 'error') return CircleAlert
  return Info
}

export default function AlertBanner({
  type = 'info',
  title,
  message,
  onDismiss,
  className = '',
}) {
  if (!message) return null

  const Icon = getIcon(type)
  return (
    <div className={`bc-alert bc-alert--${type} ${className}`.trim()} role={type === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" size={18} />
      <div className="bc-alert__content">
        {title && <strong>{title}</strong>}
        <p>{message}</p>
      </div>
      {onDismiss && (
        <button type="button" className="bc-alert__close" onClick={onDismiss} aria-label="Fermer le message">
          <X aria-hidden="true" size={16} />
        </button>
      )}
    </div>
  )
}
