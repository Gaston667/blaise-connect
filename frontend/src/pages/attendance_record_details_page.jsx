import { ArrowLeft, Clock3, FileText, History, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useToast } from '../components/feedback/ToastProvider.jsx'
import {
  getAttendanceDocumentFile,
  getAttendanceRecordDetail,
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

export default function AttendanceRecordDetailsPage({ recordId, onNavigate }) {
  const toast = useToast()
  const [detail, setDetail] = useState(null)

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

  if (!detail) return <main className="attendance-detail-page">Chargement…</main>

  return (
    <main className="attendance-detail-page">
      <header className="attendance-detail-header">
        <button type="button" onClick={function returnToAttendance() { onNavigate('attendance') }}>
          <ArrowLeft /> Retour
        </button>
        <h1>Détail de {detail.incident_type === 'LATE' ? 'retard' : 'l’absence'}</h1>
        <p>Accueil › Assiduité › Détail</p>
      </header>

      <section className="attendance-detail-summary">
        <UserRound />
        <div><small>Élève</small><strong>{detail.student_name}</strong><span>{detail.registration_number}</span></div>
        <div><small>Incident</small><strong>{detail.incident_type === 'LATE' ? `Retard (${detail.late_minutes} min)` : 'Absence'}</strong></div>
        <div><small>Statut</small><strong>{statusLabel(detail.justification_status)}</strong></div>
      </section>

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
    </main>
  )
}
