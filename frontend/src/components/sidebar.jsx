import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  ContactRound,
  GraduationCap,
  House,
  NotebookPen,
  ShieldCheck,
  Users,
  Presentation,
  X,
} from 'lucide-react';
import logo from '../assets/logo-blaise-connect.png.png';
import LogoutButton from '../pages/logout_button.jsx';
import SidebarProfile from './sidebar_profile.jsx';

/**
 * Composant principal de la barre latérale.
 * Gère la navigation et l'affichage conditionnel des éléments selon le rôle.
 */
export default function Sidebar({
  account,
  currentPage,
  isOpen,
  onClose,
  onNavigate,
  onLogoutSuccess,
}) {
  const isStaff = account.role === 'ADMIN' || account.role === 'TEACHER';
  const isStudent = account.role === 'STUDENT';
  const isTeacher = account.role === 'TEACHER';
  const isAdmin = account.role === 'ADMIN';

  /**
   * Gère la navigation vers une page et ferme le menu mobile.
   */
  function handleNavigation(page) {
    onNavigate(page);
    onClose();
  }

  return (
    <aside className={isOpen ? 'layout-sidebar layout-sidebar-open' : 'layout-sidebar'}>
      {renderBrand(onClose)}
      <nav className="layout-navigation" aria-label="Navigation principale">
        {renderCommonNavigation(currentPage, handleNavigation)}
        {isStaff && renderStaffNavigation(currentPage, handleNavigation)}
        {isAdmin && renderAdminNavigation(currentPage, handleNavigation)}
        {isStudent && renderStudentNavigation(currentPage, handleNavigation)}
        {isTeacher && renderTeacherNavigation(currentPage, handleNavigation)}
      </nav>
      <div className="sidebar-bottom-card">
        <SidebarProfile account={account} />
        {renderLogoutButton(onLogoutSuccess)}
      </div>
    </aside>
  );
}

/**
 * Rendu du logo et du bouton de fermeture.
 */
function renderBrand(onClose) {
  return (
    <div className="layout-sidebar-brand">
      <img className="layout-logo" src={logo} alt="Logo BlaiseConnect" />
      <button
        className="layout-sidebar-close"
        type="button"
        onClick={onClose}
        aria-label="Fermer le menu"
      >
        <X aria-hidden="true" size={22} />
      </button>
    </div>
  );
}

/**
 * Navigation commune à tous les utilisateurs (Tableau de bord).
 */
function renderCommonNavigation(currentPage, handleNavigation) {
  return (
    <button
      className={
        currentPage === 'home'
          ? 'layout-navigation-item layout-navigation-item-active'
          : 'layout-navigation-item'
      }
      type="button"
      data-page="home"
      onClick={() => handleNavigation('home')}
    >
      <House aria-hidden="true" size={20} />
      Tableau de bord
    </button>
  );
}

/**
 * Navigation commune au personnel (ADMIN + TEACHER) : élèves, classes, matières, notes, emploi du temps général.
 */
function renderStaffNavigation(currentPage, handleNavigation) {
  return (
    <>
      <button
        className={
          currentPage === 'students' || currentPage === 'student-details'
            ? 'layout-navigation-item layout-navigation-item-active'
            : 'layout-navigation-item'
        }
        type="button"
        data-page="students"
        onClick={() => handleNavigation('students')}
      >
        <GraduationCap aria-hidden="true" size={20} />
        Élèves
      </button>

      <button
        className={
          currentPage === 'school-classes'
            ? 'layout-navigation-item layout-navigation-item-active'
            : 'layout-navigation-item'
        }
        type="button"
        data-page="school-classes"
        onClick={() => handleNavigation('school-classes')}
      >
        <Users aria-hidden="true" size={20} />
        Classes
      </button>

      <button
        className={
          currentPage === 'subjects' || currentPage === 'subject-details'
            ? 'layout-navigation-item layout-navigation-item-active'
            : 'layout-navigation-item'
        }
        type="button"
        data-page="subjects"
        onClick={() => handleNavigation('subjects')}
      >
        <BookOpen aria-hidden="true" size={20} />
        Matières
      </button>

      <button
        className={
          currentPage === 'notes'
            ? 'layout-navigation-item layout-navigation-item-active'
            : 'layout-navigation-item'
        }
        type="button"
        data-page="notes"
        onClick={() => handleNavigation('notes')}
      >
        <NotebookPen aria-hidden="true" size={20} />
        Notes
      </button>
    </>
  );
}

