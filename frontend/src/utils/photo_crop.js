/** Zoom maximal autorisé pour le recadrage d'une photo de profil. */
export const MAX_PHOTO_ZOOM = 4

/** Cadrage initial : image entière centrée, sans zoom. */
export const DEFAULT_PHOTO_CROP = { zoom: 1, centerX: 0.5, centerY: 0.5 }

/**
 * Ramène le cadrage dans des valeurs valides : le carré recadré reste toujours
 * entièrement contenu dans l'image. `centerX`/`centerY` sont les coordonnées
 * (0 à 1) du centre du carré dans l'image.
 */
export function clampPhotoCrop(crop, imageWidth, imageHeight) {
  const zoom = Math.min(MAX_PHOTO_ZOOM, Math.max(1, crop.zoom))
  const side = Math.min(imageWidth, imageHeight) / zoom
  const halfX = side / 2 / imageWidth
  const halfY = side / 2 / imageHeight
  return {
    zoom,
    centerX: Math.min(1 - halfX, Math.max(halfX, crop.centerX)),
    centerY: Math.min(1 - halfY, Math.max(halfY, crop.centerY)),
  }
}

/** Charge une image à partir d'un fichier et retourne l'élément `Image`. */
export function loadImageFromFile(file) {
  const imageUrl = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(imageUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      reject(new Error('Impossible de charger la photo sélectionnée.'))
    }
    image.src = imageUrl
  })
}

/** Produit le fichier carré (512 × 512) correspondant au cadrage choisi. */
export async function cropPhotoFile(sourcePhoto, crop) {
  const image = await loadImageFromFile(sourcePhoto)
  const { zoom, centerX, centerY } = clampPhotoCrop(crop, image.width, image.height)
  const side = Math.min(image.width, image.height) / zoom
  const sourceX = centerX * image.width - side / 2
  const sourceY = centerY * image.height - side / 2

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Impossible de préparer la photo sélectionnée.')
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Impossible de préparer la photo sélectionnée.'))
        return
      }
      resolve(result)
    }, sourcePhoto.type || 'image/jpeg', 0.92)
  })

  const extension = sourcePhoto.type === 'image/png'
    ? 'png'
    : sourcePhoto.type === 'image/webp'
      ? 'webp'
      : 'jpg'
  return new File([blob], `profile-photo.${extension}`, { type: blob.type || sourcePhoto.type })
}
