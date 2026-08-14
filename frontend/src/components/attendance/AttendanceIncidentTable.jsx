/** Liste consultable des incidents d'assiduité, sans actions directes. */
function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

function incidentLabel(value) {
  return value === 'LATE' ? 'Retard' : 'Absence'
}

function justificationLabel(value) {
  return {
    UNJUSTIFIED: 'Non justifiée',
    PENDING: 'En attente',
    JUSTIFIED: 'Justifiée',
    REJECTED: 'Refusée',
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

export default function AttendanceIncidentTable({ records, onOpen }) {
  if (!records.length) {
    return <p className="attendance-empty">Aucun incident enregistré.</p>
  }

  return (
    <div className="attendance-table-wrap">
      <table className="attendance-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Élève</th>
            <th>Classe / matière</th>
            <th>Incident</th>
            <th>Justification</th>
          </tr>
        </thead>
        <tbody>
          {records.map(function renderRecord(record) {
            return (
              <tr
                key={record.id}
                className="attendance-clickable-row"
                tabIndex="0"
                onClick={function openRecord() { onOpen?.(record) }}
                onKeyDown={function openRecordWithKeyboard(event) {
                  if (event.key === 'Enter') onOpen?.(record)
                }}
              >
                <td>{formatDate(record.attendance_date)}</td>
                <td>{record.student_name || 'Moi'}<small>{record.registration_number}</small></td>
                <td>{record.class_name}<small>{record.subject_name}</small></td>
                <td>{incidentLabel(record.incident_type)}{record.late_minutes ? ` (${record.late_minutes} min)` : ''}</td>
                <td>
                  <span className={`attendance-badge attendance-badge--${statusTone(record.justification_status)}`}>
                    {justificationLabel(record.justification_status)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
