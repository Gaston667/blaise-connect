/**
 * Chemin d'API des données d'un élève.
 *
 * Un élève lit ses propres données via `/api/students/me`. Un responsable
 * légal lit celles d'un enfant rattaché via `/api/guardian/children/{id}` ;
 * le serveur vérifie le rattachement à chaque appel.
 */
export function studentApiPath(childId, suffix = '') {
  return childId
    ? `/api/guardian/children/${childId}${suffix}`
    : `/api/students/me${suffix}`
}
