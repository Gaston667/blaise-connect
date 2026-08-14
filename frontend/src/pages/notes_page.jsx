import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileUp,
  ListChecks,
  Plus,
  Search,
  Users,
} from 'lucide-react'

import { useToast } from '../components/feedback/ToastProvider.jsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import {
  applyGradeCorrectionDirectly,
  createAssessment,
  createGradeChangeRequest,
  decideGradeChangeRequest,
  getAssessmentGradeSheet,
  getAssessmentsSummary,
  getGradeDocumentDownloadUrl,
  getGradeDocuments,
  getGradeOptions,
  listAssessmentAssignmentOptions,
  listAssessments,
  listGradeChangeRequests,
  reviewGradeAbsence,
  submitAssessmentGradeSheet,
  uploadGradeJustification,
} from '../services/notes_service.js'
import '../styles/notes_page.css'

const EMPTY_OPTIONS = { classes: [], subjects: [], periods: [] }
const EMPTY_SUMMARY = {
  assessments_count: 0,
  students_count: 0,
  expected_grade_count: 0,
  grade_count: 0,
  scored_count: 0,
  absence_count: 0,
  missing_count: 0,
  official_average_on_20: null,
  excellent_count: 0,
  good_count: 0,
  average_count: 0,
  weak_count: 0,
}
const EMPTY_ASSESSMENT_FORM = {
  teacher_assignment_id: '',
  title: '',
  description: '',
  assessment_date: '',
  maximum_score: '20',
  coefficient: '1',
}
const EMPTY_SHEET_ENTRY_FORM = {
  score: '',
  comment: '',
  is_absent: false,
}
const PAGE_SIZE = 10

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function getCompletionLabel(status) {
  const labels = {
    EMPTY: 'À saisir',
    PARTIAL: 'En cours',
    PENDING_REVIEW: 'Justificatif à traiter',
    COMPLETE: 'Terminée',
  }
  return labels[status] || status
}

function getCompletionTone(status) {
  const tones = {
    EMPTY: 'neutral',
    PARTIAL: 'progress',
    PENDING_REVIEW: 'warning',
    COMPLETE: 'done',
  }
  return tones[status] || 'neutral'
}

function getAbsenceStatusLabel(status) {
  const labels = {
    PENDING: 'En attente',
    JUSTIFIED: 'Justifiée',
    REJECTED: 'Refusée',
    UNJUSTIFIED: 'Non justifiée',
  }
  return labels[status] || status || '—'
}

function getAbsenceStatusTone(status) {
  const tones = {
    PENDING: 'warning',
    JUSTIFIED: 'done',
    REJECTED: 'danger',
    UNJUSTIFIED: 'neutral',
  }
  return tones[status] || 'neutral'
}

