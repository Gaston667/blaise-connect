/**
 * Étapes de la visite guidée administrateur : parcourt les fonctionnalités
 * dans l'ordre logique de mise en place d'un établissement.
 */
export const ADMIN_TOUR_STEPS = [
  {
    page: 'home',
    target: '[data-page="home"]',
    title: 'Bienvenue sur BlaiseConnect',
    description: "Le tableau de bord résume les points qui demandent ton attention : absences en attente, notes incomplètes, demandes de correction, bulletins à valider.",
  },
  {
    page: 'school-years',
    target: '[data-page="school-years"]',
    title: '1. Années scolaires',
    description: "Tout part de là. Crée l'année scolaire en cours, configure les périodes (trimestres) avant de faire quoi que ce soit d'autre.",
  },
  {
    page: 'school-classes',
    target: '[data-page="school-classes"]',
    title: '2. Classes',
    description: "Crée les classes de l'année (6e A, 2de A…). C'est le point d'entrée pour tout ce qui concerne une classe : matières, élèves inscrits, notes.",
  },
  {
    page: 'subjects',
    target: '[data-page="subjects"]',
    title: '3. Matières',
    description: "Gère la liste des matières enseignées dans l'établissement, indépendamment des classes.",
  },
  {
    page: 'teachers',
    target: '[data-page="teachers"]',
    title: '4. Enseignants',
    description: "Crée les comptes enseignants et affecte-les à une matière dans une classe. C'est cette affectation qui autorise ensuite un prof à saisir des notes.",
  },
  {
    page: 'students',
    target: '[data-page="students"]',
    title: '5. Élèves',
    description: "Crée les comptes élèves et inscris-les dans leur classe. Un élève doit être inscrit pour apparaître dans les notes, l'emploi du temps et les absences.",
  },
  {
    page: 'guardians',
    target: '[data-page="guardians"]',
    title: '6. Responsables légaux',
    description: "Rattache un ou plusieurs responsables légaux à chaque élève, pour le suivi des absences et des bulletins.",
  },
  {
    page: 'timetables',
    target: '[data-page="timetables"]',
    title: '7. Emploi du temps',
    description: "Génère automatiquement ou construis manuellement l'emploi du temps de chaque classe, puis publie-le.",
  },
  {
    page: 'notes',
    target: '[data-page="notes"]',
    title: '8. Notes',
    description: "Consulte et supervise les évaluations saisies par les enseignants pour chaque classe et matière.",
  },
  {
    page: 'attendance',
    target: '[data-page="attendance"]',
    title: '9. Absences',
    description: "Suis les absences et retards signalés, et traite les justificatifs soumis par les familles.",
  },
  {
    page: 'report-cards',
    target: '[data-page="report-cards"]',
    title: '10. Bulletins',
    description: "Génère et valide les bulletins de fin de période à partir des notes saisies.",
  },
]
