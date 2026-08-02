import { useEffect, useState } from 'react'
import {
  ChartNoAxesColumnIncreasing,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderOpen,
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
} from '../services/students_service.js'
import {
  linkGuardianToStudent,
  searchGuardians,
  unlinkGuardianFromStudent,
} from '../services/guardians_service.js'
import '../styles/student_details_page.css'
import NotificationPopup from '../components/notification_popup.jsx'
import { uploadAccountPhoto } from '../services/account_service.js'
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

export default function StudentDetailsPage({ student, onNavigate }) {
  const [details, setDetails] = useState(student)
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
  const [informationMessage, setInformationMessage] = useState('')
  const [editPhoto, setEditPhoto] = useState(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState('')

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

  function showGuardians() {
    setActiveTab('guardians')
  }

  function showDocuments() {
    setActiveTab('documents')
  }

  function openEnrollmentModal() {
    setEnrollmentClassId('')
    setEnrollmentStartDate(new Date().toISOString().slice(0, 10))
    setEnrollmentModalOpen(true)
    setError('')
  }

  function closeEnrollmentModal() {
    setEnrollmentModalOpen(false)
  }

  async function submitEnrollment(event) {
    event.preventDefault()
    setEnrollmentSaving(true)
    setError('')
    try {
      const updatedStudent = await enrollStudent(details.id, {
        class_id: enrollmentClassId,
        start_date: enrollmentStartDate,
      })
      setDetails(updatedStudent)
      closeEnrollmentModal()
      setInformationMessage('L’élève a été inscrit dans la classe.')
      await load()
    } catch (requestError) {
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

  function closeGuardianModal() {
    setGuardianModalOpen(false)
  }

  async function handleGuardianSearch(event) {
    event.preventDefault()
    try {
      setGuardianResults(await searchGuardians(guardianQuery))
    } catch (requestError) {
      setError(requestError.message)
    }
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
        import('../services/school_class_service.js').then((m) => m.getSchoolClasses()),
      ])
      setDetails(full)
      setSchoolYears(yearsRes)
      setClasses(classesRes)
      resetForm(full)
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
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
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
              alt={`Photo de ${details.first_name} ${details.last_name}`}
              onError={handlePhotoError}
            />
          </span>
          <div>
            <h1>{details.first_name} {details.last_name}</h1>
            <div className="sdp-header__badges">
              <StatusBadge status={details.status} />
            </div>
            <dl className="sdp-summary">
              <div><dt>Matricule</dt><dd>{details.registration_number ?? '—'}</dd></div>
              <div><dt>Sexe</dt><dd>{genderLabel(details.gender)}</dd></div>
              <div><dt>Dernière modification</dt><dd>{formatDate(details.updated_at)}</dd></div>
              <div><dt>Classe actuelle</dt><dd>{details.class_name ?? className(details.class_id)}</dd></div>
              <div><dt>Année scolaire</dt><dd>{details.school_year_name ?? yearName(details.school_year_id)}</dd></div>
              <div><dt>Date d’inscription</dt><dd>{formatDate(details.admission_date)}</dd></div>
            </dl>
          </div>
        </div>

        <div className="sdp-header__actions">
          <button
            type="button"
            className="sdp-btn-secondary"
            onClick={openEnrollmentModal}
            disabled={details.status === 'ARCHIVED'}
            title={details.status === 'ARCHIVED' ? 'Un élève archivé ne peut pas être inscrit dans une classe.' : ''}
          >
            <CalendarPlus aria-hidden="true" size={17} />
            {details.class_id ? 'Changer de classe' : 'Inscrire dans une classe'}
          </button>
          <div className="sdp-menu-wrapper">
            <button type="button" className="sdp-btn-primary" onClick={() => setMenuOpen((v) => !v)}>
              Actions
              <ChevronDown aria-hidden="true" size={16} />
            </button>
            {menuOpen && (
              <div className="sdp-menu">
                <button onClick={() => handleAction(archiveStudent)} disabled={details.status === 'ARCHIVED'}>
                  🗄 Archiver l'élève
                </button>
                <button onClick={() => handleAction(deactivateStudent)} disabled={details.status !== 'ACTIVE'}>
                  ⏸ Désactiver l'élève
                </button>
                <button onClick={() => handleAction(reactivateStudent)} disabled={details.status === 'ACTIVE'}>
                  ↻ Réactiver l'élève
                </button>
              </div>
            )}
          </div>
        </div>
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
                <h2 id="sdp-enrollment-title">{details.class_id ? 'Changer de classe' : 'Inscrire dans une classe'}</h2>
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
                  onChange={function updateEnrollmentClass(event) {
                    setEnrollmentClassId(event.target.value)
                  }}
                  required
                >
                  <option value="">Sélectionner une classe</option>
                  {classes.map(function renderEnrollmentClass(schoolClass) {
                    return (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.name} — {schoolClass.school_year_name || ''}
                      </option>
                    )
                  })}
                </select>
              </label>
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
              <footer>
                <button type="button" className="sdp-btn-secondary" onClick={closeEnrollmentModal}>
                  Annuler
                </button>
                <button type="submit" className="sdp-btn-primary" disabled={enrollmentSaving}>
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
            <button
              type="button"
              className={activeTab === 'school' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'}
              onClick={showSchoolInformation}
            >
              <GraduationCap aria-hidden="true" size={18} />
              Scolarité
            </button>
            <button
              type="button"
              className={activeTab === 'guardians' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'}
              onClick={showGuardians}
            >
              <UsersRound aria-hidden="true" size={18} />
              Responsables légaux
            </button>
            <button
              type="button"
              className={activeTab === 'documents' ? 'sdp-tab sdp-tab--active' : 'sdp-tab'}
              onClick={showDocuments}
            >
              <FolderOpen aria-hidden="true" size={18} />
              Documents
            </button>
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
                  <label>Nationalité<input value={form.nationality} onChange={(e) => update('nationality', e.target.value)} /></label>
                </div>
                <div className="sdp-row">
                  <label>Téléphone<input value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label>
                  <label>Email<input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
                </div>
                <label className="sdp-full">Adresse<input value={form.address} onChange={(e) => update('address', e.target.value)} /></label>

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
                  <button type="button" className="sdp-btn-outline" onClick={startStudentEditing}>
                    <Pencil aria-hidden="true" size={16} />
                    Modifier
                  </button>
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
                </div>
              </div>
          ))}

          {activeTab === 'school' && (
            <div className="sdp-school">
              <h2>Année scolaire en cours : {details.school_year_name ?? yearName(details.school_year_id)}</h2>

              <div className="sdp-school-stats">
                <article>
                  <UserRound aria-hidden="true" size={22} />
                  <div><span>Absences</span><strong>—</strong></div>
                </article>
                <article>
                  <Clock3 aria-hidden="true" size={22} />
                  <div><span>Retards</span><strong>—</strong></div>
                </article>
                <article>
                  <ClipboardCheck aria-hidden="true" size={22} />
                  <div><span>Évaluations notées</span><strong>—</strong></div>
                </article>
                <article>
                  <ChartNoAxesColumnIncreasing aria-hidden="true" size={22} />
                  <div><span>Moyenne générale</span><strong>— /20</strong></div>
                </article>
              </div>

              <div className="sdp-school-tables">
                <section>
                  <h3>Notes de l’année en cours</h3>
                  <p className="sdp-placeholder">
                    Les notes seront affichées lorsque cette fonctionnalité sera disponible.
                  </p>
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
                        <tr>
                          <td>{details.school_year_name ?? yearName(details.school_year_id)}</td>
                          <td>{details.class_name ?? className(details.class_id)}</td>
                          <td><span className="sdp-school-status">En cours</span></td>
                          <td>—</td>
                        </tr>
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
                <button type="button" onClick={openGuardianModal}>
                  + Associer un responsable
                </button>
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
                          <td>{guardian.first_name} {guardian.last_name}</td>
                          <td>{guardian.phone ?? '—'}</td>
                          <td>{guardian.email ?? '—'}</td>
                          <td className="sdp-guardian-actions-cell">
                            <button
                              type="button"
                              className="sdp-guardian-remove-btn"
                              onClick={(event) => openUnlinkGuardianModal(event, guardian)}
                            >
                              Retirer
                            </button>
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

                <form className="sdp-guardian-search" onSubmit={handleGuardianSearch}>
                  <Search aria-hidden="true" size={18} />
                  <input
                    value={guardianQuery}
                    onChange={function updateGuardianQuery(event) {
                      setGuardianQuery(event.target.value)
                    }}
                    placeholder="Nom ou téléphone"
                  />
                  <button type="submit">Rechercher</button>
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
                      <strong>{guardian.first_name} {guardian.last_name}</strong>
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
                      <strong>{guardianToUnlink?.first_name} {guardianToUnlink?.last_name}</strong>
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
                <button type="button" disabled title="Fonctionnalité à venir">
                  <Upload aria-hidden="true" size={16} />
                  Téléverser un document
                </button>
              </div>

              <div className="sdp-document-filters">
                <button type="button" className="sdp-document-filter-active">
                  Tous ({(details.documents ?? []).length})
                </button>
                <button type="button">Administratifs (0)</button>
                <button type="button">Scolaires (0)</button>
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
                    </tr>
                  </thead>
                  <tbody>
                    {(details.documents ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="sdp-documents-empty">
                          <FileText aria-hidden="true" size={24} />
                          Aucun document associé à cet élève.
                        </td>
                      </tr>
                    ) : (
                      details.documents.map((document) => (
                        <tr key={document.id}>
                          <td>{document.name}</td>
                          <td>{document.category ?? '—'}</td>
                          <td>{formatDate(document.created_at)}</td>
                          <td>{document.size_label ?? '—'}</td>
                          <td>{document.uploaded_by_name ?? '—'}</td>
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
        </section>

      </div>
    </main>
  )
}