export default function NotesPage({ account, onNavigate, initialAssessmentId }) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query)
  const [classFilter, setClassFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [filterOptions, setFilterOptions] = useState(EMPTY_OPTIONS)
  const [assessments, setAssessments] = useState([])
  const [dashboardSummary, setDashboardSummary] = useState(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [page, setPage] = useState(1)

  const [selectedAssessmentId, setSelectedAssessmentId] = useState('')
  const [gradeSheet, setGradeSheet] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailTab, setDetailTab] = useState('students')
  const [detailSearch, setDetailSearch] = useState('')
  const [detailStatusFilter, setDetailStatusFilter] = useState('')
  const [correctionRequests, setCorrectionRequests] = useState([])

  const [showAssessmentModal, setShowAssessmentModal] = useState(false)
  const [assessmentForm, setAssessmentForm] = useState(EMPTY_ASSESSMENT_FORM)
  const [assignmentOptions, setAssignmentOptions] = useState([])
  const [assessmentClassId, setAssessmentClassId] = useState('')
  const [assessmentSaving, setAssessmentSaving] = useState(false)
  const [assessmentError, setAssessmentError] = useState('')

  const [showSheetModal, setShowSheetModal] = useState(false)
  const [sheetStudentEnrollmentId, setSheetStudentEnrollmentId] = useState('')
  const [sheetEntryForm, setSheetEntryForm] = useState(EMPTY_SHEET_ENTRY_FORM)
  const [sheetSaving, setSheetSaving] = useState(false)
  const [sheetError, setSheetError] = useState('')

  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [correctionForm, setCorrectionForm] = useState(null)
  const [correctionSaving, setCorrectionSaving] = useState(false)
  const [decisionRequest, setDecisionRequest] = useState(null)
  const [decisionComment, setDecisionComment] = useState('')
  const [decisionSaving, setDecisionSaving] = useState(false)
  const [uploadingGradeId, setUploadingGradeId] = useState('')
  const [documentStudentName, setDocumentStudentName] = useState('')
  const [documentGradeId, setDocumentGradeId] = useState('')
  const [gradeDocuments, setGradeDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(false)

  const isAdmin = account?.role === 'ADMIN'

  useEffect(function openRequestedAssessmentEffect() {
    if (initialAssessmentId) {
      setSelectedAssessmentId(initialAssessmentId)
    }
  }, [initialAssessmentId])

  useEffect(function loadFilterOptionsEffect() {
    async function loadFilterOptions() {
      try {
        setFilterOptions(await getGradeOptions())
      } catch (error) {
        toast.error(error.message)
      }
    }
    loadFilterOptions()
  }, [])

  useEffect(function loadAssessmentsEffect() {
    async function loadWorkspace() {
      setLoading(true)
      setPageError('')
      try {
        const filters = {
          q: debouncedQuery,
          classId: classFilter,
          subjectId: subjectFilter,
          periodId: periodFilter,
        }
        const [assessmentRows, summary] = await Promise.all([
          listAssessments(filters),
          getAssessmentsSummary(),
        ])
        setAssessments(assessmentRows)
        setDashboardSummary(summary)
        setPage(1)
      } catch (error) {
        setAssessments([])
        setDashboardSummary(EMPTY_SUMMARY)
        setPageError(error.message)
        toast.error(error.message)
      } finally {
        setLoading(false)
      }
    }
    loadWorkspace()
  }, [debouncedQuery, classFilter, subjectFilter, periodFilter])

  useEffect(function loadSelectedAssessmentEffect() {
    if (!selectedAssessmentId) {
      setGradeSheet(null)
      setCorrectionRequests([])
      return
    }

    async function loadSelectedAssessment() {
      setDetailLoading(true)
      try {
        const [sheet, requests] = await Promise.all([
          getAssessmentGradeSheet(selectedAssessmentId),
          listGradeChangeRequests({ assessmentId: selectedAssessmentId }),
        ])
        setGradeSheet(sheet)
        setCorrectionRequests(requests)
      } catch (error) {
        toast.error(error.message)
        setGradeSheet(null)
      } finally {
        setDetailLoading(false)
      }
    }
    loadSelectedAssessment()
  }, [selectedAssessmentId])

  const pageCount = Math.max(1, Math.ceil(assessments.length / PAGE_SIZE))
  const paginatedAssessments = useMemo(function getPaginatedAssessments() {
    const start = (page - 1) * PAGE_SIZE
    return assessments.slice(start, start + PAGE_SIZE)
  }, [assessments, page])

  const assignmentClassOptions = useMemo(function getAssignmentClassOptions() {
    const uniqueByClassId = new Map()
    assignmentOptions.forEach(function collectClass(option) {
      if (!uniqueByClassId.has(option.class_id)) {
        uniqueByClassId.set(option.class_id, {
          id: option.class_id,
          name: option.class_name,
        })
      }
    })
    return Array.from(uniqueByClassId.values())
  }, [assignmentOptions])

  const assignmentSubjectOptions = useMemo(function getAssignmentSubjectOptions() {
    if (!assessmentClassId) return []
    return assignmentOptions.filter(function filterByClass(option) {
      return option.class_id === assessmentClassId
    })
  }, [assignmentOptions, assessmentClassId])

  const visibleGradeRows = useMemo(function getVisibleGradeRows() {
    const rows = gradeSheet?.rows || []
    const normalizedSearch = detailSearch.trim().toLowerCase()
    return rows.filter(function matchesDetailFilters(row) {
      const matchesSearch = !normalizedSearch
        || row.student_name.toLowerCase().includes(normalizedSearch)
        || row.registration_number.toLowerCase().includes(normalizedSearch)
      const matchesStatus = !detailStatusFilter
        || (detailStatusFilter === 'MISSING' && !row.grade_id)
        || row.result_type === detailStatusFilter
      return matchesSearch && matchesStatus
    })
  }, [gradeSheet, detailSearch, detailStatusFilter])

  const missingGradeRows = useMemo(function getMissingGradeRows() {
    return (gradeSheet?.rows || []).filter(function filterMissing(row) {
      return !row.grade_id
    })
  }, [gradeSheet])

  function handleHomeNavigation() {
    onNavigate?.('home')
  }

  function handleAssessmentSelection(assessmentId) {
    setSelectedAssessmentId(assessmentId)
    setDetailTab('students')
    setDetailSearch('')
    setDetailStatusFilter('')
  }

  function handleAssessmentRowKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handleAssessmentSelection(event.currentTarget.dataset.assessmentId)
  }

  function closeAssessmentDetail() {
    setSelectedAssessmentId('')
  }

  async function refreshSelectedAssessment() {
    if (!selectedAssessmentId) return
    const [sheet, requests, assessmentRows, summary] = await Promise.all([
      getAssessmentGradeSheet(selectedAssessmentId),
      listGradeChangeRequests({ assessmentId: selectedAssessmentId }),
      listAssessments({
        q: debouncedQuery,
        classId: classFilter,
        subjectId: subjectFilter,
        periodId: periodFilter,
      }),
      getAssessmentsSummary(),
    ])
    setGradeSheet(sheet)
    setCorrectionRequests(requests)
    setAssessments(assessmentRows)
    setDashboardSummary(summary)
  }

  async function openAssessmentModal() {
    setAssessmentForm(EMPTY_ASSESSMENT_FORM)
    setAssessmentClassId('')
    setAssessmentError('')
    setShowAssessmentModal(true)
    try {
      setAssignmentOptions(await listAssessmentAssignmentOptions())
    } catch (error) {
      setAssessmentError(error.message)
    }
  }

  function updateAssessmentForm(event) {
    const { name, value } = event.target
    setAssessmentForm(function mergeAssessmentForm(current) {
      return { ...current, [name]: value }
    })
  }

  function handleAssessmentClassChange(event) {
    const nextClassId = event.target.value
    setAssessmentClassId(nextClassId)
    setAssessmentForm(function mergeAssessmentForm(current) {
      return {
        ...current,
        teacher_assignment_id: '',
      }
    })
  }

  async function submitAssessment(event) {
    event.preventDefault()
    setAssessmentSaving(true)
    setAssessmentError('')
    try {
      const created = await createAssessment({
        ...assessmentForm,
        maximum_score: Number(assessmentForm.maximum_score),
        coefficient: Number(assessmentForm.coefficient),
        description: assessmentForm.description.trim() || null,
      })
      setShowAssessmentModal(false)
      toast.success('Évaluation créée avec succès.')
      const [assessmentRows, summary] = await Promise.all([
        listAssessments(),
        getAssessmentsSummary(),
      ])
      setAssessments(assessmentRows)
      setDashboardSummary(summary)
      handleAssessmentSelection(created.id)
    } catch (error) {
      setAssessmentError(error.message)
    } finally {
      setAssessmentSaving(false)
    }
  }

  async function openGradeSheetModal() {
    if (!selectedAssessmentId) return
    setSheetError('')
    try {
      const sheet = gradeSheet || await getAssessmentGradeSheet(selectedAssessmentId)
      const missingRows = (sheet.rows || []).filter(function filterMissing(row) {
        return !row.grade_id
      })
      if (missingRows.length === 0) {
        toast.warning('Tous les élèves ont déjà une note pour cette évaluation.')
        return
      }
      setGradeSheet(sheet)
      setSheetStudentEnrollmentId(missingRows[0].student_enrollment_id)
      setSheetEntryForm(EMPTY_SHEET_ENTRY_FORM)
      setShowSheetModal(true)
    } catch (error) {
      toast.error(error.message)
    }
  }

  function handleSheetStudentChange(event) {
    setSheetStudentEnrollmentId(event.target.value)
    setSheetEntryForm(EMPTY_SHEET_ENTRY_FORM)
  }

  function handleSheetEntryChange(event) {
    const { name, value } = event.target
    setSheetEntryForm(function mergeSheetEntryForm(current) {
      return { ...current, [name]: value }
    })
  }

  function handleSheetAbsentToggle(event) {
    const isAbsent = event.target.checked
    setSheetEntryForm(function mergeSheetEntryForm(current) {
      return {
        ...current,
        is_absent: isAbsent,
        score: isAbsent ? '' : current.score,
      }
    })
  }

  async function submitGradeSheet(event) {
    event.preventDefault()
    if (!sheetStudentEnrollmentId) {
      setSheetError('Sélectionnez un élève.')
      return
    }

    const assessmentMaximumScore = Number(gradeSheet?.assessment?.maximum_score)
    const isAbsent = sheetEntryForm.is_absent
    const parsedScore = Number(sheetEntryForm.score)
    if (!isAbsent && sheetEntryForm.score === '') {
      setSheetError('Saisissez la note ou cochez absent.')
      return
    }
    if (!isAbsent && (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > assessmentMaximumScore)) {
      setSheetError(`La note doit être comprise entre 0 et ${formatNumber(assessmentMaximumScore)}.`)
      return
    }

    const entries = [{
      student_enrollment_id: sheetStudentEnrollmentId,
      result_type: isAbsent ? 'ABSENT' : 'SCORED',
      score: isAbsent ? null : parsedScore,
      justification_status: isAbsent ? 'UNJUSTIFIED' : null,
      comment: sheetEntryForm.comment.trim() || null,
    }]

    setSheetSaving(true)
    setSheetError('')
    try {
      const updatedSheet = await submitAssessmentGradeSheet(selectedAssessmentId, entries)
      setGradeSheet(updatedSheet)
      const nextMissingRows = (updatedSheet.rows || []).filter(function filterMissing(row) {
        return !row.grade_id
      })
      if (nextMissingRows.length === 0) {
        setShowSheetModal(false)
        toast.success('Dernière saisie enregistrée. Tous les élèves ont maintenant une note.')
      } else {
        setSheetStudentEnrollmentId(nextMissingRows[0].student_enrollment_id)
        setSheetEntryForm(EMPTY_SHEET_ENTRY_FORM)
        toast.success('Note enregistrée. Vous pouvez saisir un autre élève.')
      }
      await refreshSelectedAssessment()
    } catch (error) {
      setSheetError(error.message)
    } finally {
      setSheetSaving(false)
    }
  }

  function openCorrectionModal() {
    const firstGrade = gradeSheet?.rows.find(function findExistingGrade(row) {
      return Boolean(row.grade_id)
    })
    if (!firstGrade) {
      toast.warning('Aucune note existante ne peut être corrigée.')
      return
    }
    setCorrectionForm({
      grade_id: firstGrade.grade_id,
      proposed_result_type: firstGrade.result_type,
      proposed_score: firstGrade.score ?? '',
      proposed_justification_status: firstGrade.justification_status,
      request_reason: '',
    })
    setShowCorrectionModal(true)
  }

  function selectCorrectionGrade(event) {
    const row = gradeSheet.rows.find(function findGrade(item) {
      return item.grade_id === event.target.value
    })
    if (!row) return
    setCorrectionForm({
      grade_id: row.grade_id,
      proposed_result_type: row.result_type,
      proposed_score: row.score ?? '',
      proposed_justification_status: row.justification_status,
      request_reason: '',
    })
  }

  function updateCorrectionForm(event) {
    const { name, value } = event.target
    setCorrectionForm(function mergeCorrectionForm(current) {
      const next = { ...current, [name]: value }
      if (name === 'proposed_result_type') {
        next.proposed_score = value === 'ABSENT' ? '' : next.proposed_score
        next.proposed_justification_status = value === 'ABSENT' ? 'UNJUSTIFIED' : null
      }
      return next
    })
  }

  async function submitCorrectionRequest(event) {
    event.preventDefault()
    setCorrectionSaving(true)
    try {
      const correctionPayload = {
        ...correctionForm,
        proposed_score: correctionForm.proposed_result_type === 'SCORED'
          ? Number(correctionForm.proposed_score)
          : null,
        proposed_justification_status: correctionForm.proposed_result_type === 'ABSENT'
          ? correctionForm.proposed_justification_status
          : null,
      }

      if (isAdmin) {
        await applyGradeCorrectionDirectly(correctionPayload)
      } else {
        await createGradeChangeRequest(correctionPayload)
      }

      setShowCorrectionModal(false)
      toast.success(isAdmin ? 'Correction appliquée.' : 'Demande de correction transmise.')
      await refreshSelectedAssessment()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setCorrectionSaving(false)
    }
  }

  function openDecisionModal(event) {
    const request = correctionRequests.find(function findRequest(item) {
      return item.id === event.currentTarget.dataset.requestId
    })
    if (!request) return
    setDecisionRequest({ ...request, decision: event.currentTarget.dataset.decision })
    setDecisionComment('')
  }

  async function submitCorrectionDecision(event) {
    event.preventDefault()
    setDecisionSaving(true)
    try {
      await decideGradeChangeRequest(decisionRequest.id, {
        status: decisionRequest.decision,
        decision_comment: decisionComment.trim() || null,
      })
      setDecisionRequest(null)
      toast.success('Décision enregistrée.')
      await refreshSelectedAssessment()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setDecisionSaving(false)
    }
  }

  async function handleJustificationUpload(event) {
    const file = event.target.files?.[0]
    const gradeId = event.currentTarget.dataset.gradeId
    if (!file || !gradeId) return
    setUploadingGradeId(gradeId)
    try {
      await uploadGradeJustification(gradeId, file)
      toast.success('Justificatif ajouté et placé en attente de validation.')
      if (documentGradeId === gradeId) {
        setGradeDocuments(await getGradeDocuments(gradeId))
      }
      await refreshSelectedAssessment()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setUploadingGradeId('')
      event.target.value = ''
    }
  }

  async function openGradeDocuments(event) {
    const gradeId = event.currentTarget.dataset.gradeId
    if (!gradeId) return
    setDocumentGradeId(gradeId)
    setDocumentStudentName(event.currentTarget.dataset.studentName || '')
    setGradeDocuments([])
    setDocumentsLoading(true)
    try {
      setGradeDocuments(await getGradeDocuments(gradeId))
    } catch (error) {
      toast.error(error.message)
      setDocumentGradeId('')
    } finally {
      setDocumentsLoading(false)
    }
  }

  function closeGradeDocuments() {
    setDocumentGradeId('')
    setDocumentStudentName('')
    setGradeDocuments([])
  }

  async function handleAbsenceReview(event) {
    const gradeId = event.currentTarget.dataset.gradeId
    const status = event.currentTarget.dataset.status
    try {
      await reviewGradeAbsence(gradeId, status)
      toast.success(status === 'JUSTIFIED' ? 'Absence justifiée.' : 'Justificatif rejeté.')
      await refreshSelectedAssessment()
    } catch (error) {
      toast.error(error.message)
    }
  }

  function stopModalPropagation(event) {
    event.stopPropagation()
  }

  if (selectedAssessmentId) {
    const assessment = gradeSheet?.assessment
    const statistics = gradeSheet?.statistics
    return (
      <main className="ntp-main">
        <div className="ntp-topbar ntp-topbar--detail">
          <div>
            <button type="button" className="ntp-back-button" onClick={closeAssessmentDetail}>
              <ArrowLeft size={17} aria-hidden="true" /> Retour aux évaluations
            </button>
            <h1 className="ntp-title">Détails de l’évaluation</h1>
            <nav className="ntp-breadcrumb" aria-label="Fil d’Ariane">
              <button type="button" onClick={handleHomeNavigation}>Accueil</button>
              <span>›</span><button type="button" onClick={closeAssessmentDetail}>Notes</button>
              <span>›</span><span>{assessment?.title || 'Évaluation'}</span>
            </nav>
          </div>
          <div className="ntp-topbar__actions">
            <button type="button" className="ntp-btn-ghost" onClick={openCorrectionModal}>
              {isAdmin ? 'Corriger' : 'Demander une correction'}
            </button>
            <button type="button" className="ntp-btn-primary" onClick={openGradeSheetModal}>
              <Plus size={16} aria-hidden="true" /> Saisir les notes
            </button>
          </div>
        </div>

        {detailLoading || !assessment ? (
          <p className="ntp-loading">Chargement de la feuille de notes…</p>
        ) : (
          <>
            <section className="ntp-assessment-hero">
              <div><h2>{assessment.title}</h2><p>{assessment.description || 'Aucune description.'}</p></div>
              <span className={`ntp-status ntp-status--${getCompletionTone(assessment.completion_status)}`}>
                {getCompletionLabel(assessment.completion_status)}
              </span>
              <div className="ntp-assessment-hero__meta">
                <div><span>Matière</span><strong>{assessment.subject_name}</strong></div>
                <div><span>Classe</span><strong>{assessment.class_name}</strong></div>
                <div><span>Période</span><strong>{assessment.reporting_period_name || 'Hors période définie'}</strong></div>
                <div><span>Date</span><strong>{formatDate(assessment.assessment_date)}</strong></div>
                <div><span>Barème</span><strong>/{formatNumber(assessment.maximum_score)}</strong></div>
                <div><span>Coefficient</span><strong>{formatNumber(assessment.coefficient)}</strong></div>
              </div>
            </section>

            <div className="ntp-detail-tabs" role="tablist" aria-label="Navigation de l’évaluation">
              <button type="button" className={detailTab === 'students' ? 'ntp-detail-tab ntp-detail-tab--active' : 'ntp-detail-tab'} onClick={() => setDetailTab('students')}>Notes des élèves</button>
              <button type="button" className={detailTab === 'statistics' ? 'ntp-detail-tab ntp-detail-tab--active' : 'ntp-detail-tab'} onClick={() => setDetailTab('statistics')}>Statistiques</button>
              <button type="button" className={detailTab === 'justifications' ? 'ntp-detail-tab ntp-detail-tab--active' : 'ntp-detail-tab'} onClick={() => setDetailTab('justifications')}>Absences et justificatifs</button>
              <button type="button" className={detailTab === 'corrections' ? 'ntp-detail-tab ntp-detail-tab--active' : 'ntp-detail-tab'} onClick={() => setDetailTab('corrections')}>Corrections</button>
            </div>

            {detailTab === 'students' && (
              <section className="ntp-list">
                <header className="ntp-detail-toolbar">
                  <label className="ntp-search ntp-search--detail">
                    <Search className="ntp-search__icon" aria-hidden="true" size={18} />
                    <input type="search" placeholder="Rechercher un élève…" value={detailSearch} onChange={(event) => setDetailSearch(event.target.value)} />
                  </label>
                  <select value={detailStatusFilter} onChange={(event) => setDetailStatusFilter(event.target.value)}>
                    <option value="">Tous les statuts</option>
                    <option value="SCORED">Noté</option>
                    <option value="ABSENT">Absent</option>
                    <option value="MISSING">Non saisi</option>
                  </select>
                </header>
                <div className="ntp-table-wrapper">
                  <table className="ntp-table ntp-table--detail">
                    <thead><tr><th>N°</th><th>Élève</th><th>Résultat</th><th>Note /20</th><th>Appréciation</th></tr></thead>
                    <tbody>
                      {visibleGradeRows.length === 0 ? (
                        <tr><td colSpan="5" className="ntp-loading">Aucun élève ne correspond aux filtres.</td></tr>
                      ) : visibleGradeRows.map(function renderGradeRow(row, index) {
                        return (
                          <tr key={row.student_enrollment_id} className="ntp-table__row">
                            <td>{index + 1}</td>
                            <td><strong>{row.student_name}</strong><small>{row.registration_number}</small></td>
                            <td>{row.grade_id ? (row.result_type === 'ABSENT' ? 'Absent' : 'Noté') : 'Non saisi'}</td>
                            <td>{row.normalized_score_on_20 === null ? '—' : `${formatNumber(row.normalized_score_on_20)} / 20`}</td>
                            <td>{row.comment || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {detailTab === 'statistics' && statistics && (
              <section className="ntp-stats ntp-stats--detail">
                <article className="ntp-stat-card"><ClipboardCheck size={21} /><div><strong>{statistics.grade_count} / {statistics.enrolled_count}</strong><span>Saisie</span></div></article>
                <article className="ntp-stat-card"><Users size={21} /><div><strong>{statistics.absent_count}</strong><span>Absences</span></div></article>
                <article className="ntp-stat-card"><BarChart3 size={21} /><div><strong>{formatNumber(statistics.official_average_on_20)} /20</strong><span>Moyenne officielle</span></div></article>
                <article className="ntp-stat-card"><CheckCircle2 size={21} /><div><strong>{formatNumber(statistics.highest_score_on_20)} /20</strong><span>Note la plus haute</span></div></article>
                <article className="ntp-stat-card"><ListChecks size={21} /><div><strong>{statistics.pending_absence_count}</strong><span>Justificatifs en attente</span></div></article>
                <article className="ntp-stat-card"><AlertCircle size={21} /><div><strong>{statistics.missing_count}</strong><span>Résultats manquants</span></div></article>
              </section>
            )}

            {detailTab === 'justifications' && (
              <section className="ntp-list">
                <header className="ntp-card-header"><div><h3>Absences à l’évaluation</h3><p>Les fichiers sont stockés hors de la base et référencés de façon sécurisée.</p></div></header>
                <div className="ntp-table-wrapper">
                  <table className="ntp-table"><thead><tr><th>Élève</th><th>Statut</th><th>Justificatif</th><th>Action</th></tr></thead>
                    <tbody>
                      {(gradeSheet.rows || []).filter(function onlyAbsences(row) { return row.result_type === 'ABSENT' }).map(function renderAbsence(row) {
                        return (
                          <tr key={row.grade_id}>
                            <td><strong>{row.student_name}</strong><small>{row.registration_number}</small></td>
                            <td><span className={`ntp-status ntp-status--${getAbsenceStatusTone(row.justification_status)}`}>{getAbsenceStatusLabel(row.justification_status)}</span></td>
                            <td><div className="ntp-document-actions"><label className="ntp-upload-button"><FileUp size={15} />{uploadingGradeId === row.grade_id ? 'Envoi…' : 'Ajouter un fichier'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-grade-id={row.grade_id} onChange={handleJustificationUpload} disabled={uploadingGradeId === row.grade_id} /></label><button type="button" className="ntp-document-list-button" data-grade-id={row.grade_id} data-student-name={row.student_name} onClick={openGradeDocuments}>Voir le justificatif</button></div></td>
                            <td>{isAdmin && row.justification_status === 'PENDING' ? <div className="ntp-inline-actions"><button type="button" className="ntp-btn-success" data-grade-id={row.grade_id} data-status="JUSTIFIED" onClick={handleAbsenceReview}>Accepter</button><button type="button" className="ntp-btn-danger" data-grade-id={row.grade_id} data-status="REJECTED" onClick={handleAbsenceReview}>Refuser</button></div> : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {detailTab === 'corrections' && (
              <section className="ntp-list">
                <header className="ntp-card-header"><div><h3>Demandes de correction</h3><p>Une note existante n’est jamais écrasée silencieusement.</p></div></header>
                <div className="ntp-table-wrapper">
                  <table className="ntp-table"><thead><tr><th>Élève</th><th>Ancien résultat</th><th>Proposition</th><th>Motif</th><th>Statut</th>{isAdmin ? <th>Action</th> : null}</tr></thead>
                    <tbody>
                      {correctionRequests.length === 0 ? <tr><td colSpan={isAdmin ? 6 : 5} className="ntp-loading">Aucune demande.</td></tr> : correctionRequests.map(function renderRequest(request) {
                        return (
                          <tr key={request.id}>
                            <td>{request.student_name}</td>
                            <td>{request.previous_result_type === 'SCORED' ? request.previous_score : 'Absent'}</td>
                            <td>{request.proposed_result_type === 'SCORED' ? request.proposed_score : 'Absent'}</td>
                            <td>{request.request_reason}</td><td>{request.status}</td>
                            {isAdmin ? <td>{request.status === 'PENDING' ? <div className="ntp-inline-actions"><button type="button" data-request-id={request.id} data-decision="APPROVED" onClick={openDecisionModal}>Valider</button><button type="button" data-request-id={request.id} data-decision="REJECTED" onClick={openDecisionModal}>Rejeter</button></div> : '—'}</td> : null}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {showSheetModal && (
          <div className="ntp-modal-backdrop" role="presentation" onMouseDown={() => setShowSheetModal(false)}>
            <section className="ntp-modal ntp-modal--wide" role="dialog" aria-modal="true" onMouseDown={stopModalPropagation}>
              <div className="ntp-modal__header"><div><h2>Saisie des notes</h2><p>Sélectionnez un élève sans note, puis enregistrez sa note ou son absence.</p></div><button type="button" onClick={() => setShowSheetModal(false)}>×</button></div>
              <form onSubmit={submitGradeSheet}>
                <div className="ntp-modal__form">
                  <label className="ntp-modal__wide-field">
                    Élève *
                    <select value={sheetStudentEnrollmentId} onChange={handleSheetStudentChange} required>
                      <option value="">Sélectionner un élève sans note</option>
                      {missingGradeRows.map(function renderMissingStudent(row) {
                        return (
                          <option key={row.student_enrollment_id} value={row.student_enrollment_id}>
                            {row.student_name} — {row.registration_number}
                          </option>
                        )
                      })}
                    </select>
                  </label>

                  <label>
                    Note /{formatNumber(assessment.maximum_score)} *
                    <input
                      name="score"
                      type="number"
                      min="0"
                      max={assessment.maximum_score}
                      step="0.01"
                      value={sheetEntryForm.score}
                      onChange={handleSheetEntryChange}
                      disabled={sheetEntryForm.is_absent}
                      required={!sheetEntryForm.is_absent}
                    />
                  </label>

                  <label className="ntp-checkbox-field">
                    <input
                      type="checkbox"
                      checked={sheetEntryForm.is_absent}
                      onChange={handleSheetAbsentToggle}
                    />
                    <span>Élève absent</span>
                  </label>

                  <label className="ntp-modal__wide-field">
                    Appréciation
                    <input
                      name="comment"
                      value={sheetEntryForm.comment}
                      onChange={handleSheetEntryChange}
                      placeholder="Commentaire optionnel"
                    />
                  </label>

                  {sheetEntryForm.is_absent && (
                    <p className="ntp-absence-hint">Absent: la note est désactivée pour cet élève.</p>
                  )}
                </div>
                {sheetError && <p className="ntp-modal__error" role="alert">{sheetError}</p>}
                <div className="ntp-modal__actions"><button type="button" className="ntp-btn-reset" onClick={() => setShowSheetModal(false)}>Annuler</button><button type="submit" className="ntp-btn-primary" disabled={sheetSaving}>{sheetSaving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
              </form>
            </section>
          </div>
        )}

        {showCorrectionModal && correctionForm && (
          <div className="ntp-modal-backdrop" role="presentation" onMouseDown={() => setShowCorrectionModal(false)}><section className="ntp-modal" role="dialog" aria-modal="true" onMouseDown={stopModalPropagation}><div className="ntp-modal__header"><div><h2>{isAdmin ? 'Corriger une note' : 'Demander une correction'}</h2><p>{isAdmin ? 'La correction est appliquée directement.' : 'L’ancienne valeur est conservée dans la demande.'}</p></div><button type="button" onClick={() => setShowCorrectionModal(false)}>×</button></div><form className="ntp-modal__form" onSubmit={submitCorrectionRequest}><label className="ntp-modal__wide-field">Élève *<select value={correctionForm.grade_id} onChange={selectCorrectionGrade}>{gradeSheet.rows.filter(function existingRows(row) { return Boolean(row.grade_id) }).map(function gradeOption(row) { return <option key={row.grade_id} value={row.grade_id}>{row.student_name} — {row.result_type === 'SCORED' ? row.score : 'Absent'}</option> })}</select></label><label>Résultat proposé *<select name="proposed_result_type" value={correctionForm.proposed_result_type} onChange={updateCorrectionForm}><option value="SCORED">Note chiffrée</option><option value="ABSENT">Absent</option></select></label>{correctionForm.proposed_result_type === 'SCORED' ? <label>Nouvelle note *<input name="proposed_score" type="number" min="0" max={assessment.maximum_score} step="0.01" value={correctionForm.proposed_score} onChange={updateCorrectionForm} required /></label> : <label>Statut de l’absence<select name="proposed_justification_status" value={correctionForm.proposed_justification_status || 'UNJUSTIFIED'} onChange={updateCorrectionForm}><option value="UNJUSTIFIED">Non justifiée</option><option value="PENDING">En attente</option><option value="JUSTIFIED">Justifiée</option><option value="REJECTED">Rejetée</option></select></label>}<label className="ntp-modal__wide-field">Motif *<textarea name="request_reason" minLength="3" maxLength="2000" value={correctionForm.request_reason} onChange={updateCorrectionForm} required /></label><div className="ntp-modal__actions"><button type="button" className="ntp-btn-reset" onClick={() => setShowCorrectionModal(false)}>Annuler</button><button type="submit" className="ntp-btn-primary" disabled={correctionSaving}>{correctionSaving ? 'Envoi…' : isAdmin ? 'Appliquer la correction' : 'Envoyer la demande'}</button></div></form></section></div>
        )}

        {decisionRequest && (
          <div className="ntp-modal-backdrop" role="presentation" onMouseDown={() => setDecisionRequest(null)}><section className="ntp-modal ntp-modal--small" role="dialog" aria-modal="true" onMouseDown={stopModalPropagation}><div className="ntp-modal__header"><div><h2>{decisionRequest.decision === 'APPROVED' ? 'Approuver la correction' : 'Rejeter la correction'}</h2><p>Cette décision est enregistrée avec votre compte.</p></div></div><form className="ntp-modal__form" onSubmit={submitCorrectionDecision}><label className="ntp-modal__wide-field">{decisionRequest.decision === 'REJECTED' ? 'Motif du rejet *' : 'Commentaire (optionnel)'}<textarea value={decisionComment} onChange={(event) => setDecisionComment(event.target.value)} required={decisionRequest.decision === 'REJECTED'} /></label><div className="ntp-modal__actions"><button type="button" className="ntp-btn-reset" onClick={() => setDecisionRequest(null)}>Annuler</button><button type="submit" className="ntp-btn-primary" disabled={decisionSaving}>Confirmer</button></div></form></section></div>
        )}

        {documentGradeId && (
          <div className="ntp-modal-backdrop" role="presentation" onMouseDown={closeGradeDocuments}>
            <section className="ntp-modal ntp-modal--small" role="dialog" aria-modal="true" onMouseDown={stopModalPropagation}>
              <div className="ntp-modal__header">
                <div><h2>Justificatifs</h2><p>{documentStudentName}</p></div>
                <button type="button" onClick={closeGradeDocuments}>×</button>
              </div>
              {documentsLoading ? <p>Chargement…</p> : gradeDocuments.length === 0 ? <p>Aucun justificatif enregistré.</p> : (
                <ul className="ntp-document-list">
                  {gradeDocuments.map(function renderGradeDocument(document) {
                    return (
                      <li key={document.id}>
                        <div><strong>{document.original_filename}</strong><small>{document.mime_type} — {Math.ceil(document.size_bytes / 1024)} Ko</small></div>
                        <a href={getGradeDocumentDownloadUrl(documentGradeId, document.id)} target="_blank" rel="noreferrer">Ouvrir</a>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    )
  }

  return (
    <main className="ntp-main">
      <div className="ntp-topbar"><div><h1 className="ntp-title">Gestion des évaluations et des notes</h1><nav className="ntp-breadcrumb" aria-label="Fil d’Ariane"><button type="button" onClick={handleHomeNavigation}>Accueil</button><span>›</span><span>Notes</span></nav><p className="ntp-subtitle">Créez les évaluations puis saisissez les résultats de tous les inscrits.</p></div><div className="ntp-topbar-actions">{account?.role === 'TEACHER' ? <button type="button" className="ntp-btn-secondary" onClick={function openAppreciations() { onNavigate('appreciations') }}>Appréciations</button> : null}<button type="button" className="ntp-btn-primary" onClick={openAssessmentModal}><Plus size={16} /> Créer une évaluation</button></div></div>
      {pageError && <p className="ntp-page-error" role="alert">{pageError}</p>}
      <section className="ntp-stats" aria-label="Résumé officiel"><article className="ntp-stat-card"><ClipboardCheck size={21} /><div><strong>{dashboardSummary.assessments_count}</strong><span>Évaluations</span></div></article><article className="ntp-stat-card"><CheckCircle2 size={21} /><div><strong>{dashboardSummary.grade_count} / {dashboardSummary.expected_grade_count}</strong><span>Résultats saisis</span></div></article><article className="ntp-stat-card"><ListChecks size={21} /><div><strong>{dashboardSummary.missing_count}</strong><span>Résultats manquants</span></div></article><article className="ntp-stat-card"><BarChart3 size={21} /><div><strong>{formatNumber(dashboardSummary.official_average_on_20)} /20</strong><span>Moyenne des résultats</span></div></article><article className="ntp-stat-card"><Users size={21} /><div><strong>{dashboardSummary.students_count}</strong><span>Élèves concernés</span></div></article></section>
      <form className="ntp-filters" onSubmit={(event) => event.preventDefault()}><div className="ntp-filters__row ntp-filters__row--dashboard"><label>Recherche<div className="ntp-search"><Search className="ntp-search__icon" size={18} /><input type="search" placeholder="Titre, classe, matière, enseignant…" value={query} onChange={(event) => setQuery(event.target.value)} /></div></label><label>Classe<select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="">Toutes les classes</option>{filterOptions.classes.map(function classOption(item) { return <option key={item.id} value={item.id}>{item.name}</option> })}</select></label><label>Matière<select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><option value="">Toutes les matières</option>{filterOptions.subjects.map(function subjectOption(item) { return <option key={item.id} value={item.id}>{item.name}</option> })}</select></label><label>Période<select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}><option value="">Toutes les périodes</option>{filterOptions.periods.map(function periodOption(item) { return <option key={item.id} value={item.id}>{item.name}</option> })}</select></label></div></form>
      <section className="ntp-list"><header className="ntp-card-header"><div><h3>Évaluations</h3><p>{assessments.length} évaluation(s) visible(s), y compris sans note.</p></div></header><div className="ntp-table-wrapper"><table className="ntp-table ntp-table--compact"><thead><tr><th>Évaluation</th><th>Matière</th><th>Classe</th><th>Enseignant</th><th>Date</th><th>Barème</th><th>Statut</th><th>Saisie</th></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="ntp-loading">Chargement…</td></tr> : paginatedAssessments.length === 0 ? <tr><td colSpan="8" className="ntp-loading">Aucune évaluation.</td></tr> : paginatedAssessments.map(function renderAssessment(row) { return <tr key={row.id} className="ntp-table__row" data-assessment-id={row.id} tabIndex="0" onClick={() => handleAssessmentSelection(row.id)} onKeyDown={handleAssessmentRowKeyDown}><td><strong>{row.title}</strong><small>{row.reporting_period_name || 'Hors période'}</small></td><td>{row.subject_name}</td><td>{row.class_name}</td><td>{row.teacher_name}</td><td>{formatDate(row.assessment_date)}</td><td>/{formatNumber(row.maximum_score)}</td><td><span className={`ntp-status ntp-status--${getCompletionTone(row.completion_status)}`}>{getCompletionLabel(row.completion_status)}</span></td><td>{row.completion_status === 'COMPLETE' ? 'Fini' : 'En cours'}</td></tr> })}</tbody></table></div>{assessments.length > PAGE_SIZE && <footer className="ntp-table-pagination"><span>Page {page} sur {pageCount}</span><div className="ntp-table-pagination__actions"><button type="button" className="ntp-page-btn" onClick={() => setPage(page - 1)} disabled={page === 1}>‹</button><button type="button" className="ntp-page-btn ntp-page-btn--active">{page}</button><button type="button" className="ntp-page-btn" onClick={() => setPage(page + 1)} disabled={page === pageCount}>›</button></div></footer>}</section>

      {showAssessmentModal && <div className="ntp-modal-backdrop" role="presentation" onMouseDown={() => setShowAssessmentModal(false)}><section className="ntp-modal" role="dialog" aria-modal="true" onMouseDown={stopModalPropagation}><div className="ntp-modal__header"><div><h2>Créer une évaluation</h2><p>Choisissez d’abord la classe, puis la matière avec son enseignant.</p></div><button type="button" onClick={() => setShowAssessmentModal(false)}>×</button></div><form className="ntp-modal__form" onSubmit={submitAssessment}><label>Classe *<select value={assessmentClassId} onChange={handleAssessmentClassChange} required><option value="">Sélectionner une classe</option>{assignmentClassOptions.map(function classOption(item) { return <option key={item.id} value={item.id}>{item.name}</option> })}</select></label><label>Matière *<select name="teacher_assignment_id" value={assessmentForm.teacher_assignment_id} onChange={updateAssessmentForm} disabled={!assessmentClassId} required><option value="">{assessmentClassId ? 'Sélectionner une matière' : 'Choisissez d\'abord une classe'}</option>{assignmentSubjectOptions.map(function assignmentOption(item) { return <option key={item.id} value={item.id}>{item.teacher_name} — {item.subject_name}</option> })}</select></label><label className="ntp-modal__wide-field">Titre *<input name="title" maxLength="150" value={assessmentForm.title} onChange={updateAssessmentForm} required /></label><label>Date *<input name="assessment_date" type="date" value={assessmentForm.assessment_date} onChange={updateAssessmentForm} required /></label><label>Barème *<input name="maximum_score" type="number" min="0.01" step="0.01" value={assessmentForm.maximum_score} onChange={updateAssessmentForm} required /></label><label>Coefficient *<input name="coefficient" type="number" min="0.01" step="0.01" value={assessmentForm.coefficient} onChange={updateAssessmentForm} required /></label><label className="ntp-modal__wide-field">Description<textarea name="description" value={assessmentForm.description} onChange={updateAssessmentForm} /></label>{assessmentError && <p className="ntp-modal__error">{assessmentError}</p>}<div className="ntp-modal__actions"><button type="button" className="ntp-btn-reset" onClick={() => setShowAssessmentModal(false)}>Annuler</button><button type="submit" className="ntp-btn-primary" disabled={assessmentSaving}>{assessmentSaving ? 'Création…' : 'Créer l’évaluation'}</button></div></form></section></div>}
    </main>
  )
}
