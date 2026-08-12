import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck,
  Check,
  Clock3,
  FileUp,
  History,
  Eye,
  Pencil,
  Trash2,
  UserX,
  X,
} from 'lucide-react'

import { useToast } from '../components/feedback/ToastProvider.jsx'
import {
  createAttendanceChangeRequest,
  createAttendanceEvent,
  deleteAttendanceRecord,
  getAbsenceAlerts,
  getAttendanceChangeRequests,
  getAttendanceDocumentFile,
  getAttendanceDocuments,
  getAttendanceEvents,
  getAttendanceOptions,
  getAttendanceRecords,
  getAttendanceRoster,
  getMyAttendance,
  reviewAttendanceChangeRequest,
  reviewAttendanceJustification,
  updateAttendanceRecord,
  uploadMyAttendanceJustification,
} from '../services/attendance_service.js'
import '../styles/attendance_page.css'

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

function incidentLabel(value) {
  return value === 'LATE' ? 'Retard' : 'Absence'
}

function justificationLabel(value) {
  return {
    UNJUSTIFIED: 'Non justifiee',
    PENDING: 'En attente',
    JUSTIFIED: 'Justifiee',
    REJECTED: 'Refusee',
  }[value] || value
}

function statusTone(value) {
  return {
    UNJUSTIFIED: 'danger',
    PENDING: 'warning',
    JUSTIFIED: 'success',
    REJECTED: 'danger',
  }[value] || 'neutral'
}

export default function AttendancePage({ account, onNavigate }) {
  if (account.role === 'STUDENT') return <StudentAttendanceView onNavigate={onNavigate} />
  if (account.role === 'TEACHER') return <TeacherAttendanceView onNavigate={onNavigate} />
  return <AdminAttendanceView onNavigate={onNavigate} />
}

function PageHeader({ subtitle }) {
  return (
    <header className="attendance-header">
      <h1>Absences et retards</h1>
      <nav aria-label="Fil d’Ariane"><span>Accueil</span> › Assiduité</nav>
      <p>{subtitle}</p>
    </header>
  )
}

function SummaryCards({ absenceCount = 0, lateCount = 0, pendingCount = 0 }) {
  return (
    <section className="attendance-summary" aria-label="Synthèse de l’assiduité">
      <SummaryCard icon={<UserX />} value={absenceCount} label="Absences" tone="danger" />
      <SummaryCard icon={<Clock3 />} value={lateCount} label="Retards" tone="warning" />
      <SummaryCard icon={<FileUp />} value={pendingCount} label="Justificatifs en attente" tone="primary" />
    </section>
  )
}