/**
 * Navigation spécifique aux administrateurs.
 */
function renderAdminNavigation(currentPage, handleNavigation) {
  return (
    <>
      <button
        className={
          currentPage === 'accounts' ||
          currentPage === 'account-details' ||
          currentPage === 'account-new'
            ? 'layout-navigation-item layout-navigation-item-active'
            : 'layout-navigation-item'
        }
        type="button"
        data-page="accounts"
        onClick={() => handleNavigation('accounts')}
      >
        <ContactRound aria-hidden="true" size={20} />
        Gestion des comptes
      </button>

      <button
        className={
          currentPage === 'guardians' || currentPage === 'guardian-details'
            ? 'layout-navigation-item layout-navigation-item-active'
            : 'layout-navigation-item'
        }
        type="button"
        data-page="guardians"
        onClick={() => handleNavigation('guardians')}
      >
        <Users aria-hidden="true" size={20} />
        Responsables légaux
      </button>

      <button
        className={
          currentPage === 'timetables'
            ? 'layout-navigation-item layout-navigation-item-active'
            : 'layout-navigation-item'
        }
        type="button"
        data-page="timetables"
        onClick={() => handleNavigation('timetables')}
      >
        <CalendarDays aria-hidden="true" size={20} />
        Emploi du temps
      </button>

      <button
        className={
          currentPage === 'school-years'
            ? 'layout-navigation-item layout-navigation-item-active'
            : 'layout-navigation-item'
        }
        type="button"
        data-page="school-years"
        onClick={() => handleNavigation('school-years')}
      >
        <CalendarRange aria-hidden="true" size={20} />
        Années scolaires
      </button>

      <button
        className={
          currentPage === 'teachers'
            ? 'layout-navigation-item layout-navigation-item-active'
            : 'layout-navigation-item'
        }
        type="button"
        data-page="teachers"
        onClick={() => handleNavigation('teachers')}
      >
        <Presentation aria-hidden="true" size={20} />
        Enseignants
      </button>

      <button
        className={
          currentPage === 'administrators' || currentPage === 'administrator-details'
            ? 'layout-navigation-item layout-navigation-item-active'
            : 'layout-navigation-item'
        }
        type="button"
        data-page="administrators"
        onClick={() => handleNavigation('administrators')}
      >
        <ShieldCheck aria-hidden="true" size={20} />
        Administrateurs
      </button>
    </>
  );
}

/**
 * Navigation spécifique aux élèves.
 */
function renderStudentNavigation(currentPage, handleNavigation) {
  return (
    <>
      <button
        className={
          currentPage === 'student-grades'
            ? 'layout-navigation-item layout-navigation-item-active'
            : 'layout-navigation-item'
        }
        type="button"
        data-page="student-grades"
        onClick={() => handleNavigation('student-grades')}
      >
        <NotebookPen aria-hidden="true" size={20} />
        Mes notes
      </button>

      <button
        className={
          currentPage === 'student-timetable'
            ? 'layout-navigation-item layout-navigation-item-active'
            : 'layout-navigation-item'
        }
        type="button"
        data-page="student-timetable"
        onClick={() => handleNavigation('student-timetable')}
      >
        <CalendarDays aria-hidden="true" size={20} />
        Mon emploi du temps
      </button>
    </>
  );
}

/**
 * Navigation spécifique aux enseignants.
 */
function renderTeacherNavigation(currentPage, handleNavigation) {
  return (
    <button
      className={
        currentPage === 'teacher-timetable'
          ? 'layout-navigation-item layout-navigation-item-active'
          : 'layout-navigation-item'
      }
      type="button"
      data-page="teacher-timetable"
      onClick={() => handleNavigation('teacher-timetable')}
    >
      <CalendarDays aria-hidden="true" size={20} />
      Mon emploi du temps
    </button>
  );
}

/**
 * Bouton de déconnexion.
 */
function renderLogoutButton(onLogoutSuccess) {
  return <LogoutButton onLogoutSuccess={onLogoutSuccess} />;
}