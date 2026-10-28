import { createContext, useContext } from 'react'

/** Contexte du portail parents : enfants du responsable et enfant consulté. */
export const GuardianChildContext = createContext({
  isGuardian: false,
  kids: [],
  childId: null,
  selectedChild: null,
  selectChild() {},
  isLoading: false,
  errorMessage: '',
  notice: '',
})

/** Enfant actuellement consulté par un responsable (nul pour les autres rôles). */
export function useGuardianChild() {
  return useContext(GuardianChildContext)
}
