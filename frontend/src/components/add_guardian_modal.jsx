import { useState } from 'react'
import { searchGuardians, createGuardian, linkGuardianToStudent } from '../services/guardians_service.js'

const RELATIONSHIP_OPTIONS = [
  { value: 'PERE', label: 'Père' },
  { value: 'MERE', label: 'Mère' },
  { value: 'TUTEUR', label: 'Tuteur' },
  { value: 'AUTRE', label: 'Autre' },
]

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

export default function AddGuardianModal({ studentId, onClose, onLinked }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [relationship, setRelationship] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [newGuardian, setNewGuardian] = useState({
    first_name: '', last_name: '', phone: '', email: '', address: '', occupation: '', employer: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSearch(e) {
    const value = e.target.value
    setQuery(value)
    setSelected(null)
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const data = await searchGuardians(value)
      setResults(data)
    } catch (err) {
      console.error(err)
    } finally {
      setSearching(false)
    }
  }

  function updateNewGuardian(field, value) {
    setNewGuardian((g) => ({ ...g, [field]: value }))
  }

  async function handleConfirm(e) {
    e.preventDefault()
    setError('')
    if (!relationship) {
      setError('Le lien de parenté est requis.')
      return
    }
    setSaving(true)
    try {
      if (creating) {
        await createGuardian({
          ...newGuardian,
          student_id: studentId,
          relationship,
          is_primary_contact: isPrimary,
        })
      } else if (selected) {
        await linkGuardianToStudent(studentId, selected.id, relationship, isPrimary)
      } else {
        setError('Sélectionnez un responsable ou créez-en un nouveau.')
        setSaving(false)
        return
      }
      onLinked()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="agm-overlay" onClick={onClose}>
      <div className="agm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="agm-header">
          <h2>Ajouter un responsable</h2>
          <button type="button" className="agm-close" onClick={onClose}>✕</button>
        </div>

        {!creating && !selected && (
          <div className="agm-search-step">
            <label>
              Rechercher un responsable existant
              <input
                type="text"
                placeholder="Nom, prénom ou téléphone"
                value={query}
                onChange={handleSearch}
                autoFocus
              />
            </label>

            {searching && <p className="agm-hint">Recherche…</p>}

            {results.length > 0 && (
              <ul className="agm-results">
                {results.map((g) => (
                  <li key={g.id}>
                    <button type="button" className="agm-result" onClick={() => setSelected(g)}>
                      <span className="agm-avatar">{initials(g.first_name, g.last_name)}</span>
                      <span className="agm-result-info">
                        <strong>{g.first_name} {g.last_name}</strong>
                        <span>{g.phone}</span>
                      </span>
                      <span className="agm-select-label">Sélectionner</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {query.trim().length >= 2 && !searching && results.length === 0 && (
              <p className="agm-hint">Aucun responsable trouvé pour « {query} ».</p>
            )}

            <div className="agm-divider">— ou —</div>

            <button type="button" className="agm-btn-secondary agm-full" onClick={() => setCreating(true)}>
              + Créer un nouveau responsable
            </button>
          </div>
        )}

        {(selected || creating) && (
          <form onSubmit={handleConfirm} className="agm-form">
            {selected && (
              <div className="agm-selected-summary">
                <span className="agm-avatar">{initials(selected.first_name, selected.last_name)}</span>
                <div>
                  <strong>{selected.first_name} {selected.last_name}</strong>
                  <span>{selected.phone}</span>
                </div>
                <button type="button" className="agm-change" onClick={() => setSelected(null)}>Changer</button>
              </div>
            )}

            {creating && (
              <>
                <div className="agm-row">
                  <label>Prénom *<input required value={newGuardian.first_name} onChange={(e) => updateNewGuardian('first_name', e.target.value)} /></label>
                  <label>Nom *<input required value={newGuardian.last_name} onChange={(e) => updateNewGuardian('last_name', e.target.value)} /></label>
                </div>
                <div className="agm-row">
                  <label>Téléphone *<input required value={newGuardian.phone} onChange={(e) => updateNewGuardian('phone', e.target.value)} /></label>
                  <label>Email<input type="email" value={newGuardian.email} onChange={(e) => updateNewGuardian('email', e.target.value)} /></label>
                </div>
                <label className="agm-full-field">Adresse<input value={newGuardian.address} onChange={(e) => updateNewGuardian('address', e.target.value)} /></label>
                <div className="agm-row">
                  <label>Profession<input value={newGuardian.occupation} onChange={(e) => updateNewGuardian('occupation', e.target.value)} /></label>
                  <label>Employeur<input value={newGuardian.employer} onChange={(e) => updateNewGuardian('employer', e.target.value)} /></label>
                </div>
                <button type="button" className="agm-back" onClick={() => setCreating(false)}>← Rechercher plutôt un responsable existant</button>
              </>
            )}

            <div className="agm-row">
              <label>
                Lien de parenté *
                <select required value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                  <option value="">Choisir…</option>
                  {RELATIONSHIP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="agm-checkbox-label">
                <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
                Contact principal
              </label>
            </div>

            {error && <p className="agm-error">{error}</p>}

            <div className="agm-actions">
              <button type="button" className="agm-btn-secondary" onClick={onClose}>Annuler</button>
              <button type="submit" className="agm-btn-primary" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}