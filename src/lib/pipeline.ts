/* ------------------------------------------------------------------
   Las seis etapas comerciales, agrupadas en tres columnas.

   Agrupar no cambia nada en la base: cada oportunidad sigue teniendo su
   etapa exacta y todo lo que la lee —la franja, Hoy, los informes,
   la conversión a proyecto— sigue viendo lo mismo. Lo único que cambia
   es cuántas columnas dibuja el tablero.

   Se hace así a propósito, y en este orden: se puede ver funcionando
   con los datos reales y volver atrás borrando este archivo. Una
   reforma que mueve datos no se prueba, se decide.

   Las etapas se editan desde Sistema, o sea que mañana puede haber una
   que este archivo no conozca. Esa no se pierde: arma su propia columna
   al final. Es la regla que nos costó dos días con el tablero de
   proyectos —lo que no cae en ninguna columna desaparece sin avisar— y
   acá está escrita antes de que pase.
   ------------------------------------------------------------------ */

export type Grupo = {
  clave: string
  etiqueta: string
  ayuda: string
  etapas: string[]
}

export const GRUPOS: Grupo[] = [
  {
    clave: 'prospeccion',
    etiqueta: 'Prospección',
    ayuda: 'Apareció y se está entendiendo qué necesita',
    etapas: ['interes', 'primera_charla', 'relevamiento'],
  },
  {
    clave: 'propuesta',
    etiqueta: 'Propuesta y negociación',
    ayuda: 'Hay número sobre la mesa',
    etapas: ['a_cotizar', 'cotizado', 'negociacion'],
  },
  {
    clave: 'resolucion',
    etiqueta: 'Resolución',
    ayuda: 'Se cerró, para un lado o para el otro',
    etapas: ['ganado'],
  },
]

export type EtapaViva = { valor: string; etiqueta: string }

export type ColumnaAgrupada = {
  clave: string
  etiqueta: string
  ayuda: string
  /* Las etapas de este grupo que de verdad están activas, en orden. Es
     lo que dibuja la barra de progreso de cada tarjeta: tres tramos si
     hay tres etapas vivas, dos si alguien apagó una. */
  pasos: EtapaViva[]
}

/* Arma las columnas a partir de las etapas que el sistema tiene activas.
   Lo que no figura en ningún grupo se agrega como columna propia: es
   preferible una columna de más que una oportunidad que no está en
   ninguna parte. */
export function agrupar(etapas: EtapaViva[]): ColumnaAgrupada[] {
  const ubicadas = new Set<string>()

  const columnas: ColumnaAgrupada[] = GRUPOS.map((g) => {
    const pasos = g.etapas
      .map((clave) => etapas.find((e) => e.valor === clave))
      .filter((e): e is EtapaViva => Boolean(e))
    pasos.forEach((p) => ubicadas.add(p.valor))
    return { clave: g.clave, etiqueta: g.etiqueta, ayuda: g.ayuda, pasos }
  }).filter((c) => c.pasos.length > 0)

  const sueltas = etapas.filter((e) => !ubicadas.has(e.valor))
  for (const e of sueltas) {
    columnas.push({
      clave: e.valor,
      etiqueta: e.etiqueta,
      ayuda: 'Etapa nueva, todavía sin agrupar',
      pasos: [e],
    })
  }

  return columnas
}

/* En qué columna cae una oportunidad. Null si su etapa ya no existe
   —se apagó desde Sistema con oportunidades adentro—, y en ese caso el
   tablero la muestra aparte en vez de tragársela. */
export function columnaDe(etapa: string | null, columnas: ColumnaAgrupada[]): string | null {
  if (!etapa) return null
  return columnas.find((c) => c.pasos.some((p) => p.valor === etapa))?.clave ?? null
}

/* Cuántos pasos de la columna ya se cumplieron, contando el actual.
   Se deduce de la etapa y no se guarda aparte: dos datos que dicen lo
   mismo terminan diciéndolo distinto. */
export function avance(etapa: string | null, columna: ColumnaAgrupada): number {
  const i = columna.pasos.findIndex((p) => p.valor === etapa)
  return i < 0 ? 0 : i + 1
}

/* A qué etapa va una tarjeta soltada en una columna. Si ya está adentro
   se queda donde está: arrastrar para reordenar no puede hacerle perder
   el avance que tenía. */
export function alSoltarEn(etapaActual: string | null, columna: ColumnaAgrupada): string | null {
  if (columna.pasos.some((p) => p.valor === etapaActual)) return null
  return columna.pasos[0]?.valor ?? null
}
