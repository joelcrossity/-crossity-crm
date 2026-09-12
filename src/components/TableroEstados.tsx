'use client'

import { useMemo, useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { archivarProyecto, cambiarEstado } from '@/app/acciones'
import { CampoBusqueda, Plegable } from '@/components/ui'
import { SUBESTADO, fechaCierre, fechaCorta, porCierre } from '@/lib/estados'
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

   Nada de lo que se toca acá espera al servidor para verse. La tarjeta
   se mueve al soltarla y desaparece al archivarla; la ida al servidor
   pasa atrás. Si vuelve mal, la tarjeta regresa a donde estaba y recién
   ahí aparece el error.
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

/* ------------------------------------------------------------------
   La tarjeta va afuera del componente a propósito.

   Definida adentro, React la trata como un tipo distinto en cada
   render: desmonta y vuelve a montar todas las tarjetas del tablero
   cada vez que cambia cualquier cosa. Y como el listado entra con una
   animación escalonada, ese remontaje la volvía a correr entera —al
   empezar a arrastrar, al soltar y otra vez al contestar el servidor—.
   Eso era el parpadeo: no era la red, era el tablero rearmándose.
   ------------------------------------------------------------------ */

function Tarjeta({
  f,
  color,
  cerrado = false,
  arrastrando,
  yendose,
  alEmpezar,
  alTerminar,
  alArchivar,
}: {
  f: Fila
  color: string
  cerrado?: boolean
  arrastrando: string | null
  yendose: boolean
  alEmpezar: (id: string) => void
  alTerminar: () => void
  alArchivar: (id: string) => void
}) {
  return (
    <li className="sale" data-yendo={yendose ? 'si' : 'no'}>
      <div className="group/tarjeta relative">
        <button
          type="button"
          aria-label={`Archivar ${f.nombre}`}
          title="Archivar: sale del tablero y queda en el historial"
          disabled={yendose}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            alArchivar(f.id)
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
            alEmpezar(f.id)
          }}
          onDragEnd={alTerminar}
          className={`flex cursor-grab flex-col gap-2 rounded-md border border-linea bg-superficie
                      p-3 transition-[border-color,box-shadow,transform,opacity] duration-200
                      ease-[var(--ease-salida)] hover:border-azul
                      hover:shadow-[var(--sombra-flotante)] active:cursor-grabbing ${
                        arrastrando === f.id ? 'scale-[0.97] opacity-40' : ''
                      }`}
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-bold leading-snug tracking-tight text-tinta">
              {f.nombre}
            </span>
            <span className="truncate text-2xs text-gris-50">{f.cliente}</span>
          </span>

          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xs">
            {f.subestado && <span className="text-gris">{SUBESTADO[f.subestado] ?? f.subestado}</span>}
            {/* En lo cerrado la fecha que importa es cuándo cerró, no
                cuándo se había comprometido entregarlo. */}
            {cerrado ? (
              <span className="cifra text-gris-50">
                {fechaCierre(f.cerrado_at) ?? 'sin fecha de cierre'}
              </span>
            ) : (
              f.fecha_comprometida && (
                <span className="cifra text-gris-50">{fechaCorta(f.fecha_comprometida)}</span>
              )
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
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------
   Un plegado de lo cerrado.

   Va aparte y no dentro del tablero porque tiene estado propio: lo que
   se escribió en su buscador es suyo, no del tablero. Con el estado
   arriba, escribir en "Terminado" volvía a dibujar las columnas vivas
   en cada tecla.

   El buscador aparece recién a partir de cinco: con dos tarjetas a la
   vista es un campo que ocupa lugar y no resuelve nada.
   ------------------------------------------------------------------ */

const MINIMO_PARA_BUSCAR = 5

function ZonaCerrada({
  columna,
  filas,
  yendose,
  objetivo,
  pregunta,
  propiasDeTarjeta,
  alElegirMotivo,
  alCancelarMotivo,
  alPasarEncima,
  alSalir,
  alSoltar,
}: {
  columna: Columna
  filas: Fila[]
  yendose: Set<string>
  objetivo: boolean
  pregunta: { id: string; clave: string } | null
  propiasDeTarjeta: {
    arrastrando: string | null
    alEmpezar: (id: string) => void
    alTerminar: () => void
    alArchivar: (id: string) => void
  }
  alElegirMotivo: (id: string, color: string, motivo: string) => void
  alCancelarMotivo: () => void
  alPasarEncima: (e: React.DragEvent) => void
  alSalir: () => void
  alSoltar: () => void
}) {
  const [busca, setBusca] = useState('')

  /* Lo último que cerró, primero. Es el orden en que uno lo busca:
     "el que terminamos la semana pasada", nunca "el más viejo". */
  const ordenadas = useMemo(
    () => [...filas].sort(porCierre((f) => f.cerrado_at)),
    [filas],
  )

  const q = busca.trim().toLowerCase()
  const halladas = q
    ? ordenadas.filter((f) =>
        `${f.nombre} ${f.cliente} ${f.codigo}`.toLowerCase().includes(q),
      )
    : ordenadas

  const visibles = halladas.filter((f) => !yendose.has(f.id))
  const total = filas.filter((f) => !yendose.has(f.id)).length

  return (
    <Plegable
      titulo={columna.etiqueta}
      cuantos={total}
      ayuda={columna.ayuda}
      resaltado={objetivo}
      punto={<span className={`size-2 shrink-0 rounded-full ${PUNTO[columna.color]}`} aria-hidden />}
      alPasarEncima={alPasarEncima}
      alSalir={alSalir}
      alSoltar={alSoltar}
    >
      {pregunta && (
        <Motivo
          columna={columna}
          pregunta={pregunta}
          alElegir={alElegirMotivo}
          alCancelar={alCancelarMotivo}
        />
      )}

      {total >= MINIMO_PARA_BUSCAR && (
        <div className="mb-2.5 flex items-center gap-2">
          <CampoBusqueda
            valor={busca}
            alCambiar={setBusca}
            marcador="Buscar por nombre, cliente o código…"
            chico
          />
          {q && (
            <span className="shrink-0 text-2xs text-gris-50">
              {visibles.length} de {total}
            </span>
          )}
        </div>
      )}

      {total === 0 ? (
        <p className="px-1 py-2 text-2xs text-gris-50">Ninguno.</p>
      ) : visibles.length === 0 ? (
        <p className="px-1 py-2 text-2xs text-gris-50">
          Ninguno coincide con «{busca.trim()}».
        </p>
      ) : (
        <ul className="escalona grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {halladas.map((f) => (
            <Tarjeta
              key={f.id}
              f={f}
              color={columna.color}
              cerrado
              yendose={yendose.has(f.id)}
              {...propiasDeTarjeta}
            />
          ))}
        </ul>
      )}
    </Plegable>
  )
}

