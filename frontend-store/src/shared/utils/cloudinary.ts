export function cldThumb(
  url: string | undefined | null,
  transform = 'f_auto,q_auto,c_fill,w_400,h_400',
): string {
  if (!url || !url.includes('/upload/')) return url ?? ''   // no es Cloudinary → tal cual
  if (url.includes(`/upload/${transform}`)) return url       // ya transformada
  return url.replace('/upload/', `/upload/${transform}/`)
}
