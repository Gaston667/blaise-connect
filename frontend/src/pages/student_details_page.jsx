import { useEffect, useState } from "react";
import {
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderOpen,
  GraduationCap,
  Info,
  Pencil,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  getStudent,
  updateStudent,
  archiveStudent,
  deactivateStudent,
  reactivateStudent,
} from "../services/students_service.js";
import "../styles/student_details_page.css";
import AddGuardianModal from "../components/add_guardian_modal.jsx";
const RELATIONSHIP_ICON_CLASS = {
  PERE: "sdp-guardian-icon--pere",
  MERE: "sdp-guardian-icon--mere",
  TUTEUR: "sdp-guardian-icon--tuteur",
  AUTRE: "sdp-guardian-icon--autre",
};
const STATUS_LABEL = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  ARCHIVED: "Archivé",
};
const STATUS_CLASS = {
  ACTIVE: "sdp-badge--active",
  INACTIVE: "sdp-badge--inactive",
  ARCHIVED: "sdp-badge--archived",
};

function StatusBadge({ status }) {
  return (
    <span className={`sdp-badge ${STATUS_CLASS[status] ?? ""}`}>
      <span className="sdp-badge__dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function initials(first, last) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

function genderLabel(gender) {
  if (gender === "MALE" || gender === "M") return "Masculin";
  if (gender === "FEMALE" || gender === "F") return "Féminin";
  return "—";
}

function formatDate(dateValue) {
  if (!dateValue) return "—";
  const value = String(dateValue);
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR").format(date);
}

export default function StudentDetailsPage({ student, onNavigate }) {
  const [details, setDetails] = useState(student);
  const [classes, setClasses] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [showAddGuardianModal, setShowAddGuardianModal] = useState(false)

  function handleHomeNavigation() {
    onNavigate?.("home");
  }

  function handleStudentsNavigation() {
    onNavigate?.("students");
  }

  function handlePhotoError() {
    setPhotoFailed(true);
  }

  function showPersonalInformation() {
    setActiveTab("personal");
  }

  function showSchoolInformation() {
    setActiveTab("school");
  }

  function showGuardians() {
    setActiveTab("guardians");
  }

  function showDocuments() {
    setActiveTab("documents");
  }

  function handleGuardianNavigation(event) {
    const guardianId = event.currentTarget.dataset.guardianId;
    const guardian = (details.guardians ?? []).find(
      (item) => String(item.id) === guardianId,
    );

    if (guardian) {
      onNavigate?.("guardian-details", guardian);
    }
  }

  function handleGuardianKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleGuardianNavigation(event);
    }
  }

  useEffect(() => {
    setPhotoFailed(false);
    load();
    // Recharge uniquement lorsque l'élève sélectionné change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  async function load() {
    if (!student?.id) return;
    try {
      const [full, yearsRes, classesRes] = await Promise.all([
        getStudent(student.id),
        import("../services/school_year_service.js").then((m) =>
          m.getSchoolYears(),
        ),
        import("../services/school_class_service.js").then((m) =>
          m.getSchoolClasses(),
        ),
      ]);
      setDetails(full);
      setSchoolYears(yearsRes);
      setClasses(classesRes);
      resetForm(full);
    } catch (e) {
      console.error(e);
    }
  }

  function resetForm(d) {
    setForm({
      first_name: d.first_name ?? "",
      last_name: d.last_name ?? "",
      gender: d.gender ?? "",
      birth_date: d.birth_date ?? "",
      birth_place: d.birth_place ?? "",
      nationality: d.nationality ?? "",
      phone: d.phone ?? "",
      email: d.email ?? "",
      address: d.address ?? "",
    });
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function className(id) {
    return classes.find((c) => c.id === id)?.name ?? "—";
  }
  function yearName(id) {
    return schoolYears.find((y) => y.id === id)?.name ?? "—";
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === "" ? null : v]),
      );
      const updated = await updateStudent(details.id, payload);
      setDetails(updated);
      setEditing(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(actionFn) {
    setMenuOpen(false);
    setError("");
    try {
      const updated = await actionFn(details.id);
      setDetails(updated);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!details) return <div className="sdp-main">Élève non trouvé.</div>;

  return (
    <main className="sdp-main">
      <h1 className="sdp-page-title">Dossier de l’élève</h1>
      <nav className="sdp-breadcrumb" aria-label="Fil d’Ariane">
        <button type="button" onClick={handleHomeNavigation}>
          Accueil
        </button>
        <ChevronRight aria-hidden="true" size={14} />
        <button type="button" onClick={handleStudentsNavigation}>
          Élèves
        </button>
        <ChevronRight aria-hidden="true" size={14} />
        <span className="sdp-breadcrumb-current">Détail de l’élève</span>
      </nav>

      <div className="sdp-header">
        <div className="sdp-header__identity">
          <span className="sdp-avatar">
            {details.photo_path && !photoFailed ? (
              <img
                src={details.photo_path}
                alt={`Photo de ${details.first_name} ${details.last_name}`}
                onError={handlePhotoError}
              />
            ) : (
              initials(details.first_name, details.last_name)
            )}
          </span>
          <div>
            <h1>
              {details.first_name} {details.last_name}
            </h1>
            <div className="sdp-header__badges">
              <StatusBadge status={details.status} />
            </div>
            <dl className="sdp-summary">
              <div>
                <dt>Matricule</dt>
                <dd>{details.registration_number ?? "—"}</dd>
              </div>
              <div>
                <dt>Sexe</dt>
                <dd>{genderLabel(details.gender)}</dd>
              </div>
              <div>
                <dt>Dernière modification</dt>
                <dd>{formatDate(details.updated_at)}</dd>
              </div>
              <div>
                <dt>Classe actuelle</dt>
                <dd>{className(details.class_id)}</dd>
              </div>
              <div>
                <dt>Année scolaire</dt>
                <dd>{yearName(details.school_year_id)}</dd>
              </div>
              <div>
                <dt>Date d’inscription</dt>
                <dd>{formatDate(details.admission_date)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="sdp-header__actions">
          <div className="sdp-menu-wrapper">
            <button
              type="button"
              className="sdp-btn-primary"
              onClick={() => setMenuOpen((v) => !v)}
            >
              Actions
              <ChevronDown aria-hidden="true" size={16} />
            </button>
            {menuOpen && (
              <div className="sdp-menu">
                <button
                  onClick={() => handleAction(archiveStudent)}
                  disabled={details.status === "ARCHIVED"}
                >
                  🗄 Archiver l'élève
                </button>
                <button
                  onClick={() => handleAction(deactivateStudent)}
                  disabled={details.status !== "ACTIVE"}
                >
                  ⏸ Désactiver l'élève
                </button>
                <button
                  onClick={() => handleAction(reactivateStudent)}
                  disabled={details.status === "ACTIVE"}
                >
                  ↻ Réactiver l'élève
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="sdp-error">{error}</p>}

      <div className="sdp-body">
        <section className="sdp-content">
          <nav className="sdp-tabs" aria-label="Rubriques du dossier élève">
            <button
              type="button"
              className={
                activeTab === "personal" ? "sdp-tab sdp-tab--active" : "sdp-tab"
              }
              onClick={showPersonalInformation}
            >
              <UserRound aria-hidden="true" size={17} />
              Informations personnelles
            </button>
            <button
              type="button"
              className={
                activeTab === "school" ? "sdp-tab sdp-tab--active" : "sdp-tab"
              }
              onClick={showSchoolInformation}
            >
              <GraduationCap aria-hidden="true" size={18} />
              Scolarité
            </button>
            <button
              type="button"
              className={
                activeTab === "guardians"
                  ? "sdp-tab sdp-tab--active"
                  : "sdp-tab"
              }
              onClick={showGuardians}
            >
              <UsersRound aria-hidden="true" size={18} />
              Responsables légaux
            </button>
            <button
              type="button"
              className={
                activeTab === "documents"
                  ? "sdp-tab sdp-tab--active"
                  : "sdp-tab"
              }
              onClick={showDocuments}
            >
              <FolderOpen aria-hidden="true" size={18} />
              Documents
            </button>
          </nav>

          {activeTab === "personal" &&
            (editing ? (
              <form onSubmit={handleSave} className="sdp-form">
                <h3>Informations personnelles</h3>
                <div className="sdp-row">
                  <label>
                    Nom *
                    <input
                      required
                      value={form.last_name}
                      onChange={(e) => update("last_name", e.target.value)}
                    />
                  </label>
                  <label>
                    Prénom *
                    <input
                      required
                      value={form.first_name}
                      onChange={(e) => update("first_name", e.target.value)}
                    />
                  </label>
                  <label>
                    Sexe
                    <select
                      value={form.gender}
                      onChange={(e) => update("gender", e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="FEMALE">Féminin</option>
                      <option value="MALE">Masculin</option>
                    </select>
                  </label>
                </div>
                <div className="sdp-row">
                  <label>
                    Date de naissance
                    <input
                      type="date"
                      value={form.birth_date ?? ""}
                      onChange={(e) => update("birth_date", e.target.value)}
                    />
                  </label>
                  <label>
                    Lieu de naissance
                    <input
                      value={form.birth_place}
                      onChange={(e) => update("birth_place", e.target.value)}
                    />
                  </label>
                  <label>
                    Nationalité
                    <input
                      value={form.nationality}
                      onChange={(e) => update("nationality", e.target.value)}
                    />
                  </label>
                </div>
                <div className="sdp-row">
                  <label>
                    Téléphone
                    <input
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                    />
                  </label>
                </div>
                <label className="sdp-full">
                  Adresse
                  <input
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                  />
                </label>

                <div className="sdp-form-actions">
                  <button
                    type="button"
                    className="sdp-btn-outline"
                    onClick={() => {
                      setEditing(false);
                      resetForm(details);
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="sdp-btn-primary"
                    disabled={saving}
                  >
                    {saving
                      ? "Enregistrement…"
                      : "Enregistrer les modifications"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="sdp-view">
                <div className="sdp-section-heading">
                  <h2>Informations personnelles</h2>
                  <button
                    type="button"
                    className="sdp-btn-outline"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil aria-hidden="true" size={16} />
                    Modifier
                  </button>
                </div>
                <div className="sdp-personal-grid">
                  <section>
                    <h3>Informations d’identité</h3>
                    <dl>
                      <div>
                        <dt>Nom</dt>
                        <dd>{details.last_name}</dd>
                      </div>
                      <div>
                        <dt>Prénom</dt>
                        <dd>{details.first_name}</dd>
                      </div>
                      <div>
                        <dt>Sexe</dt>
                        <dd>{genderLabel(details.gender)}</dd>
                      </div>
                      <div>
                        <dt>Date de naissance</dt>
                        <dd>{formatDate(details.birth_date)}</dd>
                      </div>
                      <div>
                        <dt>Lieu de naissance</dt>
                        <dd>{details.birth_place ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Nationalité</dt>
                        <dd>{details.nationality ?? "—"}</dd>
                      </div>
                    </dl>
                  </section>

                  <section>
                    <h3>Informations de contact</h3>
                    <dl>
                      <div>
                        <dt>Adresse</dt>
                        <dd>{details.address ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Téléphone</dt>
                        <dd>{details.phone ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Email</dt>
                        <dd>{details.email ?? "—"}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              </div>
            ))}

          {activeTab === "school" && (
            <div className="sdp-school">
              <h2>
                Année scolaire en cours : {yearName(details.school_year_id)}
              </h2>

              <div className="sdp-school-stats">
                <article>
                  <UserRound aria-hidden="true" size={22} />
                  <div>
                    <span>Absences</span>
                    <strong>—</strong>
                  </div>
                </article>
                <article>
                  <Clock3 aria-hidden="true" size={22} />
                  <div>
                    <span>Retards</span>
                    <strong>—</strong>
                  </div>
                </article>
                <article>
                  <ClipboardCheck aria-hidden="true" size={22} />
                  <div>
                    <span>Évaluations notées</span>
                    <strong>—</strong>
                  </div>
                </article>
                <article>
                  <ChartNoAxesColumnIncreasing aria-hidden="true" size={22} />
                  <div>
                    <span>Moyenne générale</span>
                    <strong>— /20</strong>
                  </div>
                </article>
              </div>

              <div className="sdp-school-tables">
                <section>
                  <h3>Notes de l’année en cours</h3>
                  <p className="sdp-placeholder">
                    Les notes seront affichées lorsque cette fonctionnalité sera
                    disponible.
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
                          <td>{yearName(details.school_year_id)}</td>
                          <td>{className(details.class_id)}</td>
                          <td>
                            <span className="sdp-school-status">En cours</span>
                          </td>
                          <td>—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === "guardians" && (
            <div className="sdp-guardians">
              <div className="sdp-guardians-header">
                <div>
                  <h2>Responsables légaux</h2>
                  <p>Les personnes responsables de cet élève.</p>
                </div>
                <button
                  type="button"
                  className="sdp-btn-primary"
                  onClick={() => setShowAddGuardianModal(true)}
                >
                  + Ajouter un responsable
                </button>
              </div>

              {(details.guardians ?? []).length === 0 ? (
                <p className="sdp-placeholder">
                  Aucun responsable légal n’est actuellement associé à cet
                  élève.
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
                              <span
                                className={`sdp-guardian-icon ${RELATIONSHIP_ICON_CLASS[guardian.relationship] ?? ""}`}
                              >
                                <UserRound aria-hidden="true" size={14} />
                              </span>
                              {guardian.relationship_label ??
                                guardian.relationship_type ??
                                "—"}
                            </span>
                          </td>
                          <td>
                            {guardian.first_name} {guardian.last_name}
                          </td>
                          <td>{guardian.phone ?? "—"}</td>
                          <td>{guardian.email ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {showAddGuardianModal && (
                <AddGuardianModal
                  studentId={details.id}
                  onClose={() => setShowAddGuardianModal(false)}
                  onLinked={() => {
                    setShowAddGuardianModal(false);
                    load();
                  }}
                />
              )}
            </div>
          )}

          {activeTab === "documents" && (
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
                          <td>{document.category ?? "—"}</td>
                          <td>{formatDate(document.created_at)}</td>
                          <td>{document.size_label ?? "—"}</td>
                          <td>{document.uploaded_by_name ?? "—"}</td>
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
  );
}
