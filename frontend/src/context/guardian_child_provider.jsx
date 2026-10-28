import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getGuardianChildren } from '../services/guardian_portal_service.js'
import { GuardianChildContext, useGuardianChild } from './guardian_child_context.js'

const STORAGE_PREFIX = 'bc_selected_child_'

function readStoredChildId(accountId) {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + accountId)
  } catch {
    return null
  }
}

function storeChildId(accountId, childId) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + accountId, childId)
  } catch {
    // Le stockage local est facultatif : le choix reste valable pour la session.
  }
}

/**
 * Charge les enfants d'un responsable légal et mémorise celui qui est consulté.
 * Pour les autres rôles, le contexte reste neutre (`childId` nul).
 */
export function GuardianChildProvider({ account, children }) {
  const isGuardian = account?.role === 'GUARDIAN'
  const accountId = account?.id
  const [kids, setKids] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [isLoading, setIsLoading] = useState(isGuardian)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef(null)

  useEffect(function loadChildrenEffect() {
    if (!isGuardian) return undefined

    let cancelled = false
    async function load() {
      setIsLoading(true)
      setErrorMessage('')
      try {
        const loadedKids = await getGuardianChildren()
        if (cancelled) return
        setKids(loadedKids)
        const stored = readStoredChildId(accountId)
        const initial = loadedKids.find((kid) => kid.id === stored) ?? loadedKids[0] ?? null
        setSelectedId(initial ? initial.id : null)
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return function cancelLoad() { cancelled = true }
  }, [isGuardian, accountId])

  const selectChild = useCallback(function selectChild(childId) {
    const child = kids.find((kid) => kid.id === childId)
    setSelectedId(childId)
    if (accountId) storeChildId(accountId, childId)
    if (child) {
      setNotice(`Vous consultez à présent les informations de ${child.first_name} ${child.last_name}.`)
      window.clearTimeout(noticeTimer.current)
      noticeTimer.current = window.setTimeout(() => setNotice(''), 4000)
    }
  }, [accountId, kids])

  useEffect(function clearNoticeTimerEffect() {
    return function clearTimer() { window.clearTimeout(noticeTimer.current) }
  }, [])

  const value = useMemo(function buildValue() {
    const selectedChild = kids.find((kid) => kid.id === selectedId) ?? null
    return {
      isGuardian,
      kids,
      childId: selectedChild ? selectedChild.id : null,
      selectedChild,
      selectChild,
      isLoading,
      errorMessage,
      notice,
    }
  }, [isGuardian, kids, selectedId, selectChild, isLoading, errorMessage, notice])

  return <GuardianChildContext.Provider value={value}>{children}</GuardianChildContext.Provider>
}

/**
 * Affiche le contenu d'une page seulement quand l'enfant consulté est connu.
 * Le contenu est recréé à chaque changement d'enfant, donc toutes les pages
 * rechargent leurs données sans logique supplémentaire.
 */
export function GuardianGate({ children }) {
  const { isGuardian, isLoading, errorMessage, selectedChild } = useGuardianChild()

  if (!isGuardian) return children
  if (isLoading) return <main className="gch-state"><p>Chargement de vos enfants…</p></main>
  if (errorMessage) return <main className="gch-state"><p className="gch-state__error" role="alert">{errorMessage}</p></main>
  if (!selectedChild) {
    return (
      <main className="gch-state">
        <h1>Aucun enfant rattaché</h1>
        <p>Votre compte n'est lié à aucun élève pour le moment. Contactez l'établissement pour faire rattacher vos enfants.</p>
      </main>
    )
  }
  return <Fragment key={selectedChild.id}>{children}</Fragment>
}
