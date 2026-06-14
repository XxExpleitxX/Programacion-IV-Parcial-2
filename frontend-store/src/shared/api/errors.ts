/**
 * getApiErrorMessage — extrae un mensaje legible de un error desconocido.
 *
 * Prioriza el campo `detail` de la respuesta de la API (axios); si no, usa el
 * mensaje del Error nativo; como último recurso devuelve el fallback provisto.
 */
import axios from 'axios'

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail
    if (detail) return detail
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}
