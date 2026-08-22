import { useEffect, useState } from 'react'
import {
  ChartNoAxesColumnIncreasing,
  CalendarPlus,
  CalendarMinus,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderOpen,
  Download,
  Eye,
  GraduationCap,
  Info,
  ImagePlus,
  Pencil,
  Upload,
  UserRound,
  UsersRound,
  Search,
  X,
} from 'lucide-react'
import defaultPhoto from '../assets/image_phtoto_default.png'
import {
  getStudent,
  updateStudent,
  archiveStudent,
  deactivateStudent,
  reactivateStudent,
  enrollStudent,
  unenrollStudent,
  getStudentAcademicSummary,
  getStudentDocuments,
  getStudentDocumentFile,
  uploadStudentDocument,
  archiveStudentDocument,
  getStudentSpecialties,
  getAvailableStudentSpecialties,
  updateStudentSpecialties,
} from '../services/students_service.js'
import {
  linkGuardianToStudent,
  searchGuardians,
  unlinkGuardianFromStudent,
} from '../services/guardians_service.js'
import '../styles/student_details_page.css'
import NotificationPopup from '../components/notification_popup.jsx'
import { formatProfileName } from '../utils/profileDisplay.js'
import { NATIONALITIES } from '../constants/nationalities.js'
import { INTERNATIONAL_PHONE_PATTERN, normalizeInternationalPhone } from '../utils/phone.js'
import { uploadAccountPhoto } from '../services/account_service.js'
import {
  getSchoolClassesOverview,
  getSchoolClassSubjects,
} from '../services/school_classes_overview_service.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
const RELATIONSHIP_ICON_CLASS = {
  FATHER: 'sdp-guardian-icon--pere',
  MOTHER: 'sdp-guardian-icon--mere',
  OTHER: 'sdp-guardian-icon--autre',
}

const STATUS_LABEL = { ACTIVE: 'Actif', INACTIVE: 'Inactif', ARCHIVED: 'Archivé' }
const STATUS_CLASS = { ACTIVE: 'sdp-badge--active', INACTIVE: 'sdp-badge--inactive', ARCHIVED: 'sdp-badge--archived' }

