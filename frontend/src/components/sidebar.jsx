import { BookOpen, CalendarDays, CalendarRange, ContactRound, GraduationCap, House, NotebookPen, ShieldCheck, Users, Presentation, X }
from 'lucide-react';
import logo from '../assets/logo-blaise-connect.png.png';
import LogoutButton from '../pages/logout_button.jsx';
import SidebarProfile from './sidebar_profile.jsx';

/**
 * Affiche la navigation principale de l'espace connecté.
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

  /**
   * Affiche la page choisie puis ferme le menu mobile.
   */
  function handleNavigation(event) {
    onNavigate(event.currentTarget.dataset.page);
    onClose();
  }

  return (
    <aside
      className={
        isOpen
          ? 'layout-sidebar layout-sidebar-open'
          : 'layout-sidebar'
      }
    >
      <div className="layout-sidebar-brand">
        <img
          className="layout-logo"
          src={logo}
          alt="Logo BlaiseConnect"
        />
        <button
          className="layout-sidebar-close"
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu"
        >
          <X aria-hidden="true" size={22} />
        </button>
      </div>

      <nav
        className="layout-navigation"
        aria-label="Navigation principale"
      >
        {/* Tableau de bord */}
        <button
          className={
            currentPage === 'home'
              ? 'layout-navigation-item layout-navigation-item-active'
              : 'layout-navigation-item'
          }
          type="button"
          data-page="home"
          onClick={handleNavigation}
        >
          <House aria-hidden="true" size={20} />
          Tableau de bord
        </button>

        {/* Élèves */}
        {isStaff && (
          <button
            className={
              currentPage === 'students' || currentPage === 'student-details'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="students"
            onClick={handleNavigation}
          >
            <GraduationCap aria-hidden="true" size={20} />
            Élèves
          </button>
        )}

        {/* Gestion des comptes */}
        {account.role === 'ADMIN' && (
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
            onClick={handleNavigation}
          >
            <ContactRound aria-hidden="true" size={20} />
            Gestion des comptes
          </button>
        )}

        {/* Responsables légaux */}
        {account.role === 'ADMIN' && (
          <button
            className={
              currentPage === 'guardians' || currentPage === 'guardian-details'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="guardians"
            onClick={handleNavigation}
          >
            <Users aria-hidden="true" size={20} />
            Responsables légaux
          </button>
        )}

        {/* Emploi du temps */}
        {account.role === 'ADMIN' && (
          <button
            className={
              currentPage === 'timetables'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="timetables"
            onClick={handleNavigation}
          >
            <CalendarDays aria-hidden="true" size={20} />
            Emploi du temps
          </button>
        )}

        {/* Années scolaires */}
        {account.role === 'ADMIN' && (
          <button
            className={
              currentPage === 'school-years'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="school-years"
            onClick={handleNavigation}
          >
            <CalendarRange aria-hidden="true" size={20} />
            Années scolaires
          </button>
        )}

        {/* Classes */}
        {isStaff && (
          <button
            className={
              currentPage === 'school-classes'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="school-classes"
            onClick={handleNavigation}
          >
            <Users aria-hidden="true" size={20} />
            Classes
          </button>
        )}

        {/* Enseignants */}
        {account.role === 'ADMIN' && (
          <button
            className={
              currentPage === 'teachers'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="teachers"
            onClick={handleNavigation}
          >
            <Presentation aria-hidden="true" size={20} />
            Enseignants
          </button>
        )}

        {/* Administrateurs */}
        {account.role === 'ADMIN' && (
          <button
            className={
              currentPage === 'administrators' || currentPage === 'administrator-details'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="administrators"
            onClick={handleNavigation}
          >
            <ShieldCheck aria-hidden="true" size={20} />
            Administrateurs
          </button>
        )}

        {/* Matières */}
        {isStaff && (
          <button
            className={
              currentPage === 'subjects' || currentPage === 'subject-details'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="subjects"
            onClick={handleNavigation}
          >
            <BookOpen aria-hidden="true" size={20} />
            Matières
          </button>
        )}

        {/* Notes */}
        {isStaff && (
          <button
            className={
              currentPage === 'notes'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="notes"
            onClick={handleNavigation}
          >
            <NotebookPen aria-hidden="true" size={20} />
            Notes
          </button>
        )}

        {/* Mes notes (pour les élèves) */}
        {isStudent && (
          <button
            className={
              currentPage === 'student-grades'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="student-grades"
            onClick={handleNavigation}
          >
            <NotebookPen aria-hidden="true" size={20} />
            Mes notes
          </button>
        )}

        {/* Mon emploi du temps (pour les élèves) */}
        {isStudent && (
          <button
            className={
              currentPage === 'student-timetable'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="student-timetable"
            onClick={handleNavigation}
          >
            <CalendarDays aria-hidden="true" size={20} />
            Mon emploi du temps
          </button>
        )}

        {/* Mon emploi du temps (pour les enseignants) */}
        {account.role === 'TEACHER' && (
          <button
            className={
              currentPage === 'teacher-timetable'
                ? 'layout-navigation-item layout-navigation-item-active'
                : 'layout-navigation-item'
            }
            type="button"
            data-page="teacher-timetable"
            onClick={handleNavigation}
          >
            <CalendarDays aria-hidden="true" size={20} />
            Mon emploi du temps
          </button>
        )}
      </nav>

      <div className="sidebar-bottom-card">
        <SidebarProfile account={account} />
        <LogoutButton onLogoutSuccess={onLogoutSuccess} />
      </div>
    </aside>
  );
}