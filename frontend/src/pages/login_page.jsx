import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

import logo from '../assets/logo-blaise-connect.png.png'
import { login } from '../services/auth_service.js'

/**
 * Affiche le formulaire de connexion prévu par l'US-001.
 */
export default function LoginPage({ onLoginSuccess }) {
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  /**
   * Normalise le matricule en minuscules pendant la saisie.
   */
  function handleRegistrationNumberChange(event) {
    setRegistrationNumber(event.target.value.toLowerCase())
  }

  /**
   * Met à jour le mot de passe saisi.
   */
  function handlePasswordChange(event) {
    setPassword(event.target.value)
  }

  /**
   * Affiche ou masque le mot de passe.
   */
  function handlePasswordVisibility() {
    setIsPasswordVisible(!isPasswordVisible)
  }

  /**
   * Envoie les identifiants au backend.
   */
  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setIsLoading(true)

    try {
      const loginResponse = await login(registrationNumber, password)
      setSuccessMessage('Connexion réussie.')
      onLoginSuccess(loginResponse.account)
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'La connexion a échoué.'

      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="connexion-page">
      <header className="connexion-header">
        <label
          className="connexion-language-label"
          htmlFor="connexion-language"
        >
          Langue
        </label>

        <div className="connexion-language-wrapper">
          <Globe2
            className="connexion-language-icon"
            aria-hidden="true"
            size={20}
          />

          <select
            id="connexion-language"
            className="connexion-language-select"
            defaultValue="fr"
          >
            <option value="fr">Français</option>
          </select>
        </div>
      </header>

      <main className="connexion-main">
        <section
          className="connexion-container"
          aria-labelledby="connexion-title"
        >
          <div className="connexion-brand">
            <img
              className="connexion-logo"
              src={logo}
              alt="Logo BlaiseConnect"
            />
          </div>

          <div className="connexion-introduction">
            <h1
              id="connexion-title"
              className="connexion-title"
            >
              Connexion
            </h1>

            <p className="connexion-description">
              Veuillez saisir vos identifiants pour accéder à votre espace.
            </p>
          </div>

          <form
            className="connexion-form"
            onSubmit={handleSubmit}
          >
            <div className="connexion-field">
              <label
                className="connexion-label"
                htmlFor="connexion-registration-number"
              >
                Matricule
              </label>

              <div className="connexion-input-wrapper">
                <UserRound
                  className="connexion-input-icon"
                  aria-hidden="true"
                  size={21}
                />

                <input
                  id="connexion-registration-number"
                  className="connexion-input"
                  name="connexionRegistrationNumber"
                  type="text"
                  value={registrationNumber}
                  onChange={handleRegistrationNumberChange}
                  placeholder="Entrez votre matricule"
                  minLength="7"
                  maxLength="7"
                  pattern="[aeup][0-9]{6}"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="connexion-field">
              <label
                className="connexion-label"
                htmlFor="connexion-password"
              >
                Mot de passe
              </label>

              <div className="connexion-input-wrapper">
                <LockKeyhole
                  className="connexion-input-icon"
                  aria-hidden="true"
                  size={21}
                />

                <input
                  id="connexion-password"
                  className="connexion-input"
                  name="connexionPassword"
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Entrez votre mot de passe"
                  autoComplete="current-password"
                  required
                />

                <button
                  className="connexion-password-toggle"
                  type="button"
                  onClick={handlePasswordVisibility}
                  aria-label={
                    isPasswordVisible
                      ? 'Masquer le mot de passe'
                      : 'Afficher le mot de passe'
                  }
                  aria-pressed={isPasswordVisible}
                >
                  {isPasswordVisible ? (
                    <EyeOff aria-hidden="true" size={21} />
                  ) : (
                    <Eye aria-hidden="true" size={21} />
                  )}
                </button>
              </div>
            </div>

            {errorMessage ? (
              <p
                className="connexion-error"
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}

            {successMessage ? (
              <p
                className="connexion-success"
                role="status"
              >
                {successMessage}
              </p>
            ) : null}

            <button
              className="connexion-submit"
              type="submit"
              disabled={isLoading}
            >
              <span>
                {isLoading
                  ? 'Connexion en cours…'
                  : 'Se connecter'}
              </span>

              <ArrowRight
                className="connexion-submit-arrow"
                aria-hidden="true"
                size={22}
              />
            </button>
          </form>

        </section>
      </main>

      <footer className="connexion-site-footer">
        <div className="connexion-site-footer-inner">
          <p className="connexion-footer-security">
            <ShieldCheck aria-hidden="true" size={21} />
            Vos données sont protégées et sécurisées
          </p>

          <nav className="connexion-site-footer-links" aria-label="Liens utiles">
            <Link to="/about" className="connexion-site-footer-link">À propos</Link>
            <Link to="/tuition-fees" className="connexion-site-footer-link">Frais de scolarité</Link>
          </nav>

          <p className="connexion-copyright">
            <strong>BlaiseConnect</strong> © 2026
          </p>
        </div>
      </footer>
    </div>
  )
}
