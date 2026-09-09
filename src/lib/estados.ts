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

export type EtapaViva = { valor: string; etiqueta: string }

/* Las etapas ahora viven en la base y se editan desde Sistema. Esta
   lista queda solo como respaldo: si la consulta falla, el pipeline
   sigue dibujándose en vez de aparecer vacío. */
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

/* El peso lleva su símbolo porque es la moneda de todos los días y no
   se confunde con nada. El dólar y el euro llevan el código escrito: en
   una pantalla con tres monedas mezcladas, "US$" y "$" se leen igual de
   reojo, y confundir uno con otro son mil veces el error. */
export function plata(monto: number | null, moneda = 'ARS') {
  if (monto === null || monto === undefined) return '—'
  const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(monto)
  if (moneda === 'USD') return `USD ${numero}`
  if (moneda === 'EUR') return `EUR ${numero}`
  return `$ ${numero}`
}

export function fechaCorta(f: string | null) {
  if (!f) return null
  return new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}
