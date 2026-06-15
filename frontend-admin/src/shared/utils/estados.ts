/** Etiquetas legibles de los estados del pedido (código → texto para el usuario). */
export const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE:  'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREP:    'En preparación',
  ENTREGADO:  'Entregado',
  CANCELADO:  'Cancelado',
}

export const labelEstado = (codigo: string): string => ESTADO_LABELS[codigo] ?? codigo
