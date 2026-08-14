import { useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, Save } from 'lucide-react'

import { useToast } from '../components/feedback/ToastProvider.jsx'
import {
  getAppreciationContexts,
  getOverallAppreciations,
  getSubjectAppreciations,
  saveOverallAppreciation,
  saveSubjectAppreciation,
} from '../services/appreciations_service.js'
import '../styles/appreciations_page.css'

function getContextKey(context) {
  return `${context.class_subject_id}:${context.reporting_period_id}`
}

function getOverallKey(context) {
  return `${context.class_id}:${context.reporting_period_id}`
}

export default function AppreciationsPage() {
  const { showToast } = useToast()
  const [contexts, setContexts] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [mode, setMode] = useState('subject')
  const [rows, setRows] = useState([])
  const [drafts, setDrafts] = useState({})
  const [isLoading, setIsLoading] = useState(true)

  const selectedContext = useMemo(function findSelectedContext() {
    return contexts.find(function findContext(context) {
      const key = mode === 'subject' ? getContextKey(context) : getOverallKey(context)
      return key === selectedKey
    }) || null
  }, [contexts, mode, selectedKey])

  useEffect(function loadContextsEffect() {
    async function loadContexts() {
      try {
        const response = await getAppreciationContexts()
        setContexts(response)
        const first = response[0]
        if (first) setSelectedKey(getContextKey(first))
      } catch (error) {
        showToast(error.message, 'error')
      } finally {
        setIsLoading(false)
      }
    }
    loadContexts()
  }, [showToast])

  useEffect(function loadRowsEffect() {
    async function loadRows() {
      if (!selectedContext) {
        setRows([])
        return
      }
      try {
        const response = mode === 'subject'
          ? await getSubjectAppreciations(selectedContext.class_subject_id, selectedContext.reporting_period_id)
          : await getOverallAppreciations(selectedContext.class_id, selectedContext.reporting_period_id)
        setRows(response)
        const nextDrafts = {}
        response.forEach(function setDraft(row) {
          nextDrafts[row.student_enrollment_id] = row.comment || ''
        })
        setDrafts(nextDrafts)
      } catch (error) {
        setRows([])
        showToast(error.message, 'error')
      }
    }
    loadRows()
  }, [selectedContext, mode, showToast])

  function changeMode(nextMode) {
    setMode(nextMode)
    const firstAllowed = contexts.find(function findAllowed(context) {
      return nextMode === 'subject' || context.is_main_teacher
    })
    setSelectedKey(firstAllowed ? getOverallKey(firstAllowed) : '')
  }

  function updateDraft(enrollmentId, value) {
    setDrafts(function updateCurrentDrafts(currentDrafts) {
      return { ...currentDrafts, [enrollmentId]: value }
    })
  }

  async function saveRow(row) {
    const comment = (drafts[row.student_enrollment_id] || '').trim()
    if (!comment) {
      showToast('L’appréciation ne peut pas être vide.', 'error')
      return
    }
    try {
      if (mode === 'subject') {
        await saveSubjectAppreciation(row.student_enrollment_id, {
          class_subject_id: selectedContext.class_subject_id,
          reporting_period_id: selectedContext.reporting_period_id,
          comment,
        })
      } else {
        await saveOverallAppreciation(row.student_enrollment_id, {
          reporting_period_id: selectedContext.reporting_period_id,
          comment,
        })
      }
      showToast('Appréciation enregistrée.', 'success')
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  const selectableContexts = contexts.filter(function filterContext(context) {
    return mode === 'subject' || context.is_main_teacher
  })

  return (
    <section className="appreciations-page">
      <h1>Appréciations</h1>
      <p className="appreciations-page__intro">
        Rédigez les appréciations de période avant la validation du bulletin.
      </p>

      <div className="appreciations-page__tabs" role="tablist" aria-label="Type d’appréciation">
        <button type="button" className={mode === 'subject' ? 'is-active' : ''} onClick={function showSubject() { changeMode('subject') }}>
          Par matière
        </button>
        <button type="button" className={mode === 'overall' ? 'is-active' : ''} onClick={function showOverall() { changeMode('overall') }} disabled={!contexts.some(function hasMainTeacherContext(context) { return context.is_main_teacher })}>
          Générale de la classe
        </button>
      </div>

      <div className="appreciations-page__filters">
        <label>
          Classe, matière et période
          <select value={selectedKey} onChange={function selectContext(event) { setSelectedKey(event.target.value) }}>
            <option value="">Sélectionner un contexte</option>
            {selectableContexts.map(function renderContext(context) {
              const key = mode === 'subject' ? getContextKey(context) : getOverallKey(context)
              const label = mode === 'subject'
                ? `${context.class_name} — ${context.subject_name} — ${context.reporting_period_name}`
                : `${context.class_name} — ${context.reporting_period_name}`
              return <option key={key} value={key}>{label}</option>
            })}
          </select>
        </label>
      </div>

      {isLoading ? <p>Chargement des appréciations…</p> : null}
      {!isLoading && !selectedContext ? <p className="appreciations-page__empty">Aucun contexte d’appréciation disponible.</p> : null}
      {selectedContext ? (
        <div className="appreciations-page__table-wrap">
          <table className="appreciations-page__table">
            <thead><tr><th>Élève</th><th>Matricule</th><th>Appréciation</th><th>Enregistrer</th></tr></thead>
            <tbody>
              {rows.map(function renderRow(row) {
                return (
                  <tr key={row.student_enrollment_id}>
                    <td>{row.student_name}</td>
                    <td>{row.registration_number}</td>
                    <td><textarea value={drafts[row.student_enrollment_id] || ''} disabled={row.is_locked} maxLength="2000" onChange={function editComment(event) { updateDraft(row.student_enrollment_id, event.target.value) }} placeholder={row.is_locked ? 'Bulletin validé' : 'Saisir une appréciation…'} /></td>
                    <td><button type="button" className="appreciations-page__save" disabled={row.is_locked} onClick={function saveCurrentRow() { saveRow(row) }}><Save size={16} /> Enregistrer</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="appreciations-page__empty"><BookOpenCheck size={20} /> Aucun élève dans ce contexte.</p> : null}
        </div>
      ) : null}
    </section>
  )
}