function AbsenceAlertsPanel({ alerts, onOpenStudent }) {
  if (!alerts || alerts.length === 0) return null
  return (
    <section className="attendance-panel attendance-alerts" aria-label="Élèves à surveiller">
      <h2><AlertTriangle aria-hidden="true" /> Élèves à surveiller ({alerts.length})</h2>
      <p className="attendance-alerts__hint">
        Absences non justifiées ou refusées, sur l’année scolaire en cours.
      </p>
      <ul className="attendance-alerts__list">
        {alerts.map(function renderAlert(alert) {
          return (
            <li key={alert.student_id} className="attendance-alerts__item">
              <button type="button" onClick={() => onOpenStudent(alert)}>
                <span className="attendance-alerts__name">{alert.first_name} {alert.last_name}</span>
                <span className="attendance-alerts__class">{alert.class_name}</span>
                <span className="attendance-alerts__count">{alert.unjustified_absence_count} absences</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function SummaryCard({ icon, value, label, tone }) {
  return (
    <article className={`attendance-summary-card attendance-summary-card--${tone}`}>
      <span>{icon}</span><strong>{value}</strong><small>{label}</small>
    </article>
  )
}

function TeacherAttendanceView({ onNavigate }) {
  const toast = useToast()
  const [tab, setTab] = useState('call')
  const [options, setOptions] = useState([])
  const [events, setEvents] = useState([])
  const [records, setRecords] = useState([])
  const [assignmentId, setAssignmentId] = useState('')
  const [attendanceDate, setAttendanceDate] = useState(todayValue())
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:00')
  const [roster, setRoster] = useState([])
  const [states, setStates] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [correctionRecord, setCorrectionRecord] = useState(null)

  useEffect(function loadTeacherDataEffect() {
    async function loadTeacherData() {
      try {
        const [optionRows, eventRows, recordRows] = await Promise.all([
          getAttendanceOptions(), getAttendanceEvents(), getAttendanceRecords(),
        ])
        setOptions(optionRows)
        setEvents(eventRows)
        setRecords(recordRows)
      } catch (error) {
        toast.error(error.message)
      } finally {
        setLoading(false)
      }
    }
    loadTeacherData()
  }, [])

  async function loadRoster() {
    if (!assignmentId || !attendanceDate) return
    try {
      const rows = await getAttendanceRoster(assignmentId, attendanceDate)
      setRoster(rows)
      setStates({})
    } catch (error) {
      toast.error(error.message)
    }
  }

  function updateStudentState(enrollmentId, field, value) {
    setStates(function update(current) {
      return {
        ...current,
        [enrollmentId]: {
          status: 'PRESENT', late_minutes: '', reason: '',
          ...(current[enrollmentId] || {}), [field]: value,
        },
      }
    })
  }

  async function submitCall(event) {
    event.preventDefault()
    setSubmitting(true)
    const incidents = roster.flatMap(function buildIncident(student) {
      const state = states[student.student_enrollment_id] || { status: 'PRESENT' }
      if (state.status === 'PRESENT') return []
      return [{
        student_enrollment_id: student.student_enrollment_id,
        incident_type: state.status,
        late_minutes: state.status === 'LATE' ? Number(state.late_minutes) : null,
        reason: state.reason || null,
      }]
    })
    try {
      await createAttendanceEvent({
        teacher_assignment_id: assignmentId,
        attendance_date: attendanceDate,
        course_start_time: startTime,
        course_end_time: endTime,
        incidents,
      })
      toast.success("L'appel a été enregistré.")
      setRoster([])
      setEvents(await getAttendanceEvents())
      setRecords(await getAttendanceRecords())
      setTab('history')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="attendance-page">
      <PageHeader subtitle="Effectuez les appels et signalez les corrections nécessaires." />
      <div className="attendance-tabs" role="tablist">
        <TabButton active={tab === 'call'} onClick={() => setTab('call')} icon={<CalendarCheck />} label="Faire l’appel" />
        <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={<History />} label="Mes appels et incidents" />
      </div>
      {tab === 'call' ? (
        <form className="attendance-panel" onSubmit={submitCall}>
          <h2>Nouvel appel</h2>
          <div className="attendance-call-fields">
            <label>Cours<select required value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
              <option value="">Sélectionner une classe et une matière</option>
              {options.map((option) => <option key={option.id} value={option.id}>{option.class_name} — {option.subject_name}</option>)}
            </select></label>
            <label>Date<input type="date" required value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} /></label>
            <label>Début<input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
            <label>Fin<input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
            <button className="attendance-button attendance-button--outline" type="button" onClick={loadRoster}>Charger les élèves</button>
          </div>
          {roster.length > 0 && <RosterTable roster={roster} states={states} onChange={updateStudentState} />}
          {roster.length > 0 && <div className="attendance-form-actions"><button className="attendance-button" disabled={submitting}>{submitting ? 'Enregistrement…' : 'Enregistrer l’appel'}</button></div>}
        </form>
      ) : (
        <section className="attendance-panel">
          <h2>Historique de mes appels</h2>
          {loading ? <p>Chargement…</p> : <EventTable events={events} />}
          <h2>Incidents signalés</h2>
          <IncidentTable records={records} actionLabel="Signaler une correction" onAction={setCorrectionRecord} onOpen={function openDetail(record) { onNavigate('attendance-record-details', record) }} />
        </section>
      )}
      {correctionRecord && <CorrectionModal record={correctionRecord} onClose={() => setCorrectionRecord(null)} onSaved={async () => { setCorrectionRecord(null); toast.success('Demande transmise à l’administration.') }} />}
    </div>
  )
}

function RosterTable({ roster, states, onChange }) {
  return (
    <div className="attendance-table-wrap"><table className="attendance-table">
      <thead><tr><th>Élève</th><th>Matricule</th><th>Statut</th><th>Minutes</th><th>Motif initial</th></tr></thead>
      <tbody>{roster.map(function renderStudent(student) {
        const state = states[student.student_enrollment_id] || { status: 'PRESENT', late_minutes: '', reason: '' }
        return <tr key={student.student_enrollment_id}>
          <td><strong>{student.last_name} {student.first_name}</strong></td><td>{student.registration_number}</td>
          <td><select value={state.status} onChange={(e) => onChange(student.student_enrollment_id, 'status', e.target.value)}><option value="PRESENT">Présent</option><option value="ABSENT">Absent</option><option value="LATE">En retard</option></select></td>
          <td><input aria-label="Minutes de retard" type="number" min="1" disabled={state.status !== 'LATE'} required={state.status === 'LATE'} value={state.late_minutes} onChange={(e) => onChange(student.student_enrollment_id, 'late_minutes', e.target.value)} /></td>
          <td><input aria-label="Motif" value={state.reason} disabled={state.status === 'PRESENT'} onChange={(e) => onChange(student.student_enrollment_id, 'reason', e.target.value)} /></td>
        </tr>
      })}</tbody>
    </table></div>
  )
}

function AdminAttendanceView({ onNavigate }) {
  const toast = useToast()
  const [records, setRecords] = useState([])
  const [requests, setRequests] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editingRecord, setEditingRecord] = useState(null)

  async function loadAdminData() {
    try {
      const [recordRows, requestRows, alertRows] = await Promise.all([
        getAttendanceRecords(), getAttendanceChangeRequests('PENDING'), getAbsenceAlerts(),
      ])
      setRecords(recordRows)
      setRequests(requestRows)
      setAlerts(alertRows)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(function loadAdminDataEffect() { loadAdminData() }, [])

  const counts = useMemo(function calculateCounts() {
    return {
      absences: records.filter((item) => item.incident_type === 'ABSENT').length,
      lates: records.filter((item) => item.incident_type === 'LATE').length,
      pending: records.filter((item) => item.justification_status === 'PENDING').length,
    }
  }, [records])

  const filteredRecords = useMemo(function filterRecords() {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr')
    return records.filter(function keepRecord(record) {
      const matchesQuery = !normalizedQuery
        || `${record.student_name} ${record.registration_number} ${record.class_name} ${record.subject_name}`
          .toLocaleLowerCase('fr').includes(normalizedQuery)
      return matchesQuery
        && (!typeFilter || record.incident_type === typeFilter)
        && (!statusFilter || record.justification_status === statusFilter)
    })
  }, [records, query, typeFilter, statusFilter])

  async function decideJustification(record, decision) {
    try {
      await reviewAttendanceJustification(record.id, { status: decision, review_comment: null })
      toast.success(decision === 'JUSTIFIED' ? 'Justificatif accepté.' : 'Justificatif refusé.')
      await loadAdminData()
    } catch (error) { toast.error(error.message) }
  }

  async function decideRequest(request, decision) {
    try {
      await reviewAttendanceChangeRequest(request.id, { decision, review_comment: null })
      toast.success(decision === 'APPROVED' ? 'Correction appliquée.' : 'Demande rejetée.')
      await loadAdminData()
    } catch (error) { toast.error(error.message) }
  }

  async function viewJustification(record) {
    try {
      const documents = await getAttendanceDocuments(record.id)
      if (!documents.length) throw new Error('Aucun justificatif disponible.')
      const blob = await getAttendanceDocumentFile(record.id, documents[0].id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(function releaseUrl() { URL.revokeObjectURL(url) }, 60000)
    } catch (error) { toast.error(error.message) }
  }

  return <div className="attendance-page">
    <PageHeader subtitle="Supervisez les incidents, justificatifs et signalements des enseignants." />
    <SummaryCards absenceCount={counts.absences} lateCount={counts.lates} pendingCount={counts.pending} />
    <AbsenceAlertsPanel alerts={alerts} onOpenStudent={function openStudent(alert) { onNavigate('student-details', { id: alert.student_id }) }} />
    <AdminCallPanel onSaved={loadAdminData} />
    <section className="attendance-panel"><h2>Absences et retards</h2>
      <div className="attendance-filters">
        <input placeholder="Élève, matricule, classe ou matière…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Tous les incidents</option><option value="ABSENT">Absences</option><option value="LATE">Retards</option></select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Tous les justificatifs</option><option value="UNJUSTIFIED">Non justifiés</option><option value="PENDING">En attente</option><option value="JUSTIFIED">Justifiés</option><option value="REJECTED">Refusés</option></select>
      </div>
      {loading ? <p>Chargement…</p> : <IncidentTable records={filteredRecords} admin onJustification={decideJustification} onEdit={setEditingRecord} onView={viewJustification} onOpen={function openDetail(record) { onNavigate('attendance-record-details', record) }} />}
    </section>
    <section className="attendance-panel"><h2>Corrections signalées <span className="attendance-count">{requests.length}</span></h2>
      <ChangeRequestTable requests={requests} onDecision={decideRequest} />
    </section>
    {editingRecord && <AdminEditModal record={editingRecord} onClose={() => setEditingRecord(null)} onSaved={async () => { setEditingRecord(null); toast.success('Incident mis à jour.'); await loadAdminData() }} />}
  </div>
}

function AdminCallPanel({ onSaved }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState([])
  const [assignmentId, setAssignmentId] = useState('')
  const [attendanceDate, setAttendanceDate] = useState(todayValue())
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:00')
  const [roster, setRoster] = useState([])
  const [states, setStates] = useState({})

  async function togglePanel() {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen && !options.length) {
      try { setOptions(await getAttendanceOptions()) } catch (error) { toast.error(error.message) }
    }
  }

  async function loadRoster() {
    if (!assignmentId) return
    try {
      setRoster(await getAttendanceRoster(assignmentId, attendanceDate))
      setStates({})
    } catch (error) { toast.error(error.message) }
  }

  function updateStudentState(enrollmentId, field, value) {
    setStates(function update(current) {
      return { ...current, [enrollmentId]: { status: 'PRESENT', late_minutes: '', reason: '', ...(current[enrollmentId] || {}), [field]: value } }
    })
  }

  async function submit(event) {
    event.preventDefault()
    const incidents = roster.flatMap(function makeIncident(student) {
      const state = states[student.student_enrollment_id] || { status: 'PRESENT' }
      if (state.status === 'PRESENT') return []
      return [{ student_enrollment_id: student.student_enrollment_id, incident_type: state.status, late_minutes: state.status === 'LATE' ? Number(state.late_minutes) : null, reason: state.reason || null }]
    })
    try {
      await createAttendanceEvent({ teacher_assignment_id: assignmentId, attendance_date: attendanceDate, course_start_time: startTime, course_end_time: endTime, incidents })
      toast.success("L'appel administratif a été enregistré.")
      setRoster([])
      setOpen(false)
      await onSaved()
    } catch (error) { toast.error(error.message) }
  }

  return <section className="attendance-panel"><div className="attendance-panel-heading"><div><h2>Enregistrer un appel</h2><p>Intervenez sur n’importe quelle classe en cas de besoin.</p></div><button className="attendance-button attendance-button--outline" type="button" onClick={togglePanel}>{open ? 'Fermer' : 'Nouvel appel'}</button></div>{open && <form onSubmit={submit}><div className="attendance-call-fields"><label>Cours<select required value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}><option value="">Sélectionner une classe et une matière</option>{options.map((option) => <option key={option.id} value={option.id}>{option.class_name} — {option.subject_name} — {option.teacher_name}</option>)}</select></label><label>Date<input required type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></label><label>Début<input required type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label>Fin<input required type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label><button className="attendance-button attendance-button--outline" type="button" onClick={loadRoster}>Charger</button></div>{roster.length > 0 && <RosterTable roster={roster} states={states} onChange={updateStudentState} />}{roster.length > 0 && <div className="attendance-form-actions"><button className="attendance-button">Enregistrer l’appel</button></div>}</form>}</section>
}

function StudentAttendanceView({ onNavigate }) {
  const toast = useToast()
  const [data, setData] = useState({ absence_count: 0, late_count: 0, pending_justification_count: 0, incidents: [] })
  const [selected, setSelected] = useState(null)

  async function loadData() {
    try { setData(await getMyAttendance()) } catch (error) { toast.error(error.message) }
  }
  useEffect(function loadStudentAttendanceEffect() { loadData() }, [])

  return <div className="attendance-page">
    <PageHeader subtitle="Consultez votre assiduité et transmettez vos justificatifs." />
    <SummaryCards absenceCount={data.absence_count} lateCount={data.late_count} pendingCount={data.pending_justification_count} />
    <section className="attendance-panel"><h2>Mon historique</h2>
      <IncidentTable records={data.incidents} actionLabel="Justifier" onAction={setSelected} student onOpen={function openDetail(record) { onNavigate('attendance-record-details', record) }} />
    </section>
    {selected && <JustificationModal record={selected} onClose={() => setSelected(null)} onSaved={async () => { setSelected(null); toast.success('Justificatif transmis.'); await loadData() }} />}
  </div>
}

function TabButton({ active, onClick, icon, label }) {
  return <button type="button" className={active ? 'attendance-tab attendance-tab--active' : 'attendance-tab'} onClick={onClick}>{icon}{label}</button>
}

function EventTable({ events }) {
  if (!events.length) return <p className="attendance-empty">Aucun appel enregistré.</p>
  return <div className="attendance-table-wrap"><table className="attendance-table"><thead><tr><th>Date</th><th>Classe</th><th>Matière</th><th>Horaire</th><th>Absences</th><th>Retards</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{formatDate(event.attendance_date)}</td><td>{event.class_name}</td><td>{event.subject_name}</td><td>{String(event.course_start_time).slice(0, 5)}–{String(event.course_end_time).slice(0, 5)}</td><td>{event.absence_count}</td><td>{event.late_count}</td></tr>)}</tbody></table></div>
}

function IncidentTable({ records, actionLabel, onAction, admin = false, onJustification, onEdit, onView, onOpen }) {
  if (!records.length) return <p className="attendance-empty">Aucun incident enregistré.</p>
  return <div className="attendance-table-wrap"><table className="attendance-table"><thead><tr><th>Date</th><th>Élève</th><th>Classe / matière</th><th>Incident</th><th>Justification</th><th>Action</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="attendance-clickable-row" tabIndex="0" onClick={function openRecord() { onOpen?.(record) }} onKeyDown={function openRecordWithKeyboard(event) { if (event.key === 'Enter') onOpen?.(record) }}>
    <td>{formatDate(record.attendance_date)}</td><td>{record.student_name || 'Moi'}<small>{record.registration_number}</small></td><td>{record.class_name}<small>{record.subject_name}</small></td>
    <td>{incidentLabel(record.incident_type)}{record.late_minutes ? ` (${record.late_minutes} min)` : ''}</td><td><span className={`attendance-badge attendance-badge--${statusTone(record.justification_status)}`}>{justificationLabel(record.justification_status)}</span></td>
    <td onClick={function stopRowNavigation(event) { event.stopPropagation() }}>{admin ? <div className="attendance-inline-actions">{record.has_document && <button type="button" title="Voir le justificatif" onClick={() => onView(record)}><Eye /></button>}{record.justification_status === 'PENDING' && <><button type="button" title="Accepter" onClick={() => onJustification(record, 'JUSTIFIED')}><Check /></button><button type="button" title="Refuser" onClick={() => onJustification(record, 'REJECTED')}><X /></button></>}{record.justification_status === 'REJECTED' && <button type="button" title="Revenir sur le refus et accepter" onClick={() => onJustification(record, 'JUSTIFIED')}><Check /></button>}<button type="button" title="Corriger" onClick={() => onEdit(record)}><Pencil /></button></div> : actionLabel && actionLabel.includes('correction') ? <button className="attendance-link-button" type="button" onClick={() => onAction(record)}>{actionLabel}</button> : record.justification_status === 'UNJUSTIFIED' ? (record.can_justify === false ? <span className="attendance-muted" title={`Délai dépassé (limite : ${formatDate(record.justification_deadline)})`}>Délai dépassé</span> : <span className="attendance-action-with-hint"><button className="attendance-link-button" type="button" onClick={() => onAction(record)}>{actionLabel}</button>{record.justification_deadline && <small>avant le {formatDate(record.justification_deadline)}</small>}</span>) : record.justification_status === 'REJECTED' ? <span className="attendance-muted">Refusé — non modifiable</span> : '—'}</td>
  </tr>)}</tbody></table></div>
}

function ChangeRequestTable({ requests, onDecision }) {
  if (!requests.length) return <p className="attendance-empty">Aucune correction en attente.</p>
  return <div className="attendance-table-wrap"><table className="attendance-table"><thead><tr><th>Élève</th><th>Date</th><th>Demande</th><th>Motif</th><th>Décision</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td>{request.student_name}</td><td>{formatDate(request.attendance_date)}</td><td>{request.requested_action === 'DELETE' ? 'Supprimer l’incident' : `Modifier en ${incidentLabel(request.proposed_incident_type)}`}</td><td>{request.request_reason}</td><td><div className="attendance-inline-actions"><button type="button" onClick={() => onDecision(request, 'APPROVED')}><Check /></button><button type="button" onClick={() => onDecision(request, 'REJECTED')}><X /></button></div></td></tr>)}</tbody></table></div>
}

