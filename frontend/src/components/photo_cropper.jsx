import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

import { MAX_PHOTO_ZOOM, clampPhotoCrop } from '../utils/photo_crop.js'
import '../styles/photo_cropper.css'

/**
 * Cadre carré pour recentrer et zoomer une photo, comme sur une messagerie :
 * on glisse l'image pour la déplacer, on pince, on utilise la molette ou le
 * curseur pour zoomer. Le cercle indique la zone visible dans l'application.
 */
export default function PhotoCropper({ imageUrl, value, onChange }) {
  const frameRef = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const [naturalSize, setNaturalSize] = useState(null)
  const [frameSize, setFrameSize] = useState(240)

  useEffect(function trackFrameSize() {
    const frame = frameRef.current
    if (!frame) return undefined
    const observer = new ResizeObserver(() => setFrameSize(frame.clientWidth))
    observer.observe(frame)
    setFrameSize(frame.clientWidth)
    return () => observer.disconnect()
  }, [])

  function applyCrop(nextCrop) {
    if (!naturalSize) return
    onChange(clampPhotoCrop(nextCrop, naturalSize.width, naturalSize.height))
  }

  function handleImageLoad(event) {
    const { naturalWidth, naturalHeight } = event.currentTarget
    setNaturalSize({ width: naturalWidth, height: naturalHeight })
  }

  function handlePointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    gesture.current = { crop: value, distance: getPinchDistance() }
  }

  function getPinchDistance() {
    const points = [...pointers.current.values()]
    if (points.length < 2) return 0
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
  }

  function handlePointerMove(event) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous || !naturalSize) return
    const current = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, current)

    if (pointers.current.size >= 2) {
      const distance = getPinchDistance()
      if (gesture.current?.distance) {
        applyCrop({ ...value, zoom: value.zoom * (distance / gesture.current.distance) })
      }
      gesture.current = { crop: value, distance }
      return
    }

    // Une unité d'image = frameSize pixels écran / côté du carré recadré.
    const side = Math.min(naturalSize.width, naturalSize.height) / value.zoom
    const pixelsToSource = side / frameSize
    applyCrop({
      ...value,
      centerX: value.centerX - ((current.x - previous.x) * pixelsToSource) / naturalSize.width,
      centerY: value.centerY - ((current.y - previous.y) * pixelsToSource) / naturalSize.height,
    })
  }

  function handlePointerEnd(event) {
    pointers.current.delete(event.pointerId)
    gesture.current = null
  }

  function handleWheel(event) {
    event.preventDefault()
    applyCrop({ ...value, zoom: value.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08) })
  }

  function changeZoom(nextZoom) {
    applyCrop({ ...value, zoom: nextZoom })
  }

  // Position et taille de l'image affichée pour que le carré recadré remplisse le cadre.
  let imageStyle = { visibility: 'hidden' }
  if (naturalSize) {
    const side = Math.min(naturalSize.width, naturalSize.height) / value.zoom
    const scale = frameSize / side
    imageStyle = {
      width: naturalSize.width * scale,
      height: naturalSize.height * scale,
      left: -(value.centerX * naturalSize.width - side / 2) * scale,
      top: -(value.centerY * naturalSize.height - side / 2) * scale,
    }
  }

  return (
    <div className="photo-cropper">
      <div
        ref={frameRef}
        className="photo-cropper__frame"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={handleWheel}
        role="img"
        aria-label="Zone de recadrage de la photo : glissez pour déplacer, zoomez avec le curseur"
      >
        <img src={imageUrl} alt="" draggable="false" style={imageStyle} onLoad={handleImageLoad} />
        <span className="photo-cropper__mask" aria-hidden="true" />
      </div>
      <div className="photo-cropper__zoom">
        <button type="button" onClick={() => changeZoom(value.zoom / 1.2)} aria-label="Dézoomer">
          <Minus size={18} aria-hidden="true" />
        </button>
        <input
          type="range"
          min="1"
          max={MAX_PHOTO_ZOOM}
          step="0.01"
          value={value.zoom}
          onChange={(event) => changeZoom(Number(event.target.value))}
          aria-label="Zoom"
        />
        <button type="button" onClick={() => changeZoom(value.zoom * 1.2)} aria-label="Zoomer">
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="photo-cropper__hint">Glissez la photo pour la recentrer, zoomez avec le curseur ou en pinçant.</p>
    </div>
  )
}
