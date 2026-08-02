import { useEffect, useMemo, useState } from 'react'
import {
  BadgeInfo,
  BookOpen,
  CalendarDays,
  Ellipsis,
  ChevronDown,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Shield,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import defaultPhoto from '../assets/image_phtoto_default.png'
import { getTeacherDetail } from '../services/teachers_overview_service.js'
import { getSchoolClassesOverview, updateSchoolClass } from '../services/school_classes_overview_service.js'
import '../styles/teacher_details_page.css'

const DEFAULT_PHOTO = defaultPhoto

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00`))
}

function genderLabel(value) {
  if (value === 'MALE' || value === 'M') return 'Masculin'
  if (value === 'FEMALE' || value === 'F') return 'Féminin'
  return value || '—'
}

function isActive(details) {
  return details.status === 'ACTIVE'
}

export default function TeacherDetailsPage({ teacher }) {
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState('personal')
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignClasses, setAssignClasses] = useState([])
  const [assignClassId, setAssignClassId] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignSaving, setAssignSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(function loadTeacherDetailsEffect() {
    if (!teacher?.id) {
      setLoading(false)
      return
    }

    loadTeacher()
  }, [teacher?.id])

  async function loadTeacher() {
    if (!teacher?.id) return
    try {
      setDetails(await getTeacherDetail(teacher.id))
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const mainSubjects = useMemo(() => {
    if (!details?.subjects?.length) return 'Non renseigné'
    return details.subjects.slice(0, 2).join(', ')
  }, [details?.subjects])

  const evaluationRows = useMemo(() => details?.taught_subjects ?? [], [details?.taught_subjects])
  const assignableClasses = useMemo(
    () => assignClasses.filter((schoolClass) => schoolClass.main_teacher_id !== teacher?.id),
    [assignClasses, teacher?.id],
  )

  async function openAssignModal() {
    setAssignModalOpen(true)
    setAssignClassId('')
    setAssignLoading(true)
    setErrorMessage('')
    try {
      const classes = await getSchoolClassesOverview({ limit: 200 })
      setAssignClasses(classes)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setAssignLoading(false)
    }
  }

  function closeAssignModal() {
    if (assignSaving) return
    setAssignModalOpen(false)
    setAssignClassId('')
  }

  async function confirmAssignClass() {
    if (!assignClassId || !teacher?.id) return
    setAssignSaving(true)
    setErrorMessage('')
    try {
      await updateSchoolClass(assignClassId, { main_teacher_id: teacher.id })
      closeAssignModal()
      await loadTeacher()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setAssignSaving(false)
    }
  }

  if (loading) return <main className="tdp-main"><p>Chargement de l’enseignant…</p></main>
  if (!details) return <main className="tdp-main"><p className="tdp-error">{errorMessage || 'Enseignant introuvable.'}</p></main>

  return (
    <main className="tdp-main">
      <h1 className="tdp-title">Détails de l’enseignant</h1>

      <section className="tdp-hero">
        <div className="tdp-hero__top">
          <div className="tdp-hero__identity">
            <span className="tdp-hero__avatar">
              <img
                src={details.photo_path || DEFAULT_PHOTO}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = DEFAULT_PHOTO
                }}
              />
            </span>

            <div>
              <h2 className="tdp-hero__name">{details.first_name} {details.last_name}</h2>
              <div className="tdp-hero__badges">
                <span className={`tdp-pill ${isActive(details) ? 'tdp-pill--active' : 'tdp-pill--inactive'}`}>
                  {isActive(details) ? 'Actif' : 'Inactif'}
                </span>
                {details.classes.length > 0 && <span className="tdp-pill tdp-pill--main">Professeur principal</span>}
              </div>
            </div>
          </div>

          <button type="button" className="tdp-actions" aria-label="Actions enseignant">
            Actions
            <ChevronDown aria-hidden="true" size={16} />
          </button>
        </div>

        <dl className="tdp-hero__stats">
          <div>
            <dt>Matricule</dt>
            <dd>{details.registration_number}</dd>
          </div>
          <div>
            <dt>Matières principales</dt>
            <dd>{mainSubjects}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{details.email ?? 'Non renseigné'}</dd>
          </div>
          <div>
            <dt>Téléphone</dt>
            <dd>{details.phone ?? 'Non renseigné'}</dd>
          </div>
        </dl>
      </section>

      <section className="tdp-panels">
        <nav className="tdp-tabs" aria-label="Onglets du dossier enseignant">
          <button
            type="button"
            className={activeTab === 'personal' ? 'tdp-tab tdp-tab--active' : 'tdp-tab'}
            onClick={() => setActiveTab('personal')}
          >
            Informations personnelles
          </button>
          <button
            type="button"
            className={activeTab === 'classes' ? 'tdp-tab tdp-tab--active' : 'tdp-tab'}
            onClick={() => setActiveTab('classes')}
          >
            Classes
          </button>
          <button
            type="button"
            className={activeTab === 'subjects' ? 'tdp-tab tdp-tab--active' : 'tdp-tab'}
            onClick={() => setActiveTab('subjects')}
          >
            Matières enseignées
          </button>
          <button
            type="button"
            className={activeTab === 'evaluations' ? 'tdp-tab tdp-tab--active' : 'tdp-tab'}
            onClick={() => setActiveTab('evaluations')}
          >
            Évaluations et notes
          </button>
        </nav>

        {activeTab === 'personal' && (
          <article className="tdp-panel tdp-panel--personal">
            <h3>Informations personnelles</h3>
            <dl className="tdp-personal-list">
              <div>
                <dt><UserRound aria-hidden="true" size={16} /> Prénom</dt>
                <dd>{details.first_name || '—'}</dd>
              </div>
              <div>
                <dt><UserRound aria-hidden="true" size={16} /> Nom</dt>
                <dd>{details.last_name || '—'}</dd>
              </div>
              <div>
                <dt><CalendarDays aria-hidden="true" size={16} /> Date de naissance</dt>
                <dd>{formatDate(details.birth_date)}</dd>
              </div>
              <div>
                <dt><Shield aria-hidden="true" size={16} /> Sexe</dt>
                <dd>{genderLabel(details.gender)}</dd>
              </div>
              <div>
                <dt><MapPin aria-hidden="true" size={16} /> Adresse</dt>
                <dd>{details.address ?? 'Non renseignée'}</dd>
              </div>
              <div>
                <dt><Phone aria-hidden="true" size={16} /> Téléphone</dt>
                <dd>{details.phone ?? 'Non renseigné'}</dd>
              </div>
              <div>
                <dt><Mail aria-hidden="true" size={16} /> Email</dt>
                <dd>{details.email ?? 'Non renseigné'}</dd>
              </div>
              <div>
                <dt><BadgeInfo aria-hidden="true" size={16} /> Matricule</dt>
                <dd>{details.registration_number}</dd>
              </div>
              <div>
                <dt><CalendarDays aria-hidden="true" size={16} /> Date d’embauche</dt>
                <dd>{formatDate(details.hire_date)}</dd>
              </div>
              <div>
                <dt><GraduationCap aria-hidden="true" size={16} /> Qualification</dt>
                <dd>{details.qualification ?? 'Non renseignée'}</dd>
              </div>
            </dl>
          </article>
        )}

        {activeTab === 'classes' && (
          <article className="tdp-panel">
            <div className="tdp-panel__head tdp-panel__head--classes">
              <div>
                <h3>Classes encadrées</h3>
                <p className="tdp-panel__description">
                  Liste des classes dans lesquelles l’enseignant est professeur principal.
                </p>
              </div>
              <button type="button" className="tdp-assign-button" onClick={openAssignModal}>
                <UsersRound aria-hidden="true" size={16} />
                Affecter à une classe
              </button>
            </div>

            <div className="tdp-table-wrap">
              <table className="tdp-table tdp-table--classes">
                <thead>
                  <tr>
                    <th>Classe</th>
                    <th>Niveau</th>
                    <th>Année scolaire</th>
                    <th>Rôle</th>
                    <th>Effectif</th>
                  </tr>
                </thead>
                <tbody>
                  {details.classes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="tdp-empty">Aucune classe principale assignée.</td>
                    </tr>
                  ) : (
                    details.classes.map((schoolClass, index) => (
                      <tr key={schoolClass.id}>
                        <td>
                          <span className="tdp-class-name">
                            <span className={`tdp-class-dot tdp-class-dot--${index % 3}`} />
                            <span>
                              <strong>{schoolClass.name}</strong>
                              <small>{schoolClass.group_label}</small>
                            </span>
                          </span>
                        </td>
                        <td>{schoolClass.level_name}</td>
                        <td>{schoolClass.school_year_name}</td>
                        <td><span className="tdp-role-badge">{schoolClass.role_label}</span></td>
                        <td>{schoolClass.student_count} élève(s)</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="tdp-table-footer">
              <span>Affichage 1 à {details.classes.length} sur {details.classes.length} classes</span>
            </div>

            <aside className="tdp-note">
              <strong>Bon à savoir</strong>
              <p>Les classes listées correspondent aux classes dont cet enseignant est actuellement professeur principal.</p>
            </aside>
          </article>
        )}

        {activeTab === 'subjects' && (
          <article className="tdp-panel">
            <div className="tdp-panel__head tdp-panel__head--classes">
              <div>
                <h3>Matières enseignées</h3>
                <p className="tdp-panel__description">
                  Liste des matières que l’enseignant enseigne et des classes associées.
                </p>
              </div>
              <button type="button" className="tdp-assign-button" disabled>
                <BookOpen aria-hidden="true" size={16} />
                Ajouter une matière
              </button>
            </div>

            <div className="tdp-table-wrap">
              <table className="tdp-table tdp-table--subjects">
                <thead>
                  <tr>
                    <th>Matière</th>
                    <th>Niveau / Classe</th>
                    <th>Coefficient</th>
                    <th>Année scolaire</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {details.taught_subjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="tdp-empty">Aucune matière rattachée.</td>
                    </tr>
                  ) : (
                    details.taught_subjects.map((subjectRow, index) => (
                      <tr key={subjectRow.id}>
                        <td>
                          <span className="tdp-subject-name">
                            <span className={`tdp-subject-icon tdp-subject-icon--${index % 2}`}>
                              <BookOpen aria-hidden="true" size={13} />
                            </span>
                            <strong>{subjectRow.subject_name}</strong>
                          </span>
                        </td>
                        <td>
                          <span className="tdp-subject-class">
                            <strong>{subjectRow.class_name}</strong>
                            <small>{subjectRow.level_name}</small>
                          </span>
                        </td>
                        <td>{subjectRow.coefficient}</td>
                        <td>{subjectRow.school_year_name}</td>
                        <td>
                          <button type="button" className="tdp-icon-action" aria-label={`Actions pour ${subjectRow.subject_name}`}>
                            <Ellipsis aria-hidden="true" size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        )}

        {activeTab === 'evaluations' && (
          <article className="tdp-panel">
            <div className="tdp-eval-filters">
              <label>
                <span>Classe</span>
                <select defaultValue="all">
                  <option value="all">Toutes les classes</option>
                  {details.classes.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Matière</span>
                <select defaultValue="all">
                  <option value="all">Toutes les matières</option>
                  {details.subjects.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Période</span>
                <input type="text" value="Non disponible V1" readOnly />
              </label>
              <label>
                <span>Type d’évaluation</span>
                <input type="text" value="Non disponible V1" readOnly />
              </label>
              <button type="button" className="tdp-create-button" disabled>
                + Créer une évaluation
              </button>
            </div>

            <div className="tdp-panel__head tdp-panel__head--stacked">
              <div>
                <h3>Liste des évaluations</h3>
                <p className="tdp-panel__description">
                  Les colonnes non encore gérées par le backend sont indiquées par Non disponible V1.
                </p>
              </div>
            </div>

            <div className="tdp-table-wrap">
              <table className="tdp-table tdp-table--evaluations">
                <thead>
                  <tr>
                    <th>Titre de l’évaluation</th>
                    <th>Matière</th>
                    <th>Classe</th>
                    <th>Date</th>
                    <th>Coefficient</th>
                    <th>Note max</th>
                    <th>Élèves</th>
                    <th>Saisie</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluationRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="tdp-empty">Aucune matière liée pour préparer les évaluations.</td>
                    </tr>
                  ) : (
                    evaluationRows.map((row) => (
                      <tr key={row.id}>
                        <td>Non disponible V1</td>
                        <td>{row.subject_name}</td>
                        <td>{row.class_name}</td>
                        <td>Non disponible V1</td>
                        <td>Non disponible V1</td>
                        <td>Non disponible V1</td>
                        <td>Non disponible V1</td>
                        <td><span className="tdp-v1-badge">Non disponible V1</span></td>
                        <td>
                          <button type="button" className="tdp-icon-action" aria-label={`Actions pour ${row.subject_name}`}>
                            <Ellipsis aria-hidden="true" size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="tdp-eval-summary-grid">
              <section className="tdp-panel tdp-panel--nested">
                <h3>Récapitulatif par classe et matière</h3>
                <div className="tdp-table-wrap">
                  <table className="tdp-table">
                    <thead>
                      <tr>
                        <th>Classe</th>
                        <th>Matière</th>
                        <th>Moyenne générale</th>
                        <th>Moyenne la plus haute</th>
                        <th>Moyenne la plus basse</th>
                        <th>Élèves évalués</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluationRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="tdp-empty">Aucune donnée disponible.</td>
                        </tr>
                      ) : (
                        evaluationRows.map((row) => (
                          <tr key={`summary-${row.id}`}>
                            <td>{row.class_name}</td>
                            <td>{row.subject_name}</td>
                            <td>Non disponible V1</td>
                            <td>Non disponible V1</td>
                            <td>Non disponible V1</td>
                            <td>Non disponible V1</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="tdp-panel tdp-panel--nested">
                <h3>Synthèse des performances</h3>
                <div className="tdp-kpi-grid">
                  <article><span>Moyenne générale</span><strong>Non disponible V1</strong></article>
                  <article><span>Taux de réussite</span><strong>Non disponible V1</strong></article>
                  <article><span>Évaluations créées</span><strong>Non disponible V1</strong></article>
                  <article><span>Notes saisies</span><strong>Non disponible V1</strong></article>
                </div>
              </section>
            </div>
          </article>
        )}

        {assignModalOpen && (
          <div className="tdp-modal-backdrop" role="presentation">
            <section className="tdp-modal" role="dialog" aria-modal="true" aria-labelledby="tdp-assign-title">
              <header className="tdp-modal__header">
                <div>
                  <h3 id="tdp-assign-title">Affecter à une classe</h3>
                  <p>Sélectionnez une classe existante à réaffecter à cet enseignant.</p>
                </div>
                <button type="button" className="tdp-modal__close" onClick={closeAssignModal} aria-label="Fermer">
                  <X aria-hidden="true" size={16} />
                </button>
              </header>

              <div className="tdp-modal__body">
                {assignLoading ? (
                  <p>Chargement des classes…</p>
                ) : assignableClasses.length === 0 ? (
                  <p>Toutes les classes disponibles sont deja attribuees a cet enseignant ou aucune classe n'est disponible pour le moment.</p>
                ) : (
                  <label className="tdp-modal__field">
                    <span>Classe</span>
                    <select value={assignClassId} onChange={(event) => setAssignClassId(event.target.value)}>
                      <option value="">Choisir une classe</option>
                      {assignableClasses.map((schoolClass) => (
                        <option key={schoolClass.id} value={schoolClass.id}>
                          {schoolClass.level_name} {schoolClass.group_label} - {schoolClass.school_year_name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <footer className="tdp-modal__actions">
                <button type="button" className="tdp-modal__secondary" onClick={closeAssignModal} disabled={assignSaving}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="tdp-modal__primary"
                  onClick={confirmAssignClass}
                  disabled={!assignClassId || assignSaving || assignLoading}
                >
                  {assignSaving ? 'Affectation…' : 'Confirmer'}
                </button>
              </footer>
            </section>
          </div>
        )}

      </section>
    </main>
  )
}
