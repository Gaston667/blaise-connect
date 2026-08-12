import { ArrowLeft, Download, Landmark, Mail, Phone, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import logo from '../assets/logo-blaise-connect.png.png'

/** Frais d'écolage (inscription, réinscription, APEAE) par cycle. */
const ENROLLMENT_FEES = [
  { level: 'Maternelle (PS, MS)', registration: 1500000, reregistration: 1000000, apeae: 650000 },
  { level: 'Grande Section (GS)', registration: 1500000, reregistration: 1000000, apeae: 750000 },
  { level: 'Primaire (CP, CE1, CE2, CM1, CM2)', registration: 1500000, reregistration: 1000000, apeae: 750000 },
  { level: 'Collège (6ème, 5ème, 4ème)', registration: 1500000, reregistration: 1000000, apeae: 850000 },
  { level: 'Collège (3ème)', registration: 1500000, reregistration: 1000000, apeae: 850000 },
  { level: 'Lycée (2nde, 1ère)', registration: 1000000, reregistration: 950000, apeae: null },
  { level: 'Terminale', registration: 1000000, reregistration: 1600000, apeae: null },
]

/** Frais de scolarité par échéance (les 3 échéances sont d'un montant égal). */
const TUITION_FEES = [
  { level: 'Maternelle (PS, MS, GS)', installment: 1950000 },
  { level: 'Primaire (CP, CE1, CE2, CM1, CM2)', installment: 2250000 },
  { level: 'Collège (6ème, 5ème, 4ème, 3ème)', installment: 2550000 },
  { level: 'Lycée (2nde, 1ère)', installment: 2850000 },
  { level: 'Terminale', installment: 4800000 },
]

/** Tarifs CNED en francs guinéens. */
const CNED_FEES_GNF = [
  { level: 'Primaire (CP, CE1, CE2, CM1, CM2) — élèves expatriés', digitalAndPaper: null, digitalOnly: 11400000 },
  { level: 'Collège (6ème, 5ème, 4ème) — élèves expatriés', digitalAndPaper: 13500000, digitalOnly: 11400000 },
  { level: 'Collège (3ème) — obligatoire', digitalAndPaper: null, digitalOnly: 11400000 },
  { level: 'Lycée (2nde, 1ère, Terminale) — obligatoire', digitalAndPaper: null, digitalOnly: 13740000 },
]

/** Tarifs CNED en euros. */
const CNED_FEES_EUR = [
  { level: 'Primaire (CP, CE1, CE2, CM1, CM2) — élèves expatriés', amount: 1100 },
  { level: 'Collège (6ème, 5ème, 4ème)', amount: 1100 },
  { level: 'Collège (3ème)', amount: 1100 },
  { level: 'Lycée (2nde, 1ère, Terminale)', amount: 1300 },
]

/** Frais d'examens nationaux (session annuelle, passés à Conakry). */
const EXAM_FEES = [
  { label: 'DNB', gnf: 1000000, eur: 100 },
  { label: 'BAC anticipé (Première)', gnf: 2500000, eur: 250 },
  { label: 'BAC (Terminale)', gnf: 4000000, eur: 400 },
]

/**
 * Formate un montant en francs guinéens.
 */
function formatGNF(amount) {
  if (amount == null) return '—'
  return `${amount.toLocaleString('fr-FR')} GNF`
}

/**
 * Formate un montant en euros.
 */
function formatEUR(amount) {
  if (amount == null) return '—'
  return `${amount.toLocaleString('fr-FR')} €`
}

/**
 * Page publique présentant le règlement financier et la fiche d'inscription
 * de l'École ALEF-Blaise Pascal de Kamsar (année scolaire 2026-2027).
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
          <h1 id="fees-title" className="public-page-title">Frais de scolarité — Année 2026-2027</h1>
          <p className="public-page-description">
            École ALEF-Blaise Pascal de Kamsar. Montants exprimés en francs guinéens (GNF),
            conformes au règlement financier de l’établissement.
          </p>
          <p className="tuition-contact">
            <Mail aria-hidden="true" size={16} /> raf@alef-blaisepascal.org
            <span aria-hidden="true">·</span>
            <Phone aria-hidden="true" size={16} /> 625 10 17 07 / 622 466 266
          </p>
        </section>

        <section className="tuition-fee-groups no-print" aria-label="Frais d'inscription, réinscription et APEAE">
          <article className="tuition-fee-group tuition-fee-group--wide">
            <h2 className="tuition-fee-group-title">Inscription, réinscription et APEAE</h2>
            <p className="tuition-fee-group-note">
              Payés avant la rentrée, au plus tard le 31 août 2026, en plus d’un mois
              (juin) de scolarité obligatoirement.
            </p>
            <div className="tuition-table-scroll">
              <table className="tuition-fee-table">
                <thead>
                  <tr>
                    <th scope="col">Classe</th>
                    <th scope="col">Inscription</th>
                    <th scope="col">Réinscription</th>
                    <th scope="col">APEAE</th>
                  </tr>
                </thead>
                <tbody>
                  {ENROLLMENT_FEES.map((row) => (
                    <tr key={row.level}>
                      <td>{row.level}</td>
                      <td>{formatGNF(row.registration)}</td>
                      <td>{formatGNF(row.reregistration)}</td>
                      <td>{formatGNF(row.apeae)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="tuition-fee-groups no-print" aria-label="Frais de scolarité par échéance">
          <article className="tuition-fee-group tuition-fee-group--wide">
            <h2 className="tuition-fee-group-title">Frais de scolarité — 3 échéances</h2>
            <p className="tuition-fee-group-note">
              Échéances : 31 octobre (sept.–nov.), 31 janvier (déc.–févr.), 30 avril (mars–mai).
              Chaque échéance est d’un montant égal.
            </p>
            <div className="tuition-table-scroll">
              <table className="tuition-fee-table">
                <thead>
                  <tr>
                    <th scope="col">Cycle</th>
                    <th scope="col">1ère éch. (31/10)</th>
                    <th scope="col">2ème éch. (31/01)</th>
                    <th scope="col">3ème éch. (30/04)</th>
                    <th scope="col">Total annuel</th>
                  </tr>
                </thead>
                <tbody>
                  {TUITION_FEES.map((row) => (
                    <tr key={row.level}>
                      <td>{row.level}</td>
                      <td>{formatGNF(row.installment)}</td>
                      <td>{formatGNF(row.installment)}</td>
                      <td>{formatGNF(row.installment)}</td>
                      <td><strong>{formatGNF(row.installment * 3)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="tuition-fee-groups no-print" aria-label="Tarifs CNED">
          <article className="tuition-fee-group tuition-fee-group--wide">
            <h2 className="tuition-fee-group-title">CNED — tarifs en francs guinéens</h2>
            <div className="tuition-table-scroll">
              <table className="tuition-fee-table">
                <thead>
                  <tr>
                    <th scope="col">Cycle et classes</th>
                    <th scope="col">Numérique + papier</th>
                    <th scope="col">Numérique exclusivement</th>
                  </tr>
                </thead>
                <tbody>
                  {CNED_FEES_GNF.map((row) => (
                    <tr key={row.level}>
                      <td>{row.level}</td>
                      <td>{formatGNF(row.digitalAndPaper)}</td>
                      <td>{formatGNF(row.digitalOnly)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tuition-fee-group-note">
              Date limite de paiement du CNED : 30 novembre 2026.
            </p>
          </article>

          <article className="tuition-fee-group">
            <h2 className="tuition-fee-group-title">CNED — tarifs en euros</h2>
            <table className="tuition-fee-table">
              <thead>
                <tr>
                  <th scope="col">Cycle et classes</th>
                  <th scope="col">Numérique exclusivement</th>
                </tr>
              </thead>
              <tbody>
                {CNED_FEES_EUR.map((row) => (
                  <tr key={row.level}>
                    <td>{row.level}</td>
                    <td>{formatEUR(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="tuition-fee-group">
            <h2 className="tuition-fee-group-title">Frais d’examens nationaux</h2>
            <p className="tuition-fee-group-note">
              Épreuves passées au Lycée français Albert Camus de Conakry.
            </p>
            <table className="tuition-fee-table">
              <thead>
                <tr>
                  <th scope="col">Examen</th>
                  <th scope="col">GNF</th>
                  <th scope="col">EUR</th>
                </tr>
              </thead>
              <tbody>
                {EXAM_FEES.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{formatGNF(row.gnf)}</td>
                    <td>{formatEUR(row.eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </section>

        <section className="tuition-info-groups no-print" aria-label="Abattements, paiement et pénalités">
          <article className="tuition-info-card">
            <h2 className="tuition-fee-group-title">Politique d’abattement sur la scolarité</h2>
            <ul className="tuition-info-list">
              <li><strong>15 %</strong> — enfants biologiques des membres du Conseil d’Administration, pendant la durée de leur mandat.</li>
              <li><strong>5 %</strong> — familles ayant au moins trois enfants inscrits dans l’établissement (réduction appliquée sur la scolarité de l’élève du plus petit niveau).</li>
              <li><strong>5 %</strong> — scolarité annuelle réglée en un seul versement.</li>
            </ul>
            <p className="tuition-fee-group-note">
              Ces abattements s’appliquent uniquement au montant de la scolarité annuelle.
              Ils ne s’appliquent pas aux frais d’inscription, de réinscription, ni à l’APEAE.
            </p>
          </article>

          <article className="tuition-info-card">
            <h2 className="tuition-fee-group-title"><Landmark aria-hidden="true" size={18} /> Modalités de paiement</h2>
            <ul className="tuition-info-list">
              <li>Année scolaire de dix (10) mois effectifs, de septembre à juin.</li>
              <li>Paiement bancaire uniquement — <strong>aucun règlement en espèces</strong> n’est autorisé.</li>
              <li>VISTA GUI — compte n° 015746 001 12 (scolarité) ou 09848 4000258337.</li>
              <li>ECOBANK — compte n° 7356009908 (GNF).</li>
              <li>Reçu de paiement à déposer auprès du Responsable Administratif et Financier.</li>
              <li>Contestation d’un paiement : sous 30 jours maximum après la date du paiement.</li>
            </ul>
          </article>

          <article className="tuition-info-card tuition-info-card--warning">
            <h2 className="tuition-fee-group-title">Pénalités de retard</h2>
            <p>
              Tout retard de paiement au-delà des échéances peut entraîner une pénalité de
              <strong> 10 %</strong>, l’exclusion temporaire des cours, puis la radiation de
              l’élève, sauf exception soumise à l’appréciation du Conseil d’Administration.
            </p>
            <p className="tuition-fee-group-note">
              Toute tranche de scolarité entamée est entièrement due ; aucun remboursement
              n’est effectué en cas de départ de l’élève en cours de période.
            </p>
          </article>
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
              <p>École ALEF-Blaise Pascal de Kamsar — Année scolaire 2026-2027</p>
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
