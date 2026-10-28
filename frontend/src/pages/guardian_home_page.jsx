import { useEffect, useState } from 'react'
import {
  Award,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileText,
  NotebookPen,
  Sparkles,
  TrendingUp,
  UserRoundX,
} from 'lucide-react'

import { useGuardianChild } from '../context/guardian_child_context.js'
import { getMyAttendance } from '../services/attendance_service.js'
import { getMyGradesSummary } from '../services/student_grades_service.js'
import '../styles/guardian_portal.css'

const RELATIONSHIP_LABELS = { FATHER: 'Père', MOTHER: 'Mère' }

const QUICK_LINKS = [
  { page: 'student-grades', label: 'Notes', description: 'Évaluations et moyennes', icon: NotebookPen, tone: 'violet' },
  { page: 'student-timetable', label: 'Emploi du temps', description: 'Les cours de la semaine', icon: CalendarDays, tone: 'blue' },
  { page: 'attendance', label: 'Absences', description: 'Absences et retards', icon: UserRoundX, tone: 'orange' },
  { page: 'guardian-report-cards', label: 'Bulletins', description: 'Bulletins validés', icon: FileText, tone: 'green' },
]

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

function getRelationshipLabel(kid) {
  return RELATIONSHIP_LABELS[kid.relationship_type] ?? kid.relationship_details ?? 'Responsable'
}

function formatAverage(value) {
  const numericValue = Number(value)
  return value === null || value === undefined || !Number.isFinite(numericValue)
    ? '—'
    : numericValue.toFixed(2).replace('.', ',')
}

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00`))
}

function getGuardianSalutation(account) {
  const title = account.gender === 'FEMALE' ? 'Madame' : account.gender === 'MALE' ? 'Monsieur' : null
  if (title && account.last_name) return `${title} ${account.last_name}`
  return account.first_name ?? 'bienvenue'
}

/** Accueil du portail parents : enfants, indicateurs clés et raccourcis. */
export default function GuardianHomePage({ account, onNavigate }) {
  const { kids, selectedChild, selectChild } = useGuardianChild()
  const [summary, setSummary] = useState(null)
  const [attendance, setAttendance] = useState(null)
  const [hasLoadError, setHasLoadError] = useState(false)

  useEffect(function loadIndicatorsEffect() {
    let cancelled = false
    async function load() {
      setSummary(null)
      setAttendance(null)
      setHasLoadError(false)
      try {
        const [summaryData, attendanceData] = await Promise.all([
          getMyGradesSummary(selectedChild.id),
          getMyAttendance(selectedChild.id),
        ])
        if (cancelled) return
        setSummary(summaryData)
        setAttendance(attendanceData)
      } catch {
        if (!cancelled) setHasLoadError(true)
      }
    }
    load()
    return function cancelLoad() { cancelled = true }
  }, [selectedChild.id])

  const nextAssessment = summary?.upcoming_assessments?.[0] ?? null
  const unjustifiedCount = attendance
    ? attendance.incidents.filter((item) => item.justification_status === 'UNJUSTIFIED').length
    : null

  return (
    <main className="gph-main">
      <header className="accueil-hero">
        <p className="accueil-eyebrow"><Sparkles aria-hidden="true" size={15} /> Espace familles</p>
        <h1 className="accueil-title">{getGreeting()}, {getGuardianSalutation(account)} !</h1>
        <p className="accueil-description">
          Suivez la scolarité de {kids.length > 1 ? 'vos enfants' : selectedChild.first_name} : notes, emploi du temps, absences et bulletins.
        </p>
        <p className="accueil-description">
          <strong>Vous consultez les informations de {selectedChild.first_name} {selectedChild.last_name}.</strong>
        </p>
      </header>

      <section className="gph-section" aria-labelledby="gph-indicators-title">
        <h2 id="gph-indicators-title">Le point sur {selectedChild.first_name}</h2>
        {hasLoadError ? (
          <p className="gph-error" role="alert">Impossible de charger les indicateurs pour le moment.</p>
        ) : (
          <div className="gph-stats">
            <article className="gph-stat gph-stat--blue">
              <span className="gph-stat__icon"><TrendingUp aria-hidden="true" size={20} /></span>
              <div>
                <small>Moyenne générale</small>
                <strong>{summary ? formatAverage(summary.overall_average) : '…'} <em>/20</em></strong>
              </div>
            </article>
            <article className="gph-stat gph-stat--gold">
              <span className="gph-stat__icon"><Award aria-hidden="true" size={20} /></span>
              <div>
                <small>Rang dans la classe</small>
                <strong>
                  {summary ? (summary.rank && summary.class_size ? `${summary.rank} / ${summary.class_size}` : '—') : '…'}
                </strong>
              </div>
            </article>
            <article className="gph-stat gph-stat--orange">
              <span className="gph-stat__icon"><UserRoundX aria-hidden="true" size={20} /></span>
              <div>
                <small>Absences</small>
                <strong>{attendance ? attendance.absence_count : '…'}</strong>
                {attendance && unjustifiedCount > 0 ? <span className="gph-stat__hint">{unjustifiedCount} non justifiée(s)</span> : null}
              </div>
            </article>
            <article className="gph-stat gph-stat--green">
              <span className="gph-stat__icon"><ClipboardCheck aria-hidden="true" size={20} /></span>
              <div>
                <small>Prochaine évaluation</small>
                <strong className="gph-stat__text">{summary ? (nextAssessment ? nextAssessment.subject_name : 'Aucune') : '…'}</strong>
                {nextAssessment ? <span className="gph-stat__hint">{formatDate(nextAssessment.assessment_date)} · {nextAssessment.title}</span> : null}
              </div>
            </article>
          </div>
        )}
      </section>

      <section className="accueil-quicklinks gph-quicklinks" aria-label="Accès rapides">
        {QUICK_LINKS.map(function renderQuickLink(link) {
          const Icon = link.icon
          return (
            <button
              key={link.page}
              type="button"
              className={`accueil-quicklink accueil-quicklink--${link.tone}`}
              onClick={() => onNavigate(link.page)}
            >
              <span className="accueil-quicklink__icon"><Icon aria-hidden="true" size={22} /></span>
              <span className="accueil-quicklink__text">
                <strong>{link.label}</strong>
                <span>{link.description}</span>
              </span>
            </button>
          )
        })}
      </section>

      <section className="gph-section" aria-labelledby="gph-kids-title">
        <h2 id="gph-kids-title">{kids.length > 1 ? 'Vos enfants' : 'Votre enfant'}</h2>
        <div className="gph-kids">
          {kids.map(function renderKid(kid) {
            const isSelected = kid.id === selectedChild.id
            return (
              <button
                key={kid.id}
                type="button"
                className={isSelected ? 'gph-kid gph-kid--active' : 'gph-kid'}
                onClick={() => selectChild(kid.id)}
                aria-pressed={isSelected}
              >
                <span className="gph-kid__avatar" aria-hidden="true">{`${kid.first_name[0]}${kid.last_name[0]}`.toUpperCase()}</span>
                <span className="gph-kid__info">
                  <strong>{kid.first_name} {kid.last_name}</strong>
                  <span>{kid.class_name ?? 'Aucune classe active'}{kid.school_year_name ? ` · ${kid.school_year_name}` : ''}</span>
                  <small>{getRelationshipLabel(kid)}</small>
                </span>
                <ChevronRight aria-hidden="true" size={18} />
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}
