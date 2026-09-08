// El vocabulario del semáforo es de Crossity, no del sistema.
export const COLORES = {
  verde:    { etiqueta: 'En vivo',     ayuda: 'Se está trabajando ahora',   punto: 'bg-verde', texto: 'text-verde' },
  amarillo: { etiqueta: 'A seguir',    ayuda: 'La pelota está del otro lado', punto: 'bg-amarillo', texto: 'text-amarillo' },
  gris:     { etiqueta: 'Standby',     ayuda: 'Ni muerto ni vivo',          punto: 'bg-gris-50', texto: 'text-gris-50' },
  naranja:  { etiqueta: 'Terminado',   ayuda: 'No hay nada más que hacer',  punto: 'bg-naranja',     texto: 'text-naranja' },
  rojo:     { etiqueta: 'Perdido',     ayuda: 'Salió mal o se descartó',    punto: 'bg-rojo', texto: 'text-rojo' },
} as const

export type Color = keyof typeof COLORES

export const SUBESTADO: Record<string, string> = {
  en_curso: 'en curso',
  bloqueado: 'bloqueado',
  esperando_cliente: 'esperando cliente',
  esperando_anticipo: 'esperando anticipo',
  pausado_cliente: 'pausado por el cliente',
  dormido: 'dormido',
  no_se_dio: 'no se dio',
}

/* A cotizar y Cotizado son dos momentos distintos: uno es trabajo
   nuestro pendiente, el otro es esperar al cliente. Confundirlos hacía
   que el que espera pareciera que avanza. */
export const ETAPAS = [
  { valor: 'interes',        etiqueta: 'Interés' },
  { valor: 'primera_charla', etiqueta: 'Primera charla' },
  { valor: 'relevamiento',   etiqueta: 'Relevamiento' },
  { valor: 'a_cotizar',      etiqueta: 'A cotizar' },
  { valor: 'cotizado',       etiqueta: 'Cotizado' },
  { valor: 'negociacion',    etiqueta: 'Negociación' },
] as const

export const APERTURA: Record<number, string> = {
  3: 'el total del proyecto',
  2: 'la propuesta y los entregables',
  1: 'sólo lo suyo',
}

export function plata(monto: number | null, moneda = 'ARS') {
  if (monto === null || monto === undefined) return '—'
  const simbolo = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : '$'
  return `${simbolo} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(monto)}`
}

export function fechaCorta(f: string | null) {
  if (!f) return null
  return new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}
