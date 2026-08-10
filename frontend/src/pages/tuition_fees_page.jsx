import { ArrowLeft, Download, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import logo from '../assets/logo-blaise-connect.png.png'

const FEE_GROUPS = [
  {
    stage: 'Préscolaire',
    levels: [
      { name: 'Petite section', amount: 1000 },
      { name: 'Moyenne section', amount: 1000 },
      { name: 'Grande section', amount: 1000 },
    ],
  },
  {
    stage: 'Primaire',
    levels: [
      { name: 'CP', amount: 1000 },
      { name: 'CE1', amount: 1000 },
      { name: 'CE2', amount: 1000 },
      { name: 'CM1', amount: 1000 },
      { name: 'CM2', amount: 1000 },
    ],
  },
  {
    stage: 'Collège',
    levels: [
      { name: 'Sixième', amount: 1000 },
      { name: 'Cinquième', amount: 1000 },
      { name: 'Quatrième', amount: 1000 },
      { name: 'Troisième', amount: 1000 },
    ],
  },
  {
    stage: 'Lycée',
    levels: [
      { name: 'Seconde', amount: 1000 },
      { name: 'Première', amount: 1000 },
      { name: 'Terminale', amount: 1000 },
    ],
  },
]

/**
 * Formate un montant en francs guinéens.
 */
function formatAmount(amount) {
  return `${amount.toLocaleString('fr-FR')} GNF`
}

/**
 * Page publique présentant les frais de scolarité et la fiche d'inscription.
 */
export default function TuitionFeesPage() {
  const navigate = useNavigate()

  function handlePrintEnrollmentForm() {
    window.print()
  }

  return (
    <div className="public-page">
      <header className="public-page-header no-print">
        <button
          className="public-page-back"
          type="button"
          onClick={() => navigate('/login')}
        >
          <ArrowLeft aria-hidden="true" size={19} />
          Retour à la connexion
        </button>

        <div className="public-page-brand">
          <img className="public-page-logo" src={logo} alt="Logo BlaiseConnect" />
        </div>
      </header>

      <main className="public-page-main">
        <section className="public-page-intro no-print" aria-labelledby="fees-title">
          <h1 id="fees-title" className="public-page-title">Frais de scolarité</h1>
          <p className="public-page-description">
            Montants indicatifs par classe, exprimés en francs guinéens (GNF).
            Ces tarifs peuvent être révisés par l’établissement.
          </p>
        </section>

        <section className="tuition-fee-groups no-print" aria-label="Tableaux des frais par classe">
          {FEE_GROUPS.map((group) => (
            <article className="tuition-fee-group" key={group.stage}>
              <h2 className="tuition-fee-group-title">{group.stage}</h2>
              <table className="tuition-fee-table">
                <thead>
                  <tr>
                    <th scope="col">Classe</th>
                    <th scope="col">Frais annuels</th>
                  </tr>
                </thead>
                <tbody>
                  {group.levels.map((level) => (
                    <tr key={level.name}>
                      <td>{level.name}</td>
                      <td>{formatAmount(level.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </section>

        <section className="tuition-enrollment no-print" aria-labelledby="enrollment-title">
          <h2 id="enrollment-title" className="public-page-title">Fiche d’inscription</h2>
          <p className="public-page-description">
            Téléchargez la fiche d’inscription, imprimez-la, remplissez-la et
            ramenez-la à l’établissement pour finaliser l’inscription.
          </p>
          <button
            className="tuition-enrollment-download"
            type="button"
            onClick={handlePrintEnrollmentForm}
          >
            <Download aria-hidden="true" size={19} />
            Télécharger la fiche d’inscription
          </button>
        </section>

        <section className="enrollment-form print-only" aria-label="Fiche d'inscription imprimable">
          <header className="enrollment-form-header">
            <img className="enrollment-form-logo" src={logo} alt="Logo BlaiseConnect" />
            <div>
              <h2>Fiche d’inscription</h2>
              <p>Année scolaire : ______________________</p>
            </div>
          </header>

          <section className="enrollment-form-section">
            <h3>Informations de l’élève</h3>
            <div className="enrollment-form-grid">
              <label>Nom<span>___________________________</span></label>
              <label>Prénom<span>___________________________</span></label>
              <label>Date de naissance<span>______ / ______ / __________</span></label>
              <label>Lieu de naissance<span>___________________________</span></label>
              <label>Sexe<span>Masculin ☐  &nbsp; Féminin ☐</span></label>
              <label>Classe visée<span>___________________________</span></label>
            </div>
          </section>

          <section className="enrollment-form-section">
            <h3>Responsable légal / parent</h3>
            <div className="enrollment-form-grid">
              <label>Nom et prénom<span>___________________________</span></label>
              <label>Lien de parenté<span>___________________________</span></label>
              <label>Téléphone<span>___________________________</span></label>
              <label>Adresse<span>___________________________</span></label>
              <label>Profession<span>___________________________</span></label>
              <label>Email<span>___________________________</span></label>
            </div>
          </section>

          <section className="enrollment-form-section">
            <h3>Scolarité précédente</h3>
            <div className="enrollment-form-grid">
              <label>Établissement<span>___________________________</span></label>
              <label>Dernière classe suivie<span>___________________________</span></label>
            </div>
          </section>

          <footer className="enrollment-form-footer">
            <p>Date : ______ / ______ / __________</p>
            <p>Signature du responsable légal :</p>
          </footer>
        </section>
      </main>

      <button
        className="tuition-print-button no-print"
        type="button"
        onClick={handlePrintEnrollmentForm}
      >
        <Printer aria-hidden="true" size={19} />
      </button>
    </div>
  )
}
