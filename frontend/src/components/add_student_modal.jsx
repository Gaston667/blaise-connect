import { useState } from 'react'
import { createStudent } from '../services/students_service.js'

export default function AddStudentModal({ classes, schoolYears, onClose, onCreated }) {
const [form, setForm] = useState({
  registration_number: '',
  password: '',
  first_name: '',
  last_name: '',
  birth_date: '',
  gender: '',
  email: '',
  phone: '',
  address: '',
  admission_date: new Date().toISOString().slice(0, 10),
  class_id: '',
  enrollment_start_date: '',
})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        ...form,
        birth_date: form.birth_date || null,
        gender: form.gender || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        class_id: form.class_id || null,
        enrollment_start_date: form.class_id ? form.enrollment_start_date : null,
      }
      const created = await createStudent(payload)
      onCreated(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="asm-overlay" onClick={onClose}>
      <div className="asm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="asm-header">
          <h2>Ajouter un élève</h2>
          <button type="button" className="asm-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="asm-form">
          <div className="asm-row">
            <label>
              N° d'identification *
              <input
                required
                placeholder="e000012"
                pattern="^[aeup][0-9]{6}$"
                title="Une lettre parmi a, e, u, p suivie de 6 chiffres"
                value={form.registration_number}
                onChange={(e) => update('registration_number', e.target.value)}
              />
            </label>
            <label>
              Mot de passe *
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
              />
            </label>
          </div>

          <div className="asm-row">
            <label>
              Prénom *
              <input required value={form.first_name} onChange={(e) => update('first_name', e.target.value)} />
            </label>
            <label>
              Nom *
              <input required value={form.last_name} onChange={(e) => update('last_name', e.target.value)} />
            </label>
          </div>

          <div className="asm-row">
            <label>
              Date de naissance
              <input type="date" value={form.birth_date} onChange={(e) => update('birth_date', e.target.value)} />
            </label>
            <label>
              Sexe
              <select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                <option value="">—</option>
                <option value="F">Féminin</option>
                <option value="M">Masculin</option>
              </select>
            </label>
          </div>

          <div className="asm-row">
            <label>
              Email
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </label>
            <label>
              Téléphone
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </label>
          </div>

          <label className="asm-full">
            Adresse
            <input value={form.address} onChange={(e) => update('address', e.target.value)} />
          </label>

          <div className="asm-row">
            <label>
              Date d'inscription *
              <input
                required
                type="date"
                value={form.admission_date}
                onChange={(e) => update('admission_date', e.target.value)}
              />
            </label>
            <label>
              Classe
              <select
  value={form.class_id}
  onChange={(e) => {
    const newClassId = e.target.value
    const selectedClass = classes.find((c) => c.id === newClassId)
    const year = schoolYears.find((y) => y.id === selectedClass?.school_year_id)
    setForm((f) => ({
      ...f,
      class_id: newClassId,
      enrollment_start_date: year?.start_date ?? f.enrollment_start_date,
    }))
  }}
>
  <option value="">Aucune classe</option>
  {classes.map((c) => (
    <option key={c.id} value={c.id}>{c.name}</option>
  ))}
</select>
            </label>
          </div>
           {form.class_id && (
            <label>
              Date d'inscription en classe
              <input
                type="date"
                value={form.enrollment_start_date}
                onChange={(e) => update('enrollment_start_date', e.target.value)}
              />
            </label>
          )}
          {error && <p className="asm-error">{error}</p>}

          <div className="asm-actions">
            <button type="button" className="asm-btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="asm-btn-save" disabled={saving}>
              {saving ? 'Création…' : 'Créer l\'élève'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}