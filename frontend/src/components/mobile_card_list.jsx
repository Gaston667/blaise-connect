/**
 * Liste de cartes affichée sur téléphone à la place d'un tableau.
 * Chaque page décrit le contenu d'une carte avec de petites fonctions ;
 * le tableau d'origine est masqué par le CSS (classe `mcards-hide`) dès que la liste contient des lignes.
 */
export default function MobileCardList({ items, getKey, onOpen, lead, title, subtitle, meta, badge, label }) {
  if (!items || items.length === 0) return null

  // Sans action d'ouverture, la carte est simplement informative.
  const Wrapper = onOpen ? 'button' : 'div'

  return (
    <ul className="mcards" aria-label={label}>
      {items.map(function renderItem(item) {
        return (
          <li key={getKey(item)}>
            <Wrapper className="mcard" {...(onOpen ? { type: 'button', onClick: () => onOpen(item) } : {})}>
              {lead ? <span className="mcard__lead">{lead(item)}</span> : null}
              <span className="mcard__info">
                <strong>{title(item)}</strong>
                {subtitle ? <span>{subtitle(item)}</span> : null}
                {meta ? <small>{meta(item)}</small> : null}
              </span>
              {badge ? <span className="mcard__badge">{badge(item)}</span> : null}
            </Wrapper>
          </li>
        )
      })}
    </ul>
  )
}
