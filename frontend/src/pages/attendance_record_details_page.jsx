import { Check, Clock3, FileText, History, Pencil, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useToast } from '../components/feedback/ToastProvider.jsx'
import {
  getAttendanceDocumentFile,
  getAttendanceRecordDetail,
  createAttendanceChangeRequest,
  deleteAttendanceRecord,
  reviewAttendanceJustification,
  updateAttendanceRecord,
  uploadMyAttendanceJustification,
} from '../services/attendance_service.js'
import '../styles/attendance_record_details_page.css'

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

function statusLabel(value) {
  return {
    UNJUSTIFIED: 'Non justifié', PENDING: 'En attente',
    JUSTIFIED: 'Justifié', REJECTED: 'Refusé',
  }[value] || value
}

export default function AttendanceRecordDetailsPage({ account, recordId, onNavigate }) {
  const toast = useToast()
  const [detail, setDetail] = useState(null)
  const [actionMode, setActionMode] = useState(null)

  useEffect(function loadAttendanceDetailEffect() {
    async function loadAttendanceDetail() {
      try { setDetail(await getAttendanceRecordDetail(recordId)) }
      catch (error) { toast.error(error.message) }
    }
    loadAttendanceDetail()
  }, [recordId, toast])

  async function openDocument(document) {
    try {
      const blob = await getAttendanceDocumentFile(recordId, document.id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(function releaseDocumentUrl() {
        URL.revokeObjectURL(url)
      }, 60000)
    } catch (error) { toast.error(error.message) }
  }

  async function reloadDetail() {
    setDetail(await getAttendanceRecordDetail(recordId))
  }

  async function reviewJustification(decision) {
    try {
      await reviewAttendanceJustification(recordId, { status: decision, review_comment: null })
      await reloadDetail()
      toast.success(decision === 'JUSTIFIED' ? 'Justificatif accepté.' : 'Justificatif refusé.')
    } catch (error) {
      toast.error(error.message)
    }
  }

  if (!detail) return <main className="attendance-detail-page">Chargement…</main>

  return (
    <main className="attendance-detail-page">
      <header className="attendance-detail-header">
        <h1>Détail de {detail.incident_type === 'LATE' ? 'retard' : 'l’absence'}</h1>
        <nav className="attendance-detail-breadcrumb" aria-label="Fil d’Ariane">
          <button type="button" onClick={function goHome() { onNavigate('home') }}>Accueil</button>
          <span>›</span>
          <button type="button" onClick={function returnToAttendance() { onNavigate('attendance') }}>Assiduité</button>
          <span>›</span>
          <span>Détail</span>
        </nav>
      </header>

      <section className="attendance-detail-summary">
        <UserRound />
        <div><small>Élève</small><strong>{detail.student_name}</strong><span>{detail.registration_number}</span></div>
        <div><small>Incident</small><strong>{detail.incident_type === 'LATE' ? `Retard (${detail.late_minutes} min)` : 'Absence'}</strong></div>
        <div><small>Statut</small><strong>{statusLabel(detail.justification_status)}</strong></div>
      </section>

      <AttendanceDetailActions
        account={account}
        detail={detail}
        onOpenAction={setActionMode}
        onReview={reviewJustification}
      />

      <div className="attendance-detail-grid">
        <section className="attendance-detail-card">
          <h2><Clock3 /> Cours concerné</h2>
          <dl>
            <div><dt>Date</dt><dd>{formatDate(detail.attendance_date)}</dd></div>
            <div><dt>Horaire</dt><dd>{String(detail.course_start_time).slice(0, 5)} – {String(detail.course_end_time).slice(0, 5)}</dd></div>
            <div><dt>Classe</dt><dd>{detail.class_name}</dd></div>
            <div><dt>Matière</dt><dd>{detail.subject_name}</dd></div>
            <div><dt>Enseignant</dt><dd>{detail.teacher_name}</dd></div>
          </dl>
        </section>
        <section className="attendance-detail-card">
          <h2><FileText /> Motif et justificatifs</h2>
          <p className="attendance-detail-reason">{detail.reason || 'Aucun motif communiqué.'}</p>
          {(detail.documents || []).length ? detail.documents.map(function renderDocument(document) {
            return <button className="attendance-detail-document" type="button" key={document.id} onClick={function showDocument() { openDocument(document) }}><FileText /> {document.title || document.original_filename}</button>
          }) : <p className="attendance-detail-muted">Aucun document joint.</p>}
        </section>
      </div>

      {detail.history?.length > 0 && (
        <section className="attendance-detail-card">
          <h2><History /> Historique des modifications</h2>
          <div className="attendance-detail-history">{detail.history.map(function renderHistory(item) {
            return <article key={item.id}><strong>{item.change_action}</strong><span>{item.change_reason}</span><small>{item.changed_by} · {new Date(item.changed_at).toLocaleString('fr-FR')}</small></article>
          })}</div>
        </section>
      )}

      {actionMode && (
        <AttendanceActionDialog
          account={account}
          detail={detail}
          mode={actionMode}
          onClose={function closeActionDialog() { setActionMode(null) }}
          onSaved={async function refreshAfterAction(message) {
            setActionMode(null)
            await reloadDetail()
            toast.success(message)
          }}
          onError={function notifyActionError(message) { toast.error(message) }}
          onDeleted={function returnAfterDeletion() {
            toast.success('Incident supprimé.')
            onNavigate('attendance')
          }}
        />
      )}
    </main>
  )
}

function AttendanceDetailActions({ account, detail, onOpenAction, onReview }) {
  const isAdmin = account?.role === 'ADMIN'
  const isTeacher = account?.role === 'TEACHER'
  const isStudent = account?.role === 'STUDENT'

  return (
    <section className="attendance-detail-card attendance-detail-actions">
      <h2>Actions</h2>
      <div>
        {isStudent && detail.justification_status === 'UNJUSTIFIED' && (
          <button type="button" className="attendance-detail-button" onClick={function openJustification() { onOpenAction('justify') }}>
            <FileText /> Justifier l’incident
          </button>
        )}
        {isTeacher && (
          <button type="button" className="attendance-detail-button" onClick={function openCorrectionRequest() { onOpenAction('request') }}>
            <Pencil /> Signaler une correction
          </button>
        )}
        {isAdmin && detail.justification_status === 'PENDING' && (
          <>
            <button type="button" className="attendance-detail-button attendance-detail-button--success" onClick={function approveJustification() { onReview('JUSTIFIED') }}>
              <Check /> Accepter le justificatif
            </button>
            <button type="button" className="attendance-detail-button attendance-detail-button--danger" onClick={function rejectJustification() { onReview('REJECTED') }}>
              <X /> Refuser le justificatif
            </button>
          </>
        )}
        {isAdmin && (
          <button type="button" className="attendance-detail-button" onClick={function openEdit() { onOpenAction('edit') }}>
            <Pencil /> Corriger l’incident
          </button>
        )}
      </div>
    </section>
  )
}

function AttendanceActionDialog({ detail, mode, onClose, onSaved, onError, onDeleted }) {
  const [reason, setReason] = useState('')
  const [file, setFile] = useState(null)
  const [incidentType, setIncidentType] = useState(detail.incident_type)
  const [lateMinutes, setLateMinutes] = useState(detail.late_minutes || '')
  const [changeReason, setChangeReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      if (mode === 'justify') {
        await uploadMyAttendanceJustification(detail.id, reason, file)
        await onSaved('Justificatif transmis.')
        return
      }
      if (mode === 'request') {
        await createAttendanceChangeRequest(detail.id, {
          requested_action: 'UPDATE',
          proposed_incident_type: incidentType,
          proposed_late_minutes: incidentType === 'LATE' ? Number(lateMinutes) : null,
          proposed_reason: reason || null,
          request_reason: changeReason,
        })
        await onSaved('Demande de correction transmise.')
        return
      }
      await updateAttendanceRecord(detail.id, {
        incident_type: incidentType,
        late_minutes: incidentType === 'LATE' ? Number(lateMinutes) : null,
        reason: reason || null,
        change_reason: changeReason,
      })
      await onSaved('Incident corrigé.')
    } catch (error) {
      onError(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteIncident() {
    if (changeReason.trim().length < 3) return
    setSaving(true)
    try {
      await deleteAttendanceRecord(detail.id, changeReason)
      onDeleted()
    } catch (error) {
      onError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const isJustification = mode === 'justify'
  const isRequest = mode === 'request'
  const title = isJustification ? 'Justifier l’incident' : isRequest ? 'Signaler une correction' : 'Corriger l’incident'

  return (
    <div className="attendance-detail-dialog-backdrop" role="presentation">
      <section className="attendance-detail-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Fermer"><X /></button></header>
        <form onSubmit={submit}>
          {!isJustification && <label>Incident<select value={incidentType} onChange={function changeType(event) { setIncidentType(event.target.value) }}><option value="ABSENT">Absence</option><option value="LATE">Retard</option></select></label>}
          {!isJustification && incidentType === 'LATE' && <label>Minutes de retard<input type="number" min="1" required value={lateMinutes} onChange={function changeMinutes(event) { setLateMinutes(event.target.value) }} /></label>}
          <label>{isJustification ? 'Explication' : 'Motif'}<textarea required={isJustification} value={reason} onChange={function changeReason(event) { setReason(event.target.value) }} /></label>
          {isJustification && <label>Document facultatif<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={function changeFile(event) { setFile(event.target.files?.[0] || null) }} /></label>}
          {!isJustification && <label>Raison de la modification<textarea required minLength="3" value={changeReason} onChange={function changeChangeReason(event) { setChangeReason(event.target.value) }} /></label>}
          <footer><button type="button" onClick={onClose}>Annuler</button>{mode === 'edit' && <button type="button" className="attendance-detail-button--danger" disabled={saving || changeReason.trim().length < 3} onClick={deleteIncident}>Supprimer</button>}<button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></footer>
        </form>
      </section>
    </div>
  )
}
