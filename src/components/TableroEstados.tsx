'use client'

import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { archivarProyecto, cambiarEstado } from '@/app/acciones'
import { Plegable } from '@/components/ui'
import { SUBESTADO, fechaCorta } from '@/lib/estados'
import type { Fila } from '@/components/TablaProyectos'

/* ------------------------------------------------------------------
   Los proyectos como tablero, y arrastrables.

   Arrastrar de "En vivo" a "Terminado" cambia el proyecto de verdad: no
   es una vista aparte, es el mismo dato que ve todo el mundo.

   Lo único que no se resuelve arrastrando es el porqué. Standby y
   Perdido exigen un motivo —la base lo exige, y con razón: "se frenó"
   sin decir si lo pausó el cliente o si se durmió no sirve para nada
   dentro de tres meses—. Así que al soltar ahí se pregunta, en el
   lugar donde se soltó, y recién después se guarda.
   ------------------------------------------------------------------ */

export type Columna = {
  clave: string
  etiqueta: string
  ayuda: string
  color: string
  /* Cuando hay motivo, la columna es un recorte dentro del color: dos
     proyectos grises pueden estar en columnas distintas según por qué
     se detuvieron. */
  motivo: string | null
  zona: string
  orden: number
  motivo_al_soltar: string | null
}

/* Los motivos que se ofrecen al soltar en una columna que no define el
   suyo. La lista es de la base —son valores del enum— y el texto
   humano vive acá porque es texto de pantalla. */
const MOTIVOS: Record<string, { valor: string; texto: string }[]> = {
  gris: [
    { valor: 'pausado_cliente', texto: 'Lo pausó el cliente' },
    { valor: 'esperando_anticipo', texto: 'Esperando el anticipo' },
    { valor: 'dormido', texto: 'Se durmió' },
  ],
  rojo: [
    { valor: 'perdido', texto: 'Lo perdimos' },
    { valor: 'descartado', texto: 'Lo descartamos' },
    { valor: 'entregado', texto: 'Se entregó y se cerró' },
  ],
}

const PUNTO: Record<string, string> = {
  verde: 'bg-verde',
  amarillo: 'bg-amarillo',
  gris: 'bg-gris-25',
  naranja: 'bg-naranja',
  rojo: 'bg-rojo',
}


