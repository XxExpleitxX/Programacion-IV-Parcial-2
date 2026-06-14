/**
 * Helpers de Cloudinary (frontend-store).
 *
 * cldThumb inserta transformaciones on-the-fly en la URL servida por el CDN:
 *   f_auto  → mejor formato según el navegador (WebP/AVIF)
 *   q_auto  → calidad automática (peso óptimo)
 *   c_fill  → recorta al recuadro manteniendo proporción
 *   w_/h_   → tamaño servido (no descarga la imagen full-res)
 * La imagen original en Cloudinary nunca se modifica.
 */
export function cldThumb(
  url: string | undefined | null,
  transform = 'f_auto,q_auto,c_fill,w_400,h_400',
): string {
  if (!url || !url.includes('/upload/')) return url ?? ''   // no es Cloudinary → tal cual
  if (url.includes(`/upload/${transform}`)) return url       // ya transformada
  return url.replace('/upload/', `/upload/${transform}/`)
}
