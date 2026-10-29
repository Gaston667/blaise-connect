import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, Wand2 } from 'lucide-react'

import { generateAllTimetables, publishAllTimetables } from '../services/timetable_service.js'

function formatHours(minutes) {
  return `${(minutes / 60).toFixed(1).replace(/\.0$/, '')} h`
}

/** Génère d'un coup les brouillons de toutes les classes, puis résume le résultat par classe. */
export default function GenerateAllTimetables({ onGenerated, onSelectClass }) {
  const [isOpen, setIsOpen] = useState(false)
  const [dates, setDates] = useState({ start: '', end: '' })
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [published, setPublished] = useState(null)
  const [isConfirming, setIsConfirming] = useState(false)

  async function run(event) {
    event.preventDefault()
    // Première validation : on demande confirmation, car les brouillons existants sont remplacés.
    if (!isConfirming) {
      setIsConfirming(true)
      return
    }
    setIsConfirming(false)
    setError('')
    setResult(null)
    setPublished(null)
    if (Boolean(dates.start) !== Boolean(dates.end)) {
      setError('Renseignez les deux dates, ou laissez-les vides pour couvrir toute l’année.')
      return
    }
    setIsRunning(true)
    try {
      const data = await generateAllTimetables(dates.start, dates.end)
      setResult(data)
      await onGenerated?.()
    } catch (runError) {
      setError(runError.message)
    } finally {
      setIsRunning(false)
    }
  }

  async function publishAll() {
    setError('')
    setIsPublishing(true)
    try {
      setPublished(await publishAllTimetables())
      await onGenerated?.()
    } catch (publishError) {
      setError(publishError.message)
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <section className="tmp-generate-all" aria-labelledby="tmp-generate-all-title">
      <div className="tmp-generate-all__head">
        <div>
          <h2 id="tmp-generate-all-title"><Wand2 aria-hidden="true" size={18} /> Générer pour toutes les classes</h2>
          <p>Crée un brouillon pour chaque classe de l’année courante, en respectant les enseignants, les salles, les spécialités et les règles d’un emploi du temps. Les créneaux placés à la main sont conservés. Rien n’est publié automatiquement.</p>
        </div>
        <button type="button" className="tmp-generate-all__toggle" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen}>
          {isOpen ? 'Fermer' : 'Générer pour toutes les classes'}
        </button>
      </div>

      {isOpen && (
        <form className="tmp-generate-all__form" onSubmit={run}>
          <p className="tmp-field-hint">Les volumes horaires déjà configurés pour chaque classe sont utilisés. Les brouillons existants de toutes les classes seront remplacés.</p>
          <div className="tmp-generate-all__dates">
            <label className="tmp-field">
              <span>Début (facultatif)</span>
              <input type="date" value={dates.start} onChange={(event) => setDates((current) => ({ ...current, start: event.target.value }))} />
            </label>
            <label className="tmp-field">
              <span>Fin (facultatif)</span>
              <input type="date" value={dates.end} onChange={(event) => setDates((current) => ({ ...current, end: event.target.value }))} />
            </label>
          </div>
          {isConfirming && (
            <p className="tmp-error" role="alert">
              Les brouillons de toutes les classes vont être remplacés. Seuls les créneaux placés à la main (verrouillés) sont conservés.
              Les emplois du temps déjà publiés ne changent pas.
            </p>
          )}
          <div className="tmp-generate-all__actions">
            <button type="submit" className="tmp-generate-all__run" disabled={isRunning}>
              {isRunning
                ? <><Loader2 aria-hidden="true" size={16} className="tmp-spin" /> Génération en cours…</>
                : isConfirming ? 'Confirmer et générer' : 'Lancer la génération'}
            </button>
            {isConfirming && !isRunning && (
              <button type="button" className="tmp-generate-all__toggle" aria-expanded="true" onClick={() => setIsConfirming(false)}>
                Annuler
              </button>
            )}
          </div>
        </form>
      )}

      {error && <p className="tmp-error" role="alert">{error}</p>}

      {result && (
        <div className="tmp-generate-all__result" role="status">
          <p>
            <strong>{result.complete_count} classe(s) sur {result.classes.length}</strong> avec un emploi du temps complet
            {' '}(année {result.school_year_name}).
          </p>
          {result.warnings.length > 0 && (
            <div className="tmp-error">
              <p>Enseignants trop chargés :</p>
              <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          )}
          <ul className="tmp-generate-all__classes">
            {result.classes.map((item) => (
              <li
                key={item.class_id}
                className={item.complete ? 'is-complete' : 'is-incomplete'}
                role="button"
                tabIndex={0}
                title={`Voir l’emploi du temps de ${item.class_name}`}
                onClick={() => onSelectClass?.(item.class_id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectClass?.(item.class_id)
                  }
                }}
              >
                {item.complete ? <CheckCircle2 aria-hidden="true" size={16} /> : <AlertTriangle aria-hidden="true" size={16} />}
                <div>
                  <strong>{item.class_name}</strong> — {item.slots_count} créneaux
                  {item.locked_count > 0 ? ` (dont ${item.locked_count} placé(s) à la main, conservé(s))` : ''}
                  {item.complete ? ' : prêt à publier.' : ' : heures non placées, publication impossible tant que ce n’est pas réglé.'}
                  {item.unplaced_requirements.length > 0 && (
                    <ul>
                      {item.unplaced_requirements.map((requirement) => (
                        <li key={requirement.class_subject_id}>
                          {requirement.subject_name} : {formatHours(requirement.placed_minutes)} sur {formatHours(requirement.requested_minutes)}
                          {requirement.reason ? ` — ${requirement.reason}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.adjustments.length > 0 && <small>{item.adjustments.join(' ')}</small>}
                </div>
                <ChevronRight aria-hidden="true" size={18} className="tmp-generate-all__open" />
              </li>
            ))}
          </ul>
          {result.complete_count > 0 && !published && (
            <div className="tmp-generate-all__publish">
              <p className="tmp-field-hint">Publier remplace les emplois du temps actuels des classes complètes et les rend visibles des élèves, parents et enseignants. Les classes sont publiées ensemble : si l’une échoue, rien n’est modifié.</p>
              <button type="button" className="tmp-generate-all__run" onClick={publishAll} disabled={isPublishing}>
                {isPublishing ? <><Loader2 aria-hidden="true" size={16} className="tmp-spin" /> Publication en cours…</> : `Publier les ${result.complete_count} emplois du temps complets`}
              </button>
            </div>
          )}
          {published && (
            <p className="tmp-generate-all__done" role="status">
              <CheckCircle2 aria-hidden="true" size={16} /> {published.published.length} emploi(s) du temps publié(s)
              {published.not_published.length > 0 ? `, ${published.not_published.length} non publié(s) : ${published.not_published.map((item) => item.class_name).join(', ')}.` : '.'}
            </p>
          )}
          {result.skipped.length > 0 && (
            <div className="tmp-error">
              <p>Classes ignorées :</p>
              <ul>{result.skipped.map((item) => <li key={item.class_id}>{item.class_name} : {item.reason}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
