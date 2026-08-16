import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

/**
 * Visite guidée générique : assombrit l'écran, découpe une "fenêtre" autour
 * de l'élément ciblé par l'étape courante, et affiche une infobulle avec la
 * navigation (précédent / suivant / quitter). Navigue elle-même vers la page
 * de chaque étape avant de chercher son élément cible dans le DOM.
 */
export default function GuidedTour({ steps, stepIndex, onNavigate, onNext, onPrev, onClose }) {
  const [targetRect, setTargetRect] = useState(null)
  const step = steps[stepIndex]

  useEffect(function navigateToStepPage() {
    if (step) onNavigate(step.page)
  }, [stepIndex])

  useEffect(function locateTargetElement() {
    if (!step) return undefined

    let cancelled = false
    let attempts = 0

    function tryLocate() {
      if (cancelled) return
      const element = document.querySelector(step.target)
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTargetRect(element.getBoundingClientRect())
        return
      }
      attempts += 1
      if (attempts < 30) {
        window.requestAnimationFrame(tryLocate)
      }
    }

    setTargetRect(null)
    tryLocate()

    function updateOnResize() {
      const element = document.querySelector(step.target)
      if (element) setTargetRect(element.getBoundingClientRect())
    }
    window.addEventListener('resize', updateOnResize)
    window.addEventListener('scroll', updateOnResize, true)

    return function cleanup() {
      cancelled = true
      window.removeEventListener('resize', updateOnResize)
      window.removeEventListener('scroll', updateOnResize, true)
    }
  }, [stepIndex])

  if (!step) return null

  const isFirst = stepIndex === 0
  const isLast = stepIndex === steps.length - 1

  const tooltipStyle = targetRect
    ? {
        top: Math.min(targetRect.bottom + 14, window.innerHeight - 200),
        left: Math.min(Math.max(targetRect.left, 16), window.innerWidth - 356),
      }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div className="gtour-overlay">
      {targetRect && (
        <div
          className="gtour-spotlight"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      <div className="gtour-tooltip" style={tooltipStyle}>
        <button type="button" className="gtour-tooltip__close" onClick={onClose} aria-label="Quitter la visite">
          <X aria-hidden="true" size={16} />
        </button>
        <span className="gtour-tooltip__step">Étape {stepIndex + 1} / {steps.length}</span>
        <h3>{step.title}</h3>
        <p>{step.description}</p>
        <div className="gtour-tooltip__actions">
          <button type="button" className="gtour-tooltip__skip" onClick={onClose}>
            Passer la visite
          </button>
          <div className="gtour-tooltip__nav">
            {!isFirst && (
              <button type="button" className="gtour-tooltip__btn gtour-tooltip__btn--ghost" onClick={onPrev}>
                <ChevronLeft aria-hidden="true" size={16} /> Précédent
              </button>
            )}
            <button type="button" className="gtour-tooltip__btn gtour-tooltip__btn--primary" onClick={isLast ? onClose : onNext}>
              {isLast ? 'Terminer' : 'Suivant'} {!isLast && <ChevronRight aria-hidden="true" size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