function Motivo({
  columna,
  pregunta,
  alElegir,
  alCancelar,
}: {
  columna: Columna
  pregunta: { id: string; clave: string }
  alElegir: (id: string, color: string, motivo: string) => void
  alCancelar: () => void
}) {
  return (
    <div className="surge flex flex-col gap-2 rounded-md border border-azul bg-superficie p-2.5">
      <span className="text-2xs font-medium text-tinta">¿Por qué?</span>
      <div className="flex flex-col gap-1">
        {(MOTIVOS[columna.color] ?? []).map((m) => (
          <button
            key={m.valor}
            type="button"
            onClick={() => alElegir(pregunta.id, columna.color, m.valor)}
            className="rounded-md border border-linea px-2 py-1 text-left text-2xs text-gris
                       transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
          >
            {m.texto}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={alCancelar}
        className="text-2xs text-gris-50 hover:text-tinta"
      >
        Cancelar
      </button>
    </div>
  )
}

/* El hueco que marca dónde va a caer la tarjeta. Va afuera de la lista
   escalonada: adentro heredaba el retardo de entrada y aparecía medio
   segundo tarde, que para un indicador de arrastre es inútil. */
function Hueco({ activo, texto }: { activo: boolean; texto: string }) {
  return (
    <div
      className={`rounded-md border border-dashed px-3 py-6 text-center text-2xs
                  transition-[border-color,color,background-color] duration-200 ${
                    activo
                      ? 'border-azul bg-azul-aire font-medium text-azul-hondo'
                      : 'border-linea-fuerte text-gris-50'
                  }`}
    >
      {texto}
    </div>
  )
}

export default function TableroEstados({ filas, columnas }: { filas: Fila[]; columnas: Columna[] }) {
  const [, empezar] = useTransition()
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [encima, setEncima] = useState<string | null>(null)
  const [preguntando, setPreguntando] = useState<{ id: string; clave: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  /* Un conjunto y no un id: archivar tres seguidas sin esperar a la
     primera es normal, y con un solo id la anterior reaparecía. */
  const [yendose, setYendose] = useState<Set<string>>(new Set())

  const [vista, mover] = useOptimistic(
    filas,
    (actual: Fila[], c: { id: string; color: string; detalle: string | null }) =>
      actual.map((f) =>
        f.id === c.id
          ? { ...f, color: c.color, subestado: c.color === 'verde' ? c.detalle : null }
          : f,
      ),
  )

  /* La columna sin motivo de un color se queda con lo que no entró en
     ninguna de las que sí lo definen: si no, un proyecto gris sin
     motivo conocido desaparecería del tablero. */
  const sobrantes = (f: Fila, c: Columna) =>
    !c.motivo &&
    !columnas.some((o) => o.color === c.color && o.motivo && o.motivo === f.motivo_gris)

  /* Qué filas caen en cada columna: el color, y si la columna define un
     motivo, también ese motivo. Así "Por arrancar" y "Frenado" son dos
     columnas distintas sobre el mismo gris.

     La que se está archivando sigue en la lista mientras se desvanece:
     sacarla acá la haría desaparecer de golpe, sin animación. */
  const enColumna = (c: Columna) =>
    vista.filter((f) => f.color === c.color && (c.motivo ? f.motivo_gris === c.motivo : sobrantes(f, c)))

  function guardar(id: string, color: string, detalle: string | null) {
    setPreguntando(null)
    setError(null)
    empezar(async () => {
      mover({ id, color, detalle })
      const r = await cambiarEstado(id, color, detalle)
      /* Sin router.refresh(): la acción ya revalida esta ruta y Next
         vuelve con la página al día en la misma respuesta. Pedirlo de
         nuevo era un segundo viaje completo para traer lo mismo. */
      if (!r.ok) setError(r.error)
    })
  }

  function archivar(id: string) {
    setError(null)
    setYendose((s) => new Set(s).add(id))
    empezar(async () => {
      const r = await archivarProyecto(id)
      if (!r.ok) {
        setYendose((s) => {
          const n = new Set(s)
          n.delete(id)
          return n
        })
        setError(r.error)
      }
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

  const activas = columnas.filter((c) => c.zona === 'arriba')
  const cerradas = columnas.filter((c) => c.zona === 'abajo')

  const propiasDeTarjeta = {
    arrastrando,
    alEmpezar: setArrastrando,
    alTerminar: () => {
      setArrastrando(null)
      setEncima(null)
    },
    alArchivar: archivar,
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p
          role="status"
          className="surge flex items-baseline gap-3 rounded-md border border-rojo bg-rojo-aire
                     px-3 py-2 text-sm text-rojo"
        >
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 text-2xs underline underline-offset-2"
          >
            Cerrar
          </button>
        </p>
      )}

      <div className="riel -mx-5 flex gap-3 overflow-x-auto px-5 pb-3 lg:-mx-10 lg:px-10">
        {activas.map((c) => {
          const suyas = enColumna(c)
          const visibles = suyas.filter((f) => !yendose.has(f.id))
          const frenados = visibles.filter((f) => f.dias_sin_novedades > 7).length
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
                          border p-2.5 transition-[border-color,background-color] duration-200
                          [scroll-snap-align:start] ${
                            objetivo ? 'border-azul bg-azul-aire' : 'border-linea bg-panel'
                          }`}
            >
              <header className="flex flex-col gap-0.5 px-1 pt-0.5">
                <span className="flex items-baseline gap-2">
                  <span className={`size-2 shrink-0 rounded-full ${PUNTO[c.color]}`} aria-hidden />
                  <h2 className="text-sm font-bold tracking-tight text-tinta">{c.etiqueta}</h2>
                  <span className="cifra ml-auto text-2xs text-gris-50">{visibles.length}</span>
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

              {pregunta && (
                <Motivo
                  columna={c}
                  pregunta={pregunta}
                  alElegir={guardar}
                  alCancelar={() => setPreguntando(null)}
                />
              )}

              <ul className="escalona flex flex-col gap-2">
                {suyas.map((f) => (
                  <Tarjeta
                    key={f.id}
                    f={f}
                    color={c.color}
                    yendose={yendose.has(f.id)}
                    {...propiasDeTarjeta}
                  />
                ))}
              </ul>

              {(objetivo || visibles.length === 0) && (
                <Hueco activo={objetivo} texto={objetivo ? 'Soltalo acá' : 'Ninguno'} />
              )}
            </section>
          )
        })}
      </div>

      {/* Lo cerrado, al pie y plegado. */}
      <div className="flex flex-col gap-2">
        {cerradas.map((c) => (
          <ZonaCerrada
            key={c.clave}
            columna={c}
            filas={enColumna(c)}
            yendose={yendose}
            objetivo={encima === c.clave && arrastrando !== null}
            pregunta={preguntando?.clave === c.clave ? preguntando : null}
            propiasDeTarjeta={propiasDeTarjeta}
            alElegirMotivo={guardar}
            alCancelarMotivo={() => setPreguntando(null)}
            alPasarEncima={(e) => {
              e.preventDefault()
              setEncima(c.clave)
            }}
            alSalir={() => setEncima((v) => (v === c.clave ? null : v))}
            alSoltar={() => soltar(c)}
          />
        ))}
      </div>

      <p className="text-2xs text-gris-50">
        Se arrastra entre columnas y el cambio impacta en el proyecto. Frenado y Perdido preguntan
        el motivo: sin él, dentro de tres meses nadie sabe por qué se frenó. Lo cerrado se puede
        soltar en su plegado aunque esté cerrado.
      </p>
    </div>
  )
}
