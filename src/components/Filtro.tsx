'use client'

import { useMemo, useState } from 'react'
import { CampoBusqueda } from '@/components/ui'

/* ------------------------------------------------------------------
   Buscar y filtrar, arriba de cualquier lista.

   Tomado de cómo lo resuelve SUINO: una fila sola, búsqueda ancha a la
   izquierda y los recortes a la derecha. Con treinta y ocho proyectos
   ya cuesta encontrar uno; con ciento cincuenta va a ser imposible.

   Filtra en el navegador y no en la base a propósito: a esta escala los
   datos ya están todos acá, y esperar un viaje al servidor por cada
   letra tipeada se siente lento aunque no lo sea.
   ------------------------------------------------------------------ */

export type Recorte<T> = {
  nombre: string
  vacio: string
  opciones: { valor: string; texto: string }[]
  aplica: (item: T, valor: string) => boolean
}

export default function Filtro<T>({
  items,
  buscarEn,
  marcador,
  recortes = [],
  children,
}: {
  items: T[]
  buscarEn: (item: T) => string
  marcador: string
  recortes?: Recorte<T>[]
  children: (filtrados: T[]) => React.ReactNode
}) {
  const [texto, setTexto] = useState('')
  const [elegidos, setElegidos] = useState<Record<string, string>>({})

  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return items.filter((i) => {
      if (q && !buscarEn(i).toLowerCase().includes(q)) return false
      for (const r of recortes) {
        const v = elegidos[r.nombre]
        if (v && !r.aplica(i, v)) return false
      }
      return true
    })
    // buscarEn y recortes se redefinen en cada render del padre; incluirlos
    // recalcularía siempre y el memo no serviría de nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, texto, elegidos])

  const hayRecorte = texto.trim() !== '' || Object.values(elegidos).some(Boolean)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-w-56 flex-1">
          <CampoBusqueda valor={texto} alCambiar={setTexto} marcador={marcador} />
        </span>

        {recortes.map((r) => (
          <select
            key={r.nombre}
            value={elegidos[r.nombre] ?? ''}
            aria-label={r.vacio}
            onChange={(e) => setElegidos((v) => ({ ...v, [r.nombre]: e.target.value }))}
            className={`rounded-md border bg-superficie px-2.5 py-1.5 text-sm
                        transition-colors duration-150 hover:border-linea-fuerte focus:border-azul ${
                          elegidos[r.nombre]
                            ? 'border-azul font-medium text-azul-hondo'
                            : 'border-linea text-gris'
                        }`}
          >
            <option value="">{r.vacio}</option>
            {r.opciones.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        ))}

        {hayRecorte && (
          <button
            type="button"
            onClick={() => {
              setTexto('')
              setElegidos({})
            }}
            className="boton boton-sutil"
          >
            Limpiar
          </button>
        )}
      </div>

      {hayRecorte && (
        <p className="-mt-1 text-2xs text-gris-50">
          {filtrados.length === 0
            ? 'No hay ninguno que coincida.'
            : `${filtrados.length} de ${items.length}`}
        </p>
      )}

      {children(filtrados)}
    </div>
  )
}
