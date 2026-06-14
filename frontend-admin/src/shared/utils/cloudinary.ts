/**
 * Helpers de Cloudinary (frontend-admin).
 *
 * cldThumb  → inserta transformaciones on-the-fly (f_auto, q_auto, c_fill, w_, h_)
 *             en la URL del CDN sin tocar la imagen original.
 * publicIdFromUrl → deriva el public_id a partir de una secure_url, necesario
 *             para borrar la imagen vía DELETE /uploads/imagen/{public_id}.
 */
export function cldThumb(
  url: string | undefined | null,
  transform = 'f_auto,q_auto,c_fill,w_200,h_200',
): string {
  if (!url || !url.includes('/upload/')) return url ?? ''
  if (url.includes(`/upload/${transform}`)) return url
  return url.replace('/upload/', `/upload/${transform}/`)
}

/**
 * Extrae el public_id de una secure_url de Cloudinary.
 * Ej: https://res.cloudinary.com/demo/image/upload/v1699/foodstore/productos/abc.jpg
 *  →  foodstore/productos/abc
 */
export function publicIdFromUrl(url: string): string | null {
  const after = url.split('/upload/')[1]
  if (!after) return null
  let path = after.split('?')[0].split('#')[0]
  // quitar el segmento de versión (vNNN/) y cualquier transformación previa
  const idx = path.search(/v\d+\//)
  if (idx !== -1) path = path.slice(idx).replace(/^v\d+\//, '')
  // quitar la extensión del archivo
  path = path.replace(/\.[^/.]+$/, '')
  return path || null
}