function CorrectionModal({ record, onClose, onSaved }) {
  const toast = useToast()
  const [action, setAction] = useState('UPDATE')
  const [type, setType] = useState(record.incident_type)
  const [minutes, setMinutes] = useState(record.late_minutes || '')
  const [reason, setReason] = useState(record.reason || '')
  const [requestReason, setRequestReason] = useState('')
  async function submit(event) {
    event.preventDefault()
    try {
      await createAttendanceChangeRequest(record.id, {
        requested_action: action,
        proposed_incident_type: action === 'UPDATE' ? type : null,
        proposed_late_minutes: action === 'UPDATE' && type === 'LATE' ? Number(minutes) : null,
        proposed_reason: action === 'UPDATE' ? reason || null : null,
        request_reason: requestReason,
      })
      await onSaved()
    } catch (error) { toast.error(error.message) }
  }
  return <Modal title="Signaler une correction" onClose={onClose}><form onSubmit={submit} className="attendance-modal-form"><label>Action<select value={action} onChange={(e) => setAction(e.target.value)}><option value="UPDATE">Modifier</option><option value="DELETE">Supprimer l’incident</option></select></label>{action === 'UPDATE' && <><label>Incident<select value={type} onChange={(e) => setType(e.target.value)}><option value="ABSENT">Absence</option><option value="LATE">Retard</option></select></label>{type === 'LATE' && <label>Minutes<input type="number" min="1" required value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>}<label>Motif constaté<input value={reason} onChange={(e) => setReason(e.target.value)} /></label></>}<label>Raison de la correction<textarea required minLength="3" value={requestReason} onChange={(e) => setRequestReason(e.target.value)} /></label><ModalActions onClose={onClose} label="Envoyer la demande" /></form></Modal>
}

