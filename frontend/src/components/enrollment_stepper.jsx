import { Check } from 'lucide-react'

import '../styles/enrollment_stepper.css'

/**
 * Compteur d'étapes d'une inscription : « Étape 2 sur 3 », avec les étapes passées,
 * l'étape en cours et celles qui restent, pour guider l'utilisateur.
 */
export default function EnrollmentStepper({ steps, current }) {
  return (
    <div className="enroll-stepper" role="group" aria-label={`Étape ${current + 1} sur ${steps.length} : ${steps[current]}`}>
      <p className="enroll-stepper__count">
        Étape {current + 1} sur {steps.length} · <strong>{steps[current]}</strong>
      </p>
      <ol className="enroll-stepper__steps">
        {steps.map((label, index) => {
          const state = index < current ? 'is-done' : index === current ? 'is-current' : ''
          return (
            <li key={label} className={state} aria-current={index === current ? 'step' : undefined}>
              <span className="enroll-stepper__bullet" aria-hidden="true">
                {index < current ? <Check size={14} /> : index + 1}
              </span>
              <small>{label}</small>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