export default function TableroEstados({ filas, columnas }: { filas: Fila[]; columnas: Columna[] }) {

  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [encima, setEncima] = useState<string | null>(null)
  const [preguntando, setPreguntando] = useState<{ id: string; clave: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [archivando, setArchivando] = useState<string | null>(null)

  /* Lo cerrado no va como columna: ocupa el mismo ancho que lo que se
     trabaja hoy y casi nunca se mira. Baja al pie, plegado, con su
     cantidad a la vista. Sigue siendo destino de arrastre —se puede
     soltar sobre el encabezado aunque esté cerrado— así que no se
     pierde nada de lo que se podía hacer. */
  /* Qué filas caen en cada columna: el color, y si la columna define
     un motivo, también ese motivo. Así "por arrancar" y "frenado" son
     dos columnas distintas sobre el mismo gris. */
  /* La columna sin motivo de un color se queda con lo que no entró en
     ninguna de las que sí lo definen: si no, un proyecto gris sin
     motivo conocido desaparecería del tablero. */
  const sobrantes = (f: Fila, c: Columna) =>
    !c.motivo &&
    !columnas.some((o) => o.color === c.color && o.motivo && o.motivo === f.motivo_gris)

  const enColumna = (c: Columna) =>
    vista.filter(
      (f) => f.color === c.color && (c.motivo ? f.motivo_gris === c.motivo : sobrantes(f, c)) && f.id !== archivando,
    )

  const [vista, mover] = useOptimistic(
    filas,
    (actual: Fila[], c: { id: string; color: string; detalle: string | null }) =>
      actual.map((f) =>
        f.id === c.id
          ? { ...f, color: c.color, subestado: c.color === 'verde' ? c.detalle : null }
          : f,
      ),
  )

  function guardar(id: string, color: string, detalle: string | null) {
    setPreguntando(null)
    setError(null)
    empezar(async () => {
      mover({ id, color, detalle })
      const r = await cambiarEstado(id, color, detalle)
      if (!r.ok) setError(r.error)
      router.refresh()
    })
  }

  function soltar(columna: Columna) {
    const id = arrastrando
    setArrastrando(null)
    setEncima(null)
    if (!id) return

    const f = vista.find((x) => x.id === id)
    if (!f || f.color === columna.color) return

    /* Si la columna ya define el motivo, no hay nada que preguntar:
       soltar en "Por arrancar" ya dice que está esperando el anticipo. */
    if (columna.motivo_al_soltar) guardar(id, columna.color, columna.motivo_al_soltar)
    else if (MOTIVOS[columna.color]) setPreguntando({ id, clave: columna.clave })
    else guardar(id, columna.color, null)
  }

  function archivar(id: string) {
    setArchivando(id)
    setError(null)
    empezar(async () => {
      const r = await archivarProyecto(id)
      if (!r.ok) {
        setArchivando(null)
        setError(r.error)
      }
      router.refresh()
    })
  }

  function Tarjeta({ f, color }: { f: Fila; color: string }) {
    return (
      <li className="group/tarjeta relative">
        <button
          type="button"
          aria-label={`Archivar ${f.nombre}`}
          title="Archivar: sale del tablero y queda en el historial"
          disabled={pendiente}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            archivar(f.id)
          }}
          className="absolute top-2 right-2 z-10 grid size-6 place-items-center rounded-md
                     bg-superficie text-gris-25 transition-colors duration-150
                     hover:text-azul-hondo lg:opacity-0 lg:group-hover/tarjeta:opacity-100"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
            <path
              d="M2.4 5.6h11.2v6.6a1.3 1.3 0 0 1-1.3 1.3H3.7a1.3 1.3 0 0 1-1.3-1.3V5.6Z"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path d="M1.6 3.2h12.8v2.4H1.6zM6.5 8.4h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>

        <Link
          href={`/proyecto/${f.codigo}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', f.id)
            setArrastrando(f.id)
          }}
          onDragEnd={() => {
            setArrastrando(null)
            setEncima(null)
          }}
          className={`flex cursor-grab flex-col gap-2 rounded-md border border-linea bg-superficie
                      p-3 transition-[border-color,box-shadow,opacity] duration-150
                      hover:border-azul hover:shadow-[var(--sombra-flotante)]
                      active:cursor-grabbing ${arrastrando === f.id ? 'opacity-40' : ''}`}
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-bold leading-snug tracking-tight text-tinta">
              {f.nombre}
            </span>
            <span className="truncate text-2xs text-gris-50">{f.cliente}</span>
          </span>

          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xs">
            {f.subestado && <span className="text-gris">{SUBESTADO[f.subestado] ?? f.subestado}</span>}
            {f.fecha_comprometida && (
              <span className="cifra text-gris-50">{fechaCorta(f.fecha_comprometida)}</span>
            )}
          </span>

          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-2xs">
            <span className={f.responsable ? 'text-gris' : 'text-amarillo'}>
              {f.responsable ?? 'sin responsable'}
            </span>
            {color === 'verde' && f.dias_sin_novedades > 7 && (
              <span className="cifra shrink-0 font-medium text-rojo">{f.dias_sin_novedades} d</span>
            )}
          </span>
        </Link>
      </li>
    )
  }

  function Motivo({
    columna,
    pregunta,
  }: {
    columna: Columna
    pregunta: { id: string; clave: string }
  }) {
    return (
      <div className="surge flex flex-col gap-2 rounded-md border border-azul bg-superficie p-2.5">
        <span className="text-2xs font-medium text-tinta">¿Por qué?</span>
        <div className="flex flex-col gap-1">
          {(MOTIVOS[columna.color] ?? []).map((m) => (
            <button
              key={m.valor}
              type="button"
              onClick={() => guardar(pregunta.id, columna.color, m.valor)}
              className="rounded-md border border-linea px-2 py-1 text-left text-2xs text-gris
                         transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
            >
              {m.texto}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPreguntando(null)}
          className="text-2xs text-gris-50 hover:text-tinta"
        >
          Cancelar
        </button>
      </div>
    )
  }

  const activas = columnas.filter((c) => c.zona === 'arriba')
  const cerradas = columnas.filter((c) => c.zona === 'abajo')

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="surge rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      <div className="riel -mx-5 flex gap-3 overflow-x-auto px-5 pb-3 lg:-mx-10 lg:px-10">
        {activas.map((c) => {
          const suyas = enColumna(c)
          const frenados = suyas.filter((f) => f.dias_sin_novedades > 7).length
          const objetivo = encima === c.clave && arrastrando !== null
          const pregunta = preguntando?.clave === c.clave ? preguntando : null

          return (
            <section
              key={c.clave}
              onDragOver={(e) => {
                e.preventDefault()
                setEncima(c.clave)
              }}
              onDragLeave={() => setEncima((v) => (v === c.clave ? null : v))}
              onDrop={() => soltar(c)}
              className={`flex w-[16.5rem] shrink-0 flex-col gap-2.5 rounded-[var(--radius-tarjeta)]
                          border p-2.5 transition-colors duration-200 [scroll-snap-align:start] ${
                            objetivo ? 'border-azul bg-azul-aire' : 'border-linea bg-panel'
                          }`}
            >
              <header className="flex flex-col gap-0.5 px-1 pt-0.5">
                <span className="flex items-baseline gap-2">
                  <span className={`size-2 shrink-0 rounded-full ${PUNTO[c.color]}`} aria-hidden />
                  <h2 className="text-sm font-bold tracking-tight text-tinta">{c.etiqueta}</h2>
                  <span className="cifra ml-auto text-2xs text-gris-50">{suyas.length}</span>
                </span>
                <span className="text-2xs text-gris-50">
                  {c.color === 'verde' && frenados > 0 ? (
                    <span className="font-medium text-rojo">
                      {frenados} sin novedades hace una semana
                    </span>
                  ) : (
                    c.ayuda
                  )}
                </span>
              </header>

              {pregunta && <Motivo columna={c} pregunta={pregunta} />}

              <ul className="escalona flex flex-col gap-2">
                {suyas.map((f) => (
                  <Tarjeta key={f.id} f={f} color={c.color} />
                ))}

                {suyas.length === 0 && (
                  <li
                    className={`rounded-md border border-dashed px-3 py-6 text-center text-2xs
                                transition-colors duration-200 ${
                                  objetivo
                                    ? 'border-azul text-azul-hondo'
                                    : 'border-linea-fuerte text-gris-50'
                                }`}
                  >
                    {objetivo ? 'Soltalo acá' : 'Ninguno'}
                  </li>
                )}
              </ul>
            </section>
          )
        })}
      </div>

      {/* Lo cerrado, al pie y plegado. */}
      <div className="flex flex-col gap-2">
        {cerradas.map((c) => {
          const suyas = enColumna(c)
          const objetivo = encima === c.clave && arrastrando !== null
          const pregunta = preguntando?.clave === c.clave ? preguntando : null

          return (
            <Plegable
              key={c.clave}
              titulo={c.etiqueta}
              cuantos={suyas.length}
              ayuda={c.ayuda}
              resaltado={objetivo}
              punto={<span className={`size-2 shrink-0 rounded-full ${PUNTO[c.color]}`} aria-hidden />}
              alPasarEncima={(e) => {
                e.preventDefault()
                setEncima(c.clave)
              }}
              alSalir={() => setEncima((v) => (v === c.clave ? null : v))}
              alSoltar={() => soltar(c)}
            >
              {pregunta && <Motivo columna={c} pregunta={pregunta} />}

              {suyas.length === 0 ? (
                <p className="px-1 py-2 text-2xs text-gris-50">Ninguno.</p>
              ) : (
                <ul className="escalona grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {suyas.map((f) => (
                    <Tarjeta key={f.id} f={f} color={c.color} />
                  ))}
                </ul>
              )}
            </Plegable>
          )
        })}
      </div>

      <p className="text-2xs text-gris-50">
        Se arrastra entre columnas y el cambio impacta en el proyecto. Frenado y Perdido preguntan
        el motivo: sin él, dentro de tres meses nadie sabe por qué se frenó. Lo cerrado se puede
        soltar en su plegado aunque esté cerrado.
      </p>
    </div>
  )
}
