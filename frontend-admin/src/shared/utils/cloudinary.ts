export function cldThumb(
  url: string | undefined | null,
  transform = 'f_auto,q_auto,c_fill,w_200,h_200',
): string {
  if (!url || !url.includes('/upload/')) return url ?? ''
  if (url.includes(`/upload/${transform}`)) return url
  return url.replace('/upload/', `/upload/${transform}/`)
}

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
