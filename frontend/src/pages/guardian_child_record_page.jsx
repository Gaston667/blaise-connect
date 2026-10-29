import { useEffect, useState } from 'react'
import { Download, Eye, FileText, FolderOpen } from 'lucide-react'

import { useGuardianChild } from '../context/guardian_child_context.js'
import {
  getChildDocumentFile,
  getChildDocuments,
  getChildRecord,
} from '../services/guardian_portal_service.js'
import '../styles/guardian_portal.css'

const GENDER_LABELS = { MALE: 'Masculin', FEMALE: 'Féminin' }

function formatDate(value) {
  if (!value) return null
  const date = value.length <= 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return new Intl.DateTimeFormat('fr-FR').format(date)
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`
}

function calculateAge(birthDate) {
  if (!birthDate) return null
  const birth = new Date(`${birthDate}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const hadBirthday = today.getMonth() > birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate())
  if (!hadBirthday) age -= 1
  return age >= 0 ? `${age} ans` : null
}

/** Dossier de l'enfant consulté : identité, scolarité et documents de son dossier (lecture seule). */
export default function GuardianChildRecordPage() {
  const { selectedChild } = useGuardianChild()
  const [record, setRecord] = useState(null)
  const [documents, setDocuments] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [busyDocumentId, setBusyDocumentId] = useState(null)

  useEffect(function loadRecordEffect() {
    let cancelled = false
    async function load() {
      setRecord(null)
      setDocuments(null)
      setErrorMessage('')
      try {
        const [recordData, documentsData] = await Promise.all([
          getChildRecord(selectedChild.id),
          getChildDocuments(selectedChild.id),
        ])
        if (cancelled) return
        setRecord(recordData)
        setDocuments(documentsData)
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message)
      }
    }
    load()
    return function cancelLoad() { cancelled = true }
  }, [selectedChild.id])

  async function openDocument(document, shouldDownload) {
    setBusyDocumentId(document.id)
    setErrorMessage('')
    try {
      const blob = await getChildDocumentFile(selectedChild.id, document.id)
      const url = URL.createObjectURL(blob)
      if (shouldDownload) {
        const link = window.document.createElement('a')
        link.href = url
        link.download = document.original_filename
        link.click()
      } else {
        window.open(url, '_blank', 'noopener')
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setBusyDocumentId(null)
    }
  }

  const facts = record ? [
    ['Date de naissance', [formatDate(record.birth_date), calculateAge(record.birth_date)].filter(Boolean).join(' · ')],
    ['Lieu de naissance', record.birth_place],
    ['Sexe', GENDER_LABELS[record.gender] ?? null],
    ['Nationalité', record.nationality],
    ['Adresse', record.address],
    ['Classe actuelle', record.class_name],
    ['Année scolaire', record.school_year_name],
    ['Inscrit en classe depuis le', formatDate(record.enrollment_start_date)],
    ['Entrée dans l’établissement', formatDate(record.admission_date)],
    ['Établissement précédent', record.previous_establishment],
    ['Niveau précédent', record.previous_level],
    ['CNED', record.is_enrolled_in_cned ? 'Inscrit' : 'Non'],
  ] : []

  return (
    <main className="gph-main">
      <header className="gph-page-header">
        <h1>Dossier de {selectedChild.first_name}</h1>
        <p>Informations et documents conservés par l’établissement.</p>
      </header>

      {errorMessage ? <p className="gph-error" role="alert">{errorMessage}</p> : null}
      {!errorMessage && record === null ? <p className="gph-muted">Chargement du dossier…</p> : null}

      {record ? (
        <section className="gph-section" aria-labelledby="gcr-identity-title">
          <h2 id="gcr-identity-title">Identité et scolarité</h2>
          <div className="gcr-card">
            <div className="gcr-identity">
              <span className="gcr-identity__avatar" aria-hidden="true">
                {`${record.first_name[0]}${record.last_name[0]}`.toUpperCase()}
              </span>
              <div>
                <strong>{record.first_name} {record.last_name}</strong>
                <span>{record.class_name ?? 'Aucune classe active'}</span>
              </div>
            </div>
            <dl className="gcr-facts">
              {facts.filter(([, value]) => value).map(function renderFact([label, value]) {
                return <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              })}
            </dl>
          </div>
        </section>
      ) : null}

      {documents ? (
        <section className="gph-section" aria-labelledby="gcr-documents-title">
          <h2 id="gcr-documents-title">Documents du dossier</h2>
          {documents.length === 0 ? (
            <div className="gph-empty">
              <FolderOpen aria-hidden="true" size={32} />
              <strong>Aucun document pour le moment</strong>
              <span>L’acte de naissance, les certificats et autres pièces apparaissent ici une fois ajoutés par l’établissement.</span>
            </div>
          ) : (
            <div className="gcr-docs">
              {documents.map(function renderDocument(document) {
                const isBusy = busyDocumentId === document.id
                return (
                  <article key={document.id} className="gcr-doc">
                    <span className="gcr-doc__icon"><FileText aria-hidden="true" size={20} /></span>
                    <div className="gcr-doc__info">
                      <strong title={document.title}>{document.title}</strong>
                      <small>{document.document_type_label} · ajouté le {formatDate(document.created_at)} · {formatSize(document.size_bytes)}</small>
                    </div>
                    <div className="gcr-doc__actions">
                      <button type="button" className="gcr-doc__button" onClick={() => openDocument(document, false)} disabled={isBusy} aria-label={`Ouvrir ${document.title}`}>
                        <Eye aria-hidden="true" size={16} /> Ouvrir
                      </button>
                      <button type="button" className="gcr-doc__button" onClick={() => openDocument(document, true)} disabled={isBusy} aria-label={`Télécharger ${document.title}`}>
                        <Download aria-hidden="true" size={16} />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          <p className="gcr-note">Pour modifier une information ou ajouter un document, contactez le secrétariat.</p>
        </section>
      ) : null}
    </main>
  )
}