function StatusBadge({ status }) {
  return (
    <span className={`sdp-badge ${STATUS_CLASS[status] ?? ''}`}>
      <span className="sdp-badge__dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}
function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

function getRequiredSpecialtyCount(levelCode) {
  if (levelCode === 'PREMIERE') return 3
  if (levelCode === 'TERMINALE') return 2
  return 0
}

const DEFAULT_PHOTO = defaultPhoto

function genderLabel(gender) {
  if (gender === 'MALE' || gender === 'M') return 'Masculin'
  if (gender === 'FEMALE' || gender === 'F') return 'Féminin'
  return '—'
}

function formatDate(dateValue) {
  if (!dateValue) return '—'
  const value = String(dateValue)
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(date)
}

function calculateAge(birthDate) {
  if (!birthDate) return '—'
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return '—'
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const birthdayNotReached = today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  if (birthdayNotReached) age -= 1
  return age >= 0 ? `${age} ans` : '—'
}

function formatFileSize(sizeBytes) {
  if (sizeBytes == null) return '—'
  if (sizeBytes < 1024) return `${sizeBytes} o`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} Ko`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default function StudentDetailsPage({ student, onNavigate, account }) {
  const canEdit = account?.role === 'ADMIN'
  const [details, setDetails] = useState(student)
  const canViewAcademics = canEdit || Boolean(details?.viewer_is_main_teacher)
  const [classes, setClasses] = useState([])
  const [schoolYears, setSchoolYears] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')
  const [guardianModalOpen, setGuardianModalOpen] = useState(false)
  const [guardianQuery, setGuardianQuery] = useState('')
  const [guardianResults, setGuardianResults] = useState([])
  const [selectedGuardian, setSelectedGuardian] = useState(null)
  const [guardianRelationship, setGuardianRelationship] = useState('FATHER')
  const [guardianRelationshipDetails, setGuardianRelationshipDetails] = useState('')
  const [guardianLegal, setGuardianLegal] = useState(false)
  const [guardianSaving, setGuardianSaving] = useState(false)
  const [unlinkGuardianModalOpen, setUnlinkGuardianModalOpen] = useState(false)
  const [guardianToUnlink, setGuardianToUnlink] = useState(null)
  const [unlinkingGuardian, setUnlinkingGuardian] = useState(false)
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false)
  const [enrollmentClassId, setEnrollmentClassId] = useState('')
  const [enrollmentStartDate, setEnrollmentStartDate] = useState('')
  const [enrollmentSaving, setEnrollmentSaving] = useState(false)
  const [enrollmentSpecialties, setEnrollmentSpecialties] = useState([])
  const [enrollmentSpecialtyIds, setEnrollmentSpecialtyIds] = useState([])
  const [enrollmentError, setEnrollmentError] = useState('')
  const [informationMessage, setInformationMessage] = useState('')
  const [editPhoto, setEditPhoto] = useState(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState('')
  const [academicSummary, setAcademicSummary] = useState(null)
  const [studentDocuments, setStudentDocuments] = useState([])
  const [documentFilter, setDocumentFilter] = useState('ALL')
  const [documentModalOpen, setDocumentModalOpen] = useState(false)
  const [documentTitle, setDocumentTitle] = useState('')
  const [documentTypeCode, setDocumentTypeCode] = useState('ADMINISTRATIVE')
  const [documentFile, setDocumentFile] = useState(null)
  const [documentSaving, setDocumentSaving] = useState(false)
  const [documentToArchive, setDocumentToArchive] = useState(null)
  const [documentArchiveModalOpen, setDocumentArchiveModalOpen] = useState(false)
  const [documentArchiving, setDocumentArchiving] = useState(false)
  const [documentOpeningId, setDocumentOpeningId] = useState(null)
  const [documentDownloadingId, setDocumentDownloadingId] = useState(null)

  const [studentSpecialties, setStudentSpecialties] = useState(null)
  const [availableSpecialties, setAvailableSpecialties] = useState([])
  const [specialtyModalOpen, setSpecialtyModalOpen] = useState(false)
  const [selectedSpecialtyIds, setSelectedSpecialtyIds] = useState([])
  const [specialtyLoading, setSpecialtyLoading] = useState(false)
  const [specialtySaving, setSpecialtySaving] = useState(false)

  const debouncedGuardianQuery = useDebouncedValue(guardianQuery)

  function handleHomeNavigation() {
    onNavigate?.('home')
  }

  function handleStudentsNavigation() {
    onNavigate?.('students')
  }

  function handlePhotoError() {
    setPhotoFailed(true)
  }

  function showPersonalInformation() {
    setActiveTab('personal')
  }

  function showSchoolInformation() {
    setActiveTab('school')
  }

  async function openSpecialtyModal() {
    if (!details?.id) return

    setSpecialtyLoading(true)
    setError('')

    try {
      const available = await getAvailableStudentSpecialties(details.id)

      setAvailableSpecialties(available.items ?? [])
      setSelectedSpecialtyIds(
        (studentSpecialties?.items ?? []).map(
          (specialty) => String(specialty.subject_id),
        ),
      )
      setSpecialtyModalOpen(true)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSpecialtyLoading(false)
    }
  }

  function closeSpecialtyModal() {
    if (specialtySaving) return

    setSpecialtyModalOpen(false)
    setAvailableSpecialties([])
    setSelectedSpecialtyIds([])
    setError('')
  }

  function toggleSpecialty(subjectId) {
    const id = String(subjectId)

    setSelectedSpecialtyIds((currentIds) => {
      if (currentIds.includes(id)) {
        return currentIds.filter((currentId) => currentId !== id)
      }

      const requiredCount = studentSpecialties?.required_count ?? 0

      if (requiredCount > 0 && currentIds.length >= requiredCount) {
        return currentIds
      }

      return [...currentIds, id]
    })
  }

  async function saveStudentSpecialties() {
    if (!details?.id) return

    const requiredCount = studentSpecialties?.required_count ?? 0

    if (selectedSpecialtyIds.length !== requiredCount) {
      setError(
        `Vous devez sélectionner exactement ${requiredCount} spécialité${
          requiredCount > 1 ? 's' : ''
        }.`,
      )
      return
    }

    setSpecialtySaving(true)
    setError('')

    try {
      const updated = await updateStudentSpecialties(
        details.id,
        selectedSpecialtyIds,
      )

      setStudentSpecialties(updated)
      setSpecialtyModalOpen(false)
      setAvailableSpecialties([])
      setSelectedSpecialtyIds([])
      setInformationMessage(
        'Les spécialités de l’élève ont été enregistrées.',
      )
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSpecialtySaving(false)
    }
  }

  function showGuardians() {
    setActiveTab('guardians')
  }

  function showDocuments() {
    setActiveTab('documents')
  }

  function openDocumentModal() {
    setDocumentTitle('')
    setDocumentTypeCode('ADMINISTRATIVE')
    setDocumentFile(null)
    setError('')
    setDocumentModalOpen(true)
  }

  function closeDocumentModal() {
    if (documentSaving) return
    setDocumentModalOpen(false)
    setDocumentTitle('')
    setDocumentTypeCode('ADMINISTRATIVE')
    setDocumentFile(null)
  }

  function selectDocumentFile(event) {
    const selectedFile = event.target.files?.[0] || null

    if (!selectedFile) {
      setDocumentFile(null)
      return
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Le document doit être au format PDF, JPEG, PNG ou WebP.')
      event.target.value = ''
      setDocumentFile(null)
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Le document ne doit pas dépasser 5 Mo.')
      event.target.value = ''
      setDocumentFile(null)
      return
    }

    setError('')
    setDocumentFile(selectedFile)
  }

  async function submitDocumentUpload(event) {
    event.preventDefault()

    if (!documentTitle.trim()) {
      setError('Le titre du document est obligatoire.')
      return
    }

    if (!documentFile) {
      setError('Veuillez sélectionner un fichier.')
      return
    }

    setDocumentSaving(true)
    setError('')

    try {
      await uploadStudentDocument(details.id, {
        title: documentTitle.trim(),
        documentTypeCode,
        file: documentFile,
      })

      const documents = await getStudentDocuments(details.id)
      setStudentDocuments(documents)
      setDocumentModalOpen(false)
      setDocumentTitle('')
      setDocumentTypeCode('ADMINISTRATIVE')
      setDocumentFile(null)
      setInformationMessage('Le document a été téléversé avec succès.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDocumentSaving(false)
    }
  }

  function openDocumentArchiveModal(document) {
    setDocumentToArchive(document)
    setDocumentArchiveModalOpen(true)
    setError('')
  }

  function closeDocumentArchiveModal() {
    if (documentArchiving) return
    setDocumentArchiveModalOpen(false)
    setDocumentToArchive(null)
  }

  async function confirmDocumentArchive() {
    if (!documentToArchive) return

    setDocumentArchiving(true)
    setError('')

    try {
      await archiveStudentDocument(details.id, documentToArchive.id)
      const documents = await getStudentDocuments(details.id)
      setStudentDocuments(documents)
      setDocumentArchiveModalOpen(false)
      setDocumentToArchive(null)
      setInformationMessage('Le document a été archivé.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDocumentArchiving(false)
    }
  }

  const administrativeDocumentCount = studentDocuments.filter(
    (document) => document.document_type_code === 'ADMINISTRATIVE',
  ).length

  const otherDocumentCount = studentDocuments.filter(
    (document) => document.document_type_code === 'OTHER',
  ).length

  const filteredStudentDocuments = studentDocuments.filter((document) => {
    if (documentFilter === 'ALL') return true
    return document.document_type_code === documentFilter
  })

  async function viewStudentDocument(document) {
    setDocumentOpeningId(document.id)
    setError('')

    try {
      const { blob } = await getStudentDocumentFile(details.id, document.id)
      const fileUrl = window.URL.createObjectURL(blob)
      window.open(fileUrl, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => {
        window.URL.revokeObjectURL(fileUrl)
      }, 60000)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDocumentOpeningId(null)
    }
  }

  async function downloadStudentDocument(document) {
    setDocumentDownloadingId(document.id)
    setError('')

    try {
      const { blob, filename } = await getStudentDocumentFile(details.id, document.id)
      const fileUrl = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = fileUrl
      link.download = filename || document.original_filename || 'document'
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(fileUrl)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDocumentDownloadingId(null)
    }
  }

  function openEnrollmentModal() {
    setEnrollmentClassId('')
    setEnrollmentStartDate(new Date().toISOString().slice(0, 10))
    setEnrollmentSpecialties([])
    setEnrollmentSpecialtyIds([])
    setEnrollmentError('')
    setEnrollmentModalOpen(true)
    setError('')
  }

  function closeEnrollmentModal() {
    if (enrollmentSaving) return
    setEnrollmentModalOpen(false)
    setEnrollmentError('')
  }

  async function updateEnrollmentClass(event) {
    const classId = event.target.value
    setEnrollmentClassId(classId)
    setEnrollmentSpecialties([])
    setEnrollmentSpecialtyIds([])
    setEnrollmentError('')
    const selectedClass = classes.find(function findClass(item) {
      return String(item.id) === String(classId)
    })
    if (!['PREMIERE', 'TERMINALE'].includes(selectedClass?.level_code)) return
    try {
      const subjects = await getSchoolClassSubjects(classId, { isActive: true })
      setEnrollmentSpecialties(subjects.filter(function keepSpecialty(subject) {
        return subject.is_specialty
      }))
    } catch (requestError) { setError(requestError.message) }
  }

  function toggleEnrollmentSpecialty(subjectId) {
    setEnrollmentSpecialtyIds(function updateSelection(currentIds) {
      const id = String(subjectId)
      const selectedClass = classes.find(function findClass(item) {
        return String(item.id) === String(enrollmentClassId)
      })
      const requiredCount = getRequiredSpecialtyCount(selectedClass?.level_code)

      return currentIds.includes(id)
        ? currentIds.filter(function removeId(currentId) { return currentId !== id })
        : currentIds.length >= requiredCount
          ? currentIds
          : [...currentIds, id]
    })
  }

  async function submitEnrollment(event) {
    event.preventDefault()
    const selectedClass = classes.find(function findClass(item) {
      return String(item.id) === String(enrollmentClassId)
    })
    const requiredCount = getRequiredSpecialtyCount(selectedClass?.level_code)
    if (!selectedClass) {
      setEnrollmentError('Sélectionnez une classe.')
      return
    }
    if (!enrollmentStartDate) {
      setEnrollmentError('Renseignez la date d’inscription.')
      return
    }
    if (requiredCount > 0 && enrollmentSpecialtyIds.length !== requiredCount) {
      setEnrollmentError(`Sélectionnez exactement ${requiredCount} spécialités.`)
      setError(`Sélectionnez exactement ${requiredCount} spécialité${requiredCount > 1 ? 's' : ''}.`)
      return
    }
    setEnrollmentSaving(true)
    setEnrollmentError('')
    setError('')
    try {
      const updatedStudent = await enrollStudent(details.id, {
        class_id: enrollmentClassId,
        start_date: enrollmentStartDate,
        specialty_subject_ids: enrollmentSpecialtyIds,
      })
      setDetails(updatedStudent)
      closeEnrollmentModal()
      setInformationMessage('L’élève a été inscrit dans la classe.')
      await load()
    } catch (requestError) {
      setEnrollmentError(requestError.message || 'Impossible d’inscrire l’élève dans cette classe.')
      setError(requestError.message)
    } finally {
      setEnrollmentSaving(false)
    }
  }

  async function openGuardianModal() {
    setGuardianModalOpen(true)
    setSelectedGuardian(null)
    setGuardianQuery('')
    setGuardianRelationship('FATHER')
    setGuardianRelationshipDetails('')
    setGuardianLegal(false)
    setError('')
    try {
      setGuardianResults(await searchGuardians())
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  useEffect(() => {
    if (!guardianModalOpen) return
    searchGuardians(debouncedGuardianQuery)
      .then(setGuardianResults)
      .catch((requestError) => setError(requestError.message))
  }, [debouncedGuardianQuery, guardianModalOpen])

  function closeGuardianModal() {
    setGuardianModalOpen(false)
  }

  function selectGuardian(event) {
    const guardianId = event.currentTarget.dataset.guardianId
    setSelectedGuardian(
      guardianResults.find((guardian) => String(guardian.id) === guardianId),
    )
  }

  async function confirmGuardianLink() {
    if (!selectedGuardian) return
    setGuardianSaving(true)
    setError('')
    try {
      await linkGuardianToStudent(details.id, selectedGuardian.id, {
        relationship_type: guardianRelationship,
        relationship_details:
          guardianRelationship === 'OTHER' ? guardianRelationshipDetails.trim() : null,
        is_legal_guardian: guardianLegal,
        is_emergency_contact: false,
      })
      closeGuardianModal()
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setGuardianSaving(false)
    }
  }

  function handleGuardianNavigation(event) {
    const guardianId = event.currentTarget.dataset.guardianId
    const guardian = (details.guardians ?? []).find(
      (item) => String(item.id) === guardianId,
    )

    if (guardian) {
      onNavigate?.('guardian-details', guardian)
    }
  }

  function handleGuardianKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleGuardianNavigation(event)
    }
  }

  function openUnlinkGuardianModal(event, guardian) {
    event.stopPropagation()
    setGuardianToUnlink(guardian)
    setUnlinkGuardianModalOpen(true)
    setError('')
  }

  function closeUnlinkGuardianModal() {
    if (unlinkingGuardian) return
    setUnlinkGuardianModalOpen(false)
    setGuardianToUnlink(null)
  }

  async function confirmUnlinkGuardian() {
    if (!details?.id || !guardianToUnlink?.id) return
    setUnlinkingGuardian(true)
    setError('')
    try {
      await unlinkGuardianFromStudent(details.id, guardianToUnlink.id)
      setUnlinkGuardianModalOpen(false)
      setGuardianToUnlink(null)
      setInformationMessage('Le responsable a été retiré de cet élève.')
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUnlinkingGuardian(false)
    }
  }

  useEffect(() => {
    setPhotoFailed(false)
    load()
    // Recharge uniquement lorsque l'élève sélectionné change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id])

  async function load() {
    if (!student?.id) return
    try {
      const [full, yearsRes, classesRes] = await Promise.all([
        getStudent(student.id),
        import('../services/school_year_service.js').then((m) => m.getSchoolYears()),
        getSchoolClassesOverview({ status: 'ACTIVE' }),
      ])
      setDetails(full)
      setSchoolYears(yearsRes)
      setClasses(classesRes)
      resetForm(full)
      if (account?.role === 'ADMIN') {
        try {
          const documents = await getStudentDocuments(student.id)
          setStudentDocuments(documents)
        } catch (documentError) {
          console.error(documentError)
          setStudentDocuments([])
        }
      } else {
        setStudentDocuments([])
      }

      try {
        setAcademicSummary(await getStudentAcademicSummary(student.id))
      } catch (summaryError) {
        setAcademicSummary(null)
      }

      if (account?.role === 'ADMIN' || full.viewer_is_main_teacher) {
        try {
          const specialties = await getStudentSpecialties(student.id)
          setStudentSpecialties(specialties)
        } catch (specialtyError) {
          // Cas normal pour un élève qui n'est ni en Première ni en Terminale.
          setStudentSpecialties(null)
        }
      } else {
        setStudentSpecialties(null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  function resetForm(d) {
    setForm({
      first_name: d.first_name ?? '',
      last_name: d.last_name ?? '',
      gender: d.gender ?? '',
      birth_date: d.birth_date ?? '',
      birth_place: d.birth_place ?? '',
      nationality: d.nationality ?? '',
      phone: d.phone ?? '',
      email: d.email ?? '',
      address: d.address ?? '',
      previous_establishment: d.previous_establishment ?? '',
      medical_condition: d.medical_condition ?? '',
      is_enrolled_in_cned: d.is_enrolled_in_cned ?? false,
    })
  }

  function startStudentEditing() {
    setEditPhoto(null)
    setEditPhotoPreview(details.photo_path || '')
    setEditing(true)
  }

  function cancelStudentEditing() {
    if (editPhoto && editPhotoPreview) URL.revokeObjectURL(editPhotoPreview)
    setEditPhoto(null)
    setEditPhotoPreview('')
    setEditing(false)
    resetForm(details)
  }

  function selectStudentPhoto(event) {
    const selectedPhoto = event.target.files?.[0] || null
    if (!selectedPhoto) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedPhoto.type)) {
      setError('La photo doit être au format JPEG, PNG ou WebP.')
      event.target.value = ''
      return
    }
    if (selectedPhoto.size > 5 * 1024 * 1024) {
      setError('La photo doit avoir une taille maximale de 5 Mo.')
      event.target.value = ''
      return
    }
    if (editPhoto && editPhotoPreview) URL.revokeObjectURL(editPhotoPreview)
    setEditPhoto(selectedPhoto)
    setEditPhotoPreview(URL.createObjectURL(selectedPhoto))
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function className(id) {
    return classes.find((c) => c.id === id)?.name ?? '—'
  }
  function yearName(id) {
    return schoolYears.find((y) => y.id === id)?.name ?? '—'
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : (k === 'phone' ? normalizeInternationalPhone(v) : v)])
      )
      const updated = await updateStudent(details.id, payload)
      setDetails(updated)
      if (editPhoto) {
        await uploadAccountPhoto(details.account_id, editPhoto)
        URL.revokeObjectURL(editPhotoPreview)
      }
      setEditPhoto(null)
      setEditPhotoPreview('')
      setEditing(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function isEnrollmentSpecialtySelectionComplete() {
    const selectedClass = classes.find(function findSelectedEnrollmentClass(item) {
      return String(item.id) === String(enrollmentClassId)
    })
    const requiredCount = getRequiredSpecialtyCount(selectedClass?.level_code)

    return requiredCount === 0 || enrollmentSpecialtyIds.length === requiredCount
  }

  async function handleAction(actionFn) {
    setMenuOpen(false)
    setError('')
    try {
      const updated = await actionFn(details.id)
      setDetails(updated)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!details) return <div className="sdp-main">Élève non trouvé.</div>

  return (
    <main className="sdp-main">
      <h1 className="sdp-page-title">Dossier de l’élève</h1>
      <nav className="sdp-breadcrumb" aria-label="Fil d’Ariane">
        <button type="button" onClick={handleHomeNavigation}>Accueil</button>
        <ChevronRight aria-hidden="true" size={14} />
        <button type="button" onClick={handleStudentsNavigation}>Élèves</button>
        <ChevronRight aria-hidden="true" size={14} />
        <span className="sdp-breadcrumb-current">Détail de l’élève</span>
      </nav>

      <div className="sdp-header">
        <div className="sdp-header__identity">
          <span className="sdp-avatar">
            <img
              src={photoFailed ? DEFAULT_PHOTO : (details.photo_path || DEFAULT_PHOTO)}
              alt={`Photo de ${formatProfileName(details.first_name, details.last_name, details.gender, { fallback: 'cet eleve' })}`}
              onError={handlePhotoError}
            />
          </span>
          {canEdit ? <button type="button" className="sdp-photo-edit-button" onClick={startStudentEditing} aria-label="Modifier la photo"><Pencil size={14} /></button> : null}
          <div>
            <h1>{formatProfileName(details.first_name, details.last_name, details.gender)}</h1>
            <div className="sdp-header__badges">
              <StatusBadge status={details.status} />
            </div>
            <dl className="sdp-summary">
              <div><dt>Matricule</dt><dd>{details.registration_number ?? '—'}</dd></div>
              <div><dt>Sexe</dt><dd>{genderLabel(details.gender)}</dd></div>
              <div><dt>Âge</dt><dd>{calculateAge(details.birth_date)}</dd></div>
              <div><dt>Dernière modification</dt><dd>{formatDate(details.updated_at)}</dd></div>
              <div><dt>Classe actuelle</dt><dd>{details.class_name ?? className(details.class_id)}</dd></div>
              <div><dt>Année scolaire</dt><dd>{details.school_year_name ?? yearName(details.school_year_id)}</dd></div>
              <div><dt>Date d’inscription</dt><dd>{formatDate(details.admission_date)}</dd></div>
            </dl>
          </div>
        </div>

        {canEdit && (
          <div className="sdp-header__actions">
            <button
              type="button"
              className="sdp-btn-secondary"
              onClick={details.class_id ? () => handleAction(unenrollStudent) : openEnrollmentModal}
              disabled={details.status === 'ARCHIVED'}
              title={details.status === 'ARCHIVED' ? 'Un élève archivé ne peut pas être inscrit dans une classe.' : ''}
            >
              {details.class_id ? <CalendarMinus aria-hidden="true" size={17} /> : <CalendarPlus aria-hidden="true" size={17} />}
              {details.class_id ? 'Désinscrire de la classe' : 'Inscrire dans une classe'}
            </button>
            <div className="sdp-menu-wrapper">
              <button type="button" className="sdp-btn-primary" onClick={() => setMenuOpen((v) => !v)}>
                Actions
                <ChevronDown aria-hidden="true" size={16} />
              </button>
              {menuOpen && (
                <div className="sdp-menu">
                  <button onClick={() => handleAction(archiveStudent)} disabled={details.status === 'ARCHIVED'}>
                    Archiver l’élève
                  </button>
                  <button onClick={() => handleAction(deactivateStudent)} disabled={details.status !== 'ACTIVE'}>
                    Désactiver l’élève
                  </button>
                  <button onClick={() => handleAction(reactivateStudent)} disabled={details.status === 'ACTIVE'}>
                    Réactiver l’élève
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="sdp-error">{error}</p>}

      {enrollmentModalOpen && (
        <div className="sdp-modal-backdrop" role="presentation">
          <section
            className="sdp-enrollment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sdp-enrollment-title"
          >
            <header>
              <div>
                <h2 id="sdp-enrollment-title">Inscrire dans une classe</h2>
                <p>Choisissez la classe annuelle et la date de début.</p>
              </div>
              <button type="button" onClick={closeEnrollmentModal} aria-label="Fermer">
                <X aria-hidden="true" size={20} />
              </button>
            </header>
            <form onSubmit={submitEnrollment}>
              <label>
                Classe *
                <select
                  value={enrollmentClassId}
                  onChange={updateEnrollmentClass}
                  required
                >
                  <option value="">Sélectionner une classe</option>
                  {classes.map(function renderEnrollmentClass(schoolClass) {
                    return (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.level_name}
                        {schoolClass.group_label ? ` ${schoolClass.group_label}` : ''}
                        {' — '}
                        {schoolClass.school_year_name}
                      </option>
                    )
                  })}
                </select>
              </label>
              {['PREMIERE', 'TERMINALE'].includes(
                classes.find(function findClass(item) {
                  return String(item.id) === String(enrollmentClassId)
                })?.level_code,
              ) && (
                <fieldset className="sdp-enrollment-specialties">
                  <legend>Spécialités de l’élève *</legend>
                  <p>
                    Choisissez {classes.find(function findClass(item) {
                      return String(item.id) === String(enrollmentClassId)
                    })?.level_code === 'PREMIERE' ? '3' : '2'} spécialités proposées dans cette classe.
                  </p>
                  {enrollmentSpecialties.length === 0 ? (
                    <span>Aucune spécialité active n’est associée à cette classe.</span>
                  ) : enrollmentSpecialties.map(function renderSpecialty(subject) {
                    const checked = enrollmentSpecialtyIds.includes(String(subject.subject_id))
                    return (
                      <label key={subject.subject_id} className="sdp-enrollment-specialty">
                        <input type="checkbox" checked={checked} onChange={function selectSpecialty() { toggleEnrollmentSpecialty(subject.subject_id) }} />
                        <span>{subject.name}</span>
                      </label>
                    )
                  })}
                </fieldset>
              )}
              <label>
                Date d’inscription *
                <input
                  type="date"
                  value={enrollmentStartDate}
                  onChange={function updateEnrollmentDate(event) {
                    setEnrollmentStartDate(event.target.value)
                  }}
                  required
                />
              </label>
              {enrollmentError && (
                <p className="sdp-enrollment-error" role="alert">
                  {enrollmentError}
                </p>
              )}
              <footer>
                <button type="button" className="sdp-btn-secondary" onClick={closeEnrollmentModal}>
                  Annuler
                </button>
                <button
                  type="submit"
                  className="sdp-btn-primary"
                  disabled={enrollmentSaving || !isEnrollmentSpecialtySelectionComplete()}
                >
                  {enrollmentSaving ? 'Inscription…' : 'Confirmer l’inscription'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      <NotificationPopup
        message={informationMessage}
        type="info"
        onClose={function closeInformationMessage() {
          setInformationMessage('')
        }}
      />

      <div className="sdp-body">
        <section className="sdp-content">
          <nav className="sdp-tabs" aria-label="Rubriques du dossier élève">
            <button
              type="button"
              className={activeTab === 'personal' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'}
              onClick={showPersonalInformation}
            >
              <UserRound aria-hidden="true" size={17} />
              Informations personnelles
            </button>
            {canViewAcademics && (
              <button
                type="button"
                className={activeTab === 'school' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'}
                onClick={showSchoolInformation}
              >
                <GraduationCap aria-hidden="true" size={18} />
                Scolarité
              </button>
            )}
            <button
              type="button"
              className={activeTab === 'guardians' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'}
              onClick={showGuardians}
            >
              <UsersRound aria-hidden="true" size={18} />
              Responsables légaux
            </button>
            {canEdit && (
              <button
                type="button"
                className={activeTab === 'documents' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'}
                onClick={showDocuments}
              >
                <FolderOpen aria-hidden="true" size={18} />
                Documents
              </button>
            )}
          </nav>

          {activeTab === 'personal' && (editing ? (
              <form onSubmit={handleSave} className="sdp-form">
                <h3>Informations personnelles</h3>
                <label className="sdp-photo-edit">
                  Photo de profil
                  <span>
                    {editPhotoPreview ? (
                      <img src={editPhotoPreview} alt="Aperçu de la photo de l’élève" />
                    ) : (
                      <ImagePlus aria-hidden="true" size={26} />
                    )}
                    <strong>Choisir une nouvelle photo</strong>
                    <small>JPEG, PNG ou WebP — 5 Mo maximum</small>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={selectStudentPhoto}
                    />
                  </span>
                </label>
                <div className="sdp-row">
                  <label>Nom *<input required value={form.last_name} onChange={(e) => update('last_name', e.target.value)} /></label>
                  <label>Prénom *<input required value={form.first_name} onChange={(e) => update('first_name', e.target.value)} /></label>
                  <label>
                    Sexe
                    <select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                      <option value="">—</option>
                      <option value="FEMALE">Féminin</option>
                      <option value="MALE">Masculin</option>
                    </select>
                  </label>
                </div>
                <div className="sdp-row">
                  <label>Date de naissance<input type="date" value={form.birth_date ?? ''} onChange={(e) => update('birth_date', e.target.value)} /></label>
                  <label>Lieu de naissance<input value={form.birth_place} onChange={(e) => update('birth_place', e.target.value)} /></label>
                  <label>Nationalité *<select value={form.nationality} onChange={(e) => update('nationality', e.target.value)} required><option value="">Sélectionner une nationalité</option>{NATIONALITIES.map(function nationalityOption(nationality) { return <option key={nationality} value={nationality}>{nationality}</option> })}</select></label>
                </div>
                <div className="sdp-row">
                  <label>Téléphone<input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+224 610 70 08 00" pattern={INTERNATIONAL_PHONE_PATTERN} title="Exemple : +224 610 70 08 00" inputMode="tel" /></label>
                  <label>Email<input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
                </div>
                <label className="sdp-full">Adresse<input value={form.address} onChange={(e) => update('address', e.target.value)} /></label>
                <div className="sdp-row">
                  <label>Établissement précédent<input value={form.previous_establishment} onChange={(e) => update('previous_establishment', e.target.value)} /></label>
                  <label className="sdp-checkbox"><input type="checkbox" checked={form.is_enrolled_in_cned} onChange={(e) => update('is_enrolled_in_cned', e.target.checked)} /> Inscrit au CNED</label>
                </div>
                <label className="sdp-full">Maladie particulière<textarea value={form.medical_condition} onChange={(e) => update('medical_condition', e.target.value)} /></label>

                <div className="sdp-form-actions">
                  <button type="button" className="sdp-btn-outline" onClick={cancelStudentEditing}>Annuler</button>
                  <button type="submit" className="sdp-btn-primary" disabled={saving}>
                    {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="sdp-view">
                <div className="sdp-section-heading">
                  <h2>Informations personnelles</h2>
                  {canEdit && (
                    <button type="button" className="sdp-btn-outline" onClick={startStudentEditing}>
                      <Pencil aria-hidden="true" size={16} />
                      Modifier
                    </button>
                  )}
                </div>
                <div className="sdp-personal-grid">
                  <section>
                    <h3>Informations d’identité</h3>
                    <dl>
                      <div><dt>Nom</dt><dd>{details.last_name}</dd></div>
                      <div><dt>Prénom</dt><dd>{details.first_name}</dd></div>
                      <div><dt>Sexe</dt><dd>{genderLabel(details.gender)}</dd></div>
                      <div><dt>Date de naissance</dt><dd>{formatDate(details.birth_date)}</dd></div>
                      <div><dt>Lieu de naissance</dt><dd>{details.birth_place ?? '—'}</dd></div>
                      <div><dt>Nationalité</dt><dd>{details.nationality ?? '—'}</dd></div>
                    </dl>
                  </section>

                  <section>
                    <h3>Informations de contact</h3>
                    <dl>
                      <div><dt>Adresse</dt><dd>{details.address ?? '—'}</dd></div>
                      <div><dt>Téléphone</dt><dd>{details.phone ?? '—'}</dd></div>
                      <div><dt>Email</dt><dd>{details.email ?? '—'}</dd></div>
                    </dl>
                  </section>
                  <section>
                    <h3>Informations complémentaires</h3>
                    <dl>
                      <div><dt>Établissement précédent</dt><dd>{details.previous_establishment ?? '—'}</dd></div>
                      <div><dt>Inscrit au CNED</dt><dd>{details.is_enrolled_in_cned ? 'Oui' : 'Non'}</dd></div>
                      <div><dt>Maladie particulière</dt><dd>{details.medical_condition ?? 'Aucune renseignée'}</dd></div>
                    </dl>
                  </section>
                </div>
              </div>
          ))}

          {activeTab === 'school' && (
            <div className="sdp-school">
              <h2>Année scolaire en cours : {details.school_year_name ?? yearName(details.school_year_id)}</h2>

              <div className="sdp-school-stats">
                <article>
                  <UserRound aria-hidden="true" size={22} />
                  <div><span>Absences</span><strong>{academicSummary?.absence_count ?? 0}</strong></div>
                </article>
                <article>
                  <Clock3 aria-hidden="true" size={22} />
                  <div><span>Retards</span><strong>{academicSummary?.late_count ?? 0}</strong></div>
                </article>
                <article>
                  <ClipboardCheck aria-hidden="true" size={22} />
                  <div><span>Évaluations notées</span><strong>{academicSummary?.scored_assessment_count ?? 0}</strong></div>
                </article>
                <article>
                  <ChartNoAxesColumnIncreasing aria-hidden="true" size={22} />
                  <div>
                    <span>Moyenne générale</span>
                    <strong>
                      {academicSummary?.general_average_on_20 == null
                        ? '—'
                        : `${Number(academicSummary.general_average_on_20).toFixed(2)} /20`}
                    </strong>
                  </div>
                </article>
              </div>

              {studentSpecialties && (
                <section className="sdp-specialties-section">
                  <div className="sdp-section-heading">
                    <div>
                      <h3>Spécialités</h3>
                      <p>
                        {studentSpecialties.level_name}
                        {' — '}
                        {studentSpecialties.school_year_name}
                      </p>
                    </div>

                    {canEdit && (
                      <button
                        type="button"
                        className="sdp-btn-outline"
                        onClick={openSpecialtyModal}
                        disabled={specialtyLoading}
                      >
                        <Pencil aria-hidden="true" size={16} />
                        {specialtyLoading
                          ? 'Chargement…'
                          : 'Modifier les spécialités'}
                      </button>
                    )}
                  </div>

                  {(studentSpecialties.items ?? []).length === 0 ? (
                    <p className="sdp-placeholder">
                      Aucune spécialité n’est actuellement sélectionnée.
                    </p>
                  ) : (
                    <div className="sdp-specialties-list">
                      {studentSpecialties.items.map((specialty) => (
                        <span
                          key={specialty.subject_id}
                          className="sdp-specialty-badge"
                        >
                          {specialty.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <small>
                    {studentSpecialties.required_count} spécialité
                    {studentSpecialties.required_count > 1 ? 's' : ''}
                    {' '}requise
                    {studentSpecialties.required_count > 1 ? 's' : ''}.
                  </small>
                </section>
              )}

              <div className="sdp-school-tables">
                <section>
                  <h3>Moyennes de l’année en cours</h3>
                  <div className="sdp-school-table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Matière</th>
                          <th>Évaluations retenues</th>
                          <th>Coefficient</th>
                          <th>Moyenne</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(academicSummary?.subject_averages ?? []).length === 0 ? (
                          <tr><td colSpan="4">Aucune moyenne calculable.</td></tr>
                        ) : academicSummary.subject_averages.map(function renderSubjectAverage(item) {
                          return (
                            <tr key={item.class_subject_id}>
                              <td>{item.subject_name}</td>
                              <td>{item.assessment_count}</td>
                              <td>{Number(item.class_coefficient).toFixed(2)}</td>
                              <td>{item.average_on_20 == null ? '—' : `${Number(item.average_on_20).toFixed(2)} /20`}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h3>Historique scolaire</h3>
                  <div className="sdp-school-table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Année scolaire</th>
                          <th>Classe</th>
                          <th>Statut</th>
                          <th>Moyenne générale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(academicSummary?.history ?? []).length === 0 ? (
                          <tr><td colSpan="4">Aucune inscription scolaire.</td></tr>
                        ) : academicSummary.history.map(function renderAcademicHistory(item) {
                          return (
                            <tr key={item.enrollment_id}>
                              <td>{item.school_year_name}</td>
                              <td>{item.class_name}</td>
                              <td><span className="sdp-school-status">{item.end_date ? 'Terminée' : 'En cours'}</span></td>
                              <td>{item.general_average_on_20 == null ? '—' : `${Number(item.general_average_on_20).toFixed(2)} /20`}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'guardians' && (
            <div className="sdp-guardians">
              <div className="sdp-guardians-heading">
                <div>
                  <h2>Responsables légaux</h2>
                  <p>Les personnes responsables de cet élève.</p>
                </div>
                {canEdit && (
                  <button type="button" onClick={openGuardianModal}>
                    + Associer un responsable
                  </button>
                )}
              </div>

              {(details.guardians ?? []).length === 0 ? (
                <p className="sdp-placeholder">
                  Aucun responsable légal n’est actuellement associé à cet élève.
                </p>
              ) : (
                <div className="sdp-guardians-table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Lien</th>
                        <th>Nom et prénom</th>
                        <th>Téléphone</th>
                        <th>Email</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.guardians.map((guardian) => (
                        <tr
                          key={guardian.id}
                          role="link"
                          tabIndex={0}
                          data-guardian-id={guardian.id}
                          onClick={handleGuardianNavigation}
                          onKeyDown={handleGuardianKeyDown}
                        >
                            <td>
  <span className="sdp-guardian-link">
    <span className={`sdp-guardian-icon ${RELATIONSHIP_ICON_CLASS[guardian.relationship_type] ?? ''}`}>
      <UserRound aria-hidden="true" size={14} />
    </span>
    {guardian.relationship_label ?? guardian.relationship_type ?? '—'}
  </span>
</td>
                          <td>{formatProfileName(guardian.first_name, guardian.last_name, guardian.gender)}</td>
                          <td>{guardian.phone ?? '—'}</td>
                          <td>{guardian.email ?? '—'}</td>
                          <td className="sdp-guardian-actions-cell">
                            {canEdit && (
                              <button
                                type="button"
                                className="sdp-guardian-remove-btn"
                                onClick={(event) => openUnlinkGuardianModal(event, guardian)}
                              >
                                Retirer
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {guardianModalOpen && (
            <div className="sdp-guardian-modal-backdrop" role="presentation">
              <section className="sdp-guardian-modal" role="dialog" aria-modal="true">
                <header>
                  <div>
                    <h2>Associer un responsable</h2>
                    <p>Recherchez une personne existante puis précisez son lien avec l’élève.</p>
                  </div>
                  <button type="button" onClick={closeGuardianModal} aria-label="Fermer">
                    <X aria-hidden="true" size={20} />
                  </button>
                </header>

                <form className="sdp-guardian-search" onSubmit={(event) => event.preventDefault()}>
                  <Search aria-hidden="true" size={18} />
                  <input
                    value={guardianQuery}
                    onChange={function updateGuardianQuery(event) {
                      setGuardianQuery(event.target.value)
                    }}
                    placeholder="Nom ou téléphone"
                  />
                </form>

                <div className="sdp-guardian-results">
                  {guardianResults.map((guardian) => (
                    <button
                      type="button"
                      key={guardian.id}
                      data-guardian-id={guardian.id}
                      onClick={selectGuardian}
                      className={
                        selectedGuardian?.id === guardian.id
                          ? 'sdp-guardian-result sdp-guardian-result--selected'
                          : 'sdp-guardian-result'
                      }
                    >
                      <strong>{formatProfileName(guardian.first_name, guardian.last_name, guardian.gender)}</strong>
                      <span>{guardian.phone}</span>
                    </button>
                  ))}
                </div>

                <div className="sdp-guardian-link-fields">
                  <label>
                    Lien avec l’élève
                    <select
                      value={guardianRelationship}
                      onChange={function updateRelationship(event) {
                        setGuardianRelationship(event.target.value)
                      }}
                    >
                      <option value="FATHER">Père</option>
                      <option value="MOTHER">Mère</option>
                      <option value="OTHER">Autre</option>
                    </select>
                  </label>
                  {guardianRelationship === 'OTHER' && (
                    <label>
                      Précision du lien
                      <input
                        type="text"
                        maxLength="100"
                        value={guardianRelationshipDetails}
                        onChange={function updateRelationshipDetails(event) {
                          setGuardianRelationshipDetails(event.target.value)
                        }}
                        placeholder="Exemple : tante, oncle…"
                        required
                      />
                    </label>
                  )}
                  <label className="sdp-guardian-checkbox">
                    <input
                      type="checkbox"
                      checked={guardianLegal}
                      onChange={function updateLegalGuardian(event) {
                        setGuardianLegal(event.target.checked)
                      }}
                    />
                    Responsable légal
                  </label>
                </div>

                <footer>
                  <button type="button" onClick={closeGuardianModal}>Annuler</button>
                  <button
                    type="button"
                    onClick={confirmGuardianLink}
                    disabled={
                      !selectedGuardian
                      || guardianSaving
                      || (
                        guardianRelationship === 'OTHER'
                        && !guardianRelationshipDetails.trim()
                      )
                    }
                  >
                    {guardianSaving ? 'Association…' : 'Associer'}
                  </button>
                </footer>
              </section>
            </div>
          )}

          {unlinkGuardianModalOpen && (
            <div className="sdp-guardian-modal-backdrop" role="presentation">
              <section className="sdp-guardian-modal" role="dialog" aria-modal="true" aria-labelledby="sdp-unlink-guardian-title">
                <header>
                  <div>
                    <h2 id="sdp-unlink-guardian-title">Retirer ce responsable ?</h2>
                    <p>
                      Confirmez le retrait de
                      {' '}
                      <strong>{formatProfileName(guardianToUnlink?.first_name, guardianToUnlink?.last_name, guardianToUnlink?.gender, { fallback: 'ce responsable' })}</strong>
                      {' '}
                      pour cet élève.
                    </p>
                  </div>
                  <button type="button" onClick={closeUnlinkGuardianModal} aria-label="Fermer">
                    <X aria-hidden="true" size={20} />
                  </button>
                </header>
                <footer>
                  <button type="button" onClick={closeUnlinkGuardianModal} disabled={unlinkingGuardian}>
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="sdp-guardian-confirm-remove-btn"
                    onClick={confirmUnlinkGuardian}
                    disabled={unlinkingGuardian}
                  >
                    {unlinkingGuardian ? 'Retrait…' : 'Confirmer le retrait'}
                  </button>
                </footer>
              </section>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="sdp-documents">
              <div className="sdp-documents-header">
                <div>
                  <h2>Documents</h2>
                  <p>Liste des documents associés à cet élève.</p>
                </div>
                <button
                  type="button"
                  className="sdp-documents-header__action"
                  onClick={openDocumentModal}
                >
                  <Upload aria-hidden="true" size={16} />
                  Téléverser un document
                </button>
              </div>

              <div className="sdp-document-filters">
                <button
                  type="button"
                  className={documentFilter === 'ALL' ? 'sdp-document-filter-active' : ''}
                  onClick={() => setDocumentFilter('ALL')}
                >
                  Tous ({studentDocuments.length})
                </button>
                <button
                  type="button"
                  className={documentFilter === 'ADMINISTRATIVE' ? 'sdp-document-filter-active' : ''}
                  onClick={() => setDocumentFilter('ADMINISTRATIVE')}
                >
                  Administratifs ({administrativeDocumentCount})
                </button>
                <button
                  type="button"
                  className={documentFilter === 'OTHER' ? 'sdp-document-filter-active' : ''}
                  onClick={() => setDocumentFilter('OTHER')}
                >
                  Autres ({otherDocumentCount})
                </button>
              </div>

              <div className="sdp-documents-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Catégorie</th>
                      <th>Date d’ajout</th>
                      <th>Taille</th>
                      <th>Téléversé par</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudentDocuments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="sdp-documents-empty">
                          <FileText aria-hidden="true" size={24} />
                          Aucun document dans cette catégorie.
                        </td>
                      </tr>
                    ) : (
                      filteredStudentDocuments.map((document) => (
                        <tr key={document.id}>
                          <td>{document.title || document.original_filename}</td>
                          <td>{document.document_type_label || document.document_type_code || '—'}</td>
                          <td>{formatDate(document.created_at)}</td>
                          <td>{formatFileSize(document.size_bytes)}</td>
                          <td>{document.uploaded_by_registration_number || '—'}</td>
                          <td>
                            <div className="sdp-document-actions">
                              <button
                                type="button"
                                onClick={() => viewStudentDocument(document)}
                                disabled={documentOpeningId === document.id}
                                title="Voir le document"
                                className="sdp-document-action-btn"
                              >
                                <Eye aria-hidden="true" size={16} />
                                {documentOpeningId === document.id ? 'Ouverture…' : 'Voir'}
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadStudentDocument(document)}
                                disabled={documentDownloadingId === document.id}
                                title="Télécharger le document"
                                className="sdp-document-action-btn"
                              >
                                <Download aria-hidden="true" size={16} />
                                Télécharger
                              </button>
                              <button
                                type="button"
                                onClick={() => openDocumentArchiveModal(document)}
                                className="sdp-document-action-btn sdp-document-action-btn--danger"
                              >
                                Archiver
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

                <p className="sdp-documents-note">
                  <Info aria-hidden="true" size={16} />
                  Les documents téléversés devront rester lisibles et à jour.
                </p>
              </div>
            )}

          {specialtyModalOpen && (
            <div
              className="sdp-guardian-modal-backdrop"
              role="presentation"
            >
              <section
                className="sdp-guardian-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="sdp-specialty-modal-title"
              >
                <header>
                  <div>
                    <h2 id="sdp-specialty-modal-title">
                      Modifier les spécialités
                    </h2>
                    <p>
                      Sélectionnez exactement{' '}
                      <strong>
                        {studentSpecialties?.required_count ?? 0}
                      </strong>{' '}
                      spécialité
                      {(studentSpecialties?.required_count ?? 0) > 1
                        ? 's'
                        : ''}
                      .
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeSpecialtyModal}
                    disabled={specialtySaving}
                    aria-label="Fermer"
                  >
                    <X aria-hidden="true" size={20} />
                  </button>
                </header>

                <div className="sdp-specialty-options">
                  {availableSpecialties.length === 0 ? (
                    <p className="sdp-placeholder">
                      Aucune spécialité n’est proposée dans cette classe.
                    </p>
                  ) : (
                    availableSpecialties.map((specialty) => {
                      const specialtyId = String(specialty.id)
                      const checked =
                        selectedSpecialtyIds.includes(specialtyId)

                      return (
                        <label
                          key={specialty.id}
                          className="sdp-specialty-option"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleSpecialty(specialty.id)
                            }
                          />

                          <span>
                            <strong>{specialty.name}</strong>

                            {specialty.description && (
                              <small>{specialty.description}</small>
                            )}
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>

                <p>
                  {selectedSpecialtyIds.length}
                  {' / '}
                  {studentSpecialties?.required_count ?? 0}
                  {' '}sélectionnée
                  {selectedSpecialtyIds.length > 1 ? 's' : ''}
                </p>

                <footer>
                  <button
                    type="button"
                    onClick={closeSpecialtyModal}
                    disabled={specialtySaving}
                  >
                    Annuler
                  </button>

                  <button
                    type="button"
                    className="sdp-btn-primary"
                    onClick={saveStudentSpecialties}
                    disabled={
                      specialtySaving
                      || selectedSpecialtyIds.length
                        !== studentSpecialties?.required_count
                    }
                  >
                    {specialtySaving
                      ? 'Enregistrement…'
                      : 'Enregistrer'}
                  </button>
                </footer>
              </section>
            </div>
          )}

          {documentModalOpen && (
            <div className="sdp-guardian-modal-backdrop" role="presentation">
              <section
                className="sdp-guardian-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="sdp-document-modal-title"
              >
                <header>
                  <div>
                    <h2 id="sdp-document-modal-title">Téléverser un document</h2>
                    <p>Ajoutez un document au dossier de cet élève.</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeDocumentModal}
                    aria-label="Fermer"
                    disabled={documentSaving}
                  >
                    <X aria-hidden="true" size={20} />
                  </button>
                </header>

                <form onSubmit={submitDocumentUpload}>
                  <div className="sdp-guardian-link-fields">
                    <label>
                      Titre du document *
                      <input
                        type="text"
                        maxLength="150"
                        value={documentTitle}
                        onChange={(event) => setDocumentTitle(event.target.value)}
                        placeholder="Exemple : Certificat de scolarité"
                        required
                      />
                    </label>

                    <label>
                      Type de document *
                      <select
                        value={documentTypeCode}
                        onChange={(event) => setDocumentTypeCode(event.target.value)}
                      >
                        <option value="ADMINISTRATIVE">Document administratif</option>
                        <option value="OTHER">Autre document</option>
                      </select>
                    </label>

                    <label>
                      Fichier *
                      <input
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        onChange={selectDocumentFile}
                        required
                      />
                    </label>

                    <small>
                      Formats acceptés : PDF, JPEG, PNG et WebP. Taille maximale : 5 Mo.
                    </small>

                    {documentFile && (
                      <p>
                        Fichier sélectionné : <strong>{documentFile.name}</strong>
                      </p>
                    )}
                  </div>

                  <footer>
                    <button
                      type="button"
                      onClick={closeDocumentModal}
                      disabled={documentSaving}
                    >
                      Annuler
                    </button>

                    <button
                      type="submit"
                      disabled={
                        documentSaving
                        || !documentTitle.trim()
                        || !documentFile
                      }
                    >
                      {documentSaving ? 'Téléversement…' : 'Téléverser'}
                    </button>
                  </footer>
                </form>
              </section>
            </div>
          )}

          {documentArchiveModalOpen && (
            <div className="sdp-guardian-modal-backdrop" role="presentation">
              <section
                className="sdp-guardian-modal"
                role="dialog"
                aria-modal="true"
              >
                <header>
                  <div>
                    <h2>Archiver ce document ?</h2>
                    <p>
                      Le document{' '}
                      <strong>
                        {documentToArchive?.title || documentToArchive?.original_filename}
                      </strong>{' '}
                      ne sera plus affiché dans le dossier de l’élève.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeDocumentArchiveModal}
                    disabled={documentArchiving}
                    aria-label="Fermer"
                  >
                    <X aria-hidden="true" size={20} />
                  </button>
                </header>

                <footer>
                  <button
                    type="button"
                    onClick={closeDocumentArchiveModal}
                    disabled={documentArchiving}
                  >
                    Annuler
                  </button>

                  <button
                    type="button"
                    onClick={confirmDocumentArchive}
                    disabled={documentArchiving}
                  >
                    {documentArchiving ? 'Archivage…' : 'Confirmer l’archivage'}
                  </button>
                </footer>
              </section>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
