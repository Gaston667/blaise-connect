import { useState } from 'react'
import { Eye, EyeOff, X } from 'lucide-react'

import { createAccount } from '../services/account_service.js'

const INITIAL_FORM = {
  registration_number: '',
  role: 'TEACHER',
  password: '',
  password_confirmation: '',
}

/** Formulaire modal de création d'un compte utilisateur. */
export default function AddAccountModal({ onClose, onCreated }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  function handleFieldChange(event) {
    const { name, value } = event.target
    setForm(function updateForm(previousForm) {
      return { ...previousForm, [name]: value }
    })
  }

  function handlePasswordVisibility() {
    setIsPasswordVisible(function toggleVisibility(currentVisibility) {
      return !currentVisibility
    })
  }

  function handleOverlayClick(event) {
    if (event.target === event.currentTarget && !isSubmitting) {
      onClose()
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    if (form.password !== form.password_confirmation) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.')
      return
    }

    setIsSubmitting(true)
    try {
      const createdAccount = await createAccount({
        registration_number: form.registration_number,
        password: form.password,
        role: form.role,
      })
      onCreated(createdAccount)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const passwordInputType = isPasswordVisible ? 'text' : 'password'

  return (
    <div
      className="ajout-compte-overlay"
      role="presentation"
      onMouseDown={handleOverlayClick}
    >
      <section
        className="ajout-compte-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ajout-compte-title"
      >
        <header className="ajout-compte-header">
          <div>
            <h2 id="ajout-compte-title">Ajouter un compte</h2>
            <p>Créez un accès pour un utilisateur de BlaiseConnect.</p>
          </div>
          <button
            type="button"
            className="ajout-compte-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fermer le formulaire"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <form className="ajout-compte-form" onSubmit={handleSubmit}>
          <label className="ajout-compte-field">
            Matricule
            <input
              name="registration_number"
              type="text"
              required
              autoFocus
              autoComplete="off"
              pattern="^[aeupAEUP][0-9]{6}$"
              title="Une lettre parmi a, e, u ou p suivie de six chiffres."
              placeholder="e000001"
              value={form.registration_number}
              onChange={handleFieldChange}
            />
            <small>Une lettre parmi a, e, u ou p, puis six chiffres.</small>
          </label>

          <label className="ajout-compte-field">
            Rôle
            <select name="role" value={form.role} onChange={handleFieldChange}>
              <option value="TEACHER">Enseignant</option>
              <option value="ADMIN">Administrateur</option>
              <option value="STUDENT">Élève</option>
              <option value="GUARDIAN">Responsable</option>
            </select>
          </label>

          <label className="ajout-compte-field">
            Mot de passe
            <span className="ajout-compte-password">
              <input
                name="password"
                type={passwordInputType}
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={form.password}
                onChange={handleFieldChange}
              />
              <button
                type="button"
                onClick={handlePasswordVisibility}
                aria-label={
                  isPasswordVisible
                    ? 'Masquer le mot de passe'
                    : 'Afficher le mot de passe'
                }
              >
                {isPasswordVisible ? (
                  <EyeOff aria-hidden="true" size={19} />
                ) : (
                  <Eye aria-hidden="true" size={19} />
                )}
              </button>
            </span>
          </label>

          <label className="ajout-compte-field">
            Confirmer le mot de passe
            <input
              name="password_confirmation"
              type={passwordInputType}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={form.password_confirmation}
              onChange={handleFieldChange}
            />
          </label>

          {errorMessage && (
            <p className="ajout-compte-error" role="alert">
              {errorMessage}
            </p>
          )}

          <footer className="ajout-compte-actions">
            <button
              type="button"
              className="ajout-compte-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="ajout-compte-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Création…' : 'Créer le compte'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
