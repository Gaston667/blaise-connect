import { useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

import { useGuardianChild } from '../context/guardian_child_context.js'
import '../styles/child_switcher.css'

function getInitials(kid) {
  return `${kid.first_name?.[0] ?? ''}${kid.last_name?.[0] ?? ''}`.toUpperCase()
}

/**
 * Puce de l'en-tête du portail parents : indique l'enfant consulté et, si le
 * responsable en a plusieurs, ouvre un panneau pour en changer.
 */
export default function ChildSwitcher({ variant = 'chip' }) {
  const { isGuardian, kids, selectedChild, selectChild, notice } = useGuardianChild()
  const [isOpen, setIsOpen] = useState(false)

  if (!isGuardian || kids.length === 0 || !selectedChild) return null

  const canSwitch = kids.length > 1

  function handleSelect(kidId) {
    selectChild(kidId)
    setIsOpen(false)
  }

  const isBar = variant === 'bar'
  const switchButton = (
    <button
      type="button"
      className={isBar ? 'csw-chip csw-chip--flat' : 'csw-chip'}
      onClick={canSwitch ? () => setIsOpen(true) : undefined}
      aria-haspopup={canSwitch ? 'dialog' : undefined}
      aria-label={`Enfant consulté : ${selectedChild.first_name} ${selectedChild.last_name}`}
    >
      <span className="csw__avatar" aria-hidden="true">{getInitials(selectedChild)}</span>
      {isBar ? (
        <strong className="csw-chip__name">{selectedChild.first_name} {selectedChild.last_name}</strong>
      ) : (
        <span className="csw-chip__text">
          <small>Vous consultez</small>
          <strong>{selectedChild.first_name}</strong>
        </span>
      )}
      {canSwitch ? <ChevronDown aria-hidden="true" size={16} /> : null}
    </button>
  )

  return (
    <>
      {isBar ? (
        <div className="csw-bar">
          <span className="csw-bar__label">Vous consultez</span>
          {switchButton}
        </div>
      ) : switchButton}

      {isOpen ? (
        <div className="csw-sheet-backdrop" onClick={() => setIsOpen(false)}>
          <div
            className="csw-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Choisir l'enfant à consulter"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="csw-sheet__header">
              <h2>Quel enfant consulter ?</h2>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Fermer"><X size={20} /></button>
            </div>
            <div className="csw__list" role="radiogroup" aria-label="Changer d'enfant">
              {kids.map(function renderKid(kid) {
                const isSelected = kid.id === selectedChild.id
                return (
                  <button
                    key={kid.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={isSelected ? 'csw__pill csw__pill--active' : 'csw__pill'}
                    onClick={() => handleSelect(kid.id)}
                  >
                    <span className="csw__pill-avatar" aria-hidden="true">{getInitials(kid)}</span>
                    <span className="csw__pill-text">
                      <strong>{kid.first_name} {kid.last_name}</strong>
                      <small>{kid.class_name ?? 'Aucune classe active'}</small>
                    </span>
                    {isSelected ? <Check aria-hidden="true" size={18} /> : null}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {notice ? <div className="csw-toast" role="status">{notice}</div> : null}
    </>
  )
}