function AdminEditModal({ record, onClose, onSaved }) {
  const toast = useToast()
  const [type, setType] = useState(record.incident_type)
  const [minutes, setMinutes] = useState(record.late_minutes || '')
  const [reason, setReason] = useState(record.reason || '')
  const [changeReason, setChangeReason] = useState('')

  async function save(event) {
    event.preventDefault()
    try {
      await updateAttendanceRecord(record.id, {
        incident_type: type,
        late_minutes: type === 'LATE' ? Number(minutes) : null,
        reason: reason || null,
        change_reason: changeReason,
      })
      await onSaved()
    } catch (error) { toast.error(error.message) }
  }

  async function removeRecord() {
    if (changeReason.trim().length < 3) {
      toast.error('Indiquez le motif de la suppression.')
      return
    }
    try {
      await deleteAttendanceRecord(record.id, changeReason)
      await onSaved()
    } catch (error) { toast.error(error.message) }
  }

  return <Modal title="Corriger un incident" onClose={onClose}><form onSubmit={save} className="attendance-modal-form"><label>Incident<select value={type} onChange={(event) => setType(event.target.value)}><option value="ABSENT">Absence</option><option value="LATE">Retard</option></select></label>{type === 'LATE' && <label>Minutes<input required min="1" type="number" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label>}<label>Motif constaté<input value={reason} onChange={(event) => setReason(event.target.value)} /></label><label>Motif de la modification ou suppression<textarea required minLength="3" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} /></label><div className="attendance-form-actions attendance-form-actions--split"><button type="button" className="attendance-button attendance-button--danger" onClick={removeRecord}><Trash2 /> Supprimer</button><span /><button type="button" className="attendance-button attendance-button--outline" onClick={onClose}>Annuler</button><button className="attendance-button">Enregistrer</button></div></form></Modal>
}

function JustificationModal({ record, onClose, onSaved }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [file, setFile] = useState(null)
  async function submit(event) {
    event.preventDefault()
    try { await uploadMyAttendanceJustification(record.id, reason, file); await onSaved() } catch (error) { toast.error(error.message) }
  }
  return <Modal title={`Justifier ${incidentLabel(record.incident_type).toLowerCase()}`} onClose={onClose}><form onSubmit={submit} className="attendance-modal-form"><p>Incident du {formatDate(record.attendance_date)} — {record.subject_name}</p><label>Explication<textarea required minLength="3" value={reason} onChange={(e) => setReason(e.target.value)} /></label><label>Document facultatif (PDF ou image, 5 Mo maximum)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label><ModalActions onClose={onClose} label="Transmettre" /></form></Modal>
}

function Modal({ title, onClose, children }) {
  return <div className="attendance-modal-backdrop" role="presentation"><section className="attendance-modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Fermer"><X /></button></header>{children}</section></div>
}

function ModalActions({ onClose, label }) {
  return <div className="attendance-form-actions"><button type="button" className="attendance-button attendance-button--outline" onClick={onClose}>Annuler</button><button className="attendance-button" type="submit">{label}</button></div>
}
