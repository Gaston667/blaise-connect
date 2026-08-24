import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CircleCheck, CircleAlert, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
const AUTO_DISMISS_MS = 4500

function normalizeToast(toast) {
  if (typeof toast === 'string') {
    return { type: 'info', message: toast, title: '' }
  }
  return {
    type: toast?.type || 'info',
    title: toast?.title || '',
    message: toast?.message || '',
    duration: toast?.duration ?? AUTO_DISMISS_MS,
    id: toast?.id || `${toast?.type || 'info'}:${toast?.title || ''}:${toast?.message || ''}`,
  }
}

function ToastIcon({ type }) {
  if (type === 'success') return <CircleCheck aria-hidden="true" size={18} />
  if (type === 'error' || type === 'warning') return <CircleAlert aria-hidden="true" size={18} />
  return <Info aria-hidden="true" size={18} />
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  function dismissToast(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }

  function pushToast(toastInput) {
    const toast = normalizeToast(toastInput)
    if (!toast.message) return ''

    setToasts((current) => {
      if (current.some((item) => item.id === toast.id)) return current
      return [...current, toast]
    })

    if (toast.duration > 0) {
      const timer = window.setTimeout(() => dismissToast(toast.id), toast.duration)
      timersRef.current.set(toast.id, timer)
    }

    return toast.id
  }

  function success(message, options = {}) {
    return pushToast({ type: 'success', message, ...options })
  }

  function error(message, options = {}) {
    return pushToast({ type: 'error', message, ...options })
  }

  function info(message, options = {}) {
    return pushToast({ type: 'info', message, ...options })
  }

  function warning(message, options = {}) {
    return pushToast({ type: 'warning', message, ...options })
  }

  const value = useMemo(() => ({ pushToast, success, error, info, warning, dismissToast }), [])

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  useEffect(() => {
    function handleToastEvent(event) {
      pushToast(event.detail)
    }

    window.addEventListener('blaiseconnect:toast', handleToastEvent)
    return () => window.removeEventListener('blaiseconnect:toast', handleToastEvent)
  }, [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="bc-toast-region" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((toast) => (
          <article key={toast.id} className={`bc-toast bc-toast--${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
            <span className="bc-toast__icon"><ToastIcon type={toast.type} /></span>
            <div className="bc-toast__body">
              {toast.title && <strong>{toast.title}</strong>}
              <p>{toast.message}</p>
            </div>
            <button type="button" className="bc-toast__close" onClick={() => dismissToast(toast.id)} aria-label="Fermer la notification">
              <X aria-hidden="true" size={16} />
            </button>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast doit être utilisé à l’intérieur de ToastProvider.')
  }
  return context
}
