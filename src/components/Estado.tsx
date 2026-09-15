'use client'

import { useState, useTransition } from 'react'
import { cambiarEstado } from '@/app/acciones'

/* ------------------------------------------------------------------
   El estado del proyecto, con el mismo vocabulario que el tablero.

   Esto estaba escrito a mano acá y se desfasó: el tablero agregó
   "implementando" como columna y la ficha siguió ofreciendo tres
   opciones para el verde, ninguna de ellas esa. O sea que a
   Implementación solo se llegaba arrastrando una tarjeta, y desde la
   ficha —que es donde se trabaja el proyecto— no había forma.

   Nadie hizo nada mal: son dos listas que dicen lo mismo en dos
   lugares, y eso siempre termina así. Ahora las dos leen
   columnas_tablero, que es donde las columnas ya vivían. Lo que se
   agregue, renombre o apague desde Sistema cambia los dos a la vez.

   Se muestran también las plegadas —terminado, perdido, frenado—.
   Arriba están las tres del trabajo activo; abajo, las de cerrar. Un
   proyecto se termina desde su ficha, no arrastrándolo.
   ------------------------------------------------------------------ */

export type ColumnaEstado = {
  clave: string
  etiqueta: string
  ayuda: string
  color: string
  detalle: string | null
  zona: string
}

const PUNTO: Record<string, string> = {
  verde: 'bg-verde',
  amarillo: 'bg-amarillo',
  gris: 'bg-gris-50',
  naranja: 'bg-naranja',
  rojo: 'bg-rojo',
}

export default function Estado({
  proyectoId,
  color,
  detalle,
  columnas,
}: {
  proyectoId: string
  color: string
  detalle: string | null
  columnas: ColumnaEstado[]
}) {
  const [actual, setActual] = useState(color)
  const [sub, setSub] = useState(detalle)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  /* Una columna es un color y a veces un detalle, así que la columna
     en la que está el proyecto es la que coincide en las dos cosas. La
     que no define detalle se queda con lo que no reclamó ninguna otra
     de su color: es el comodín, igual que en el tablero. */
  const deSuColor = (c: ColumnaEstado) => c.color === actual
  const reclamados = new Set(
    columnas.filter((c) => deSuColor(c) && c.detalle).map((c) => c.detalle),
  )
  const aqui = (c: ColumnaEstado) =>
    c.detalle ? c.detalle === sub : !sub || !reclamados.has(sub)

  const arriba = columnas.filter((c) => c.zona === 'arriba')
  const abajo = columnas.filter((c) => c.zona !== 'arriba')

  function aplicar(nuevoColor: string, nuevoDetalle: string | null) {
    const anteriorColor = actual
    const anteriorSub = sub
    setActual(nuevoColor)
    setSub(nuevoDetalle)
    setError(null)

    empezar(async () => {
      const r = await cambiarEstado(proyectoId, nuevoColor, nuevoDetalle)
      if (!r.ok) {
        setActual(anteriorColor)
        setSub(anteriorSub)
        setError(r.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline gap-2">
        <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">Estado</span>
        {pendiente && <span className="text-2xs text-gris-50">guardando…</span>}
        {error && <span className="text-2xs text-rojo">{error}</span>}
      </span>

      {/* Las del trabajo activo. Son las mismas tres del tablero, con
          el mismo nombre, porque salen de la misma tabla. */}
      <div
        role="radiogroup"
        aria-label="Estado del proyecto"
        className="tarjeta inline-flex flex-wrap gap-1 p-1"
      >
        {arriba.map((c) => (
          <Opcion
            key={c.clave}
            c={c}
            elegida={c.color === actual && aqui(c)}
            pendiente={pendiente}
            alElegir={() => aplicar(c.color, c.detalle)}
          />
        ))}
      </div>

      {/* Y las de cerrar, separadas. Terminar o dar por perdido un
          proyecto no es avanzar un casillero: es sacarlo del tablero,
          y conviene que cueste un gesto distinto. */}
      {abajo.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="pr-1 text-2xs text-gris-50">cerrar:</span>
          {abajo.map((c) => (
            <Opcion
              key={c.clave}
              c={c}
              elegida={c.color === actual && aqui(c)}
              pendiente={pendiente}
              alElegir={() => aplicar(c.color, c.detalle)}
              sutil
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* Un botón de estado. Fuera del componente porque definirlo adentro lo
   vuelve a crear en cada render, y React remonta lo que devuelve: las
   transiciones se cortan y el foco se pierde. */
function Opcion({
  c,
  elegida,
  pendiente,
  alElegir,
  sutil = false,
}: {
  c: ColumnaEstado
  elegida: boolean
  pendiente: boolean
  alElegir: () => void
  sutil?: boolean
}) {
  return (
    <button
      type="button"
      role={sutil ? undefined : 'radio'}
      aria-checked={sutil ? undefined : elegida}
      aria-pressed={sutil ? elegida : undefined}
      disabled={pendiente}
      title={c.ayuda}
      onClick={alElegir}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs
                  transition-colors duration-150 disabled:opacity-50 ${
                    elegida
                      ? 'bg-tinta text-white'
                      : sutil
                        ? 'text-gris-50 hover:bg-panel hover:text-tinta'
                        : 'text-gris hover:bg-panel hover:text-tinta'
                  }`}
    >
      <span className={`size-1.5 rounded-full ${PUNTO[c.color] ?? 'bg-gris-50'}`} aria-hidden />
      {c.etiqueta}
    </button>
  )
}
