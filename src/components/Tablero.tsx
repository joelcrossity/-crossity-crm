'use client'

import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { archivarProyecto, cambiarEtapa, enfriar, reflotar } from '@/app/acciones'
import { plata, type EtapaViva } from '@/lib/estados'
import { Plegable } from '@/components/ui'

/* ------------------------------------------------------------------
   El pipeline como tablero.

   Una lista te dice qué hay. Un tablero te dice dónde está trabado, que
   es la pregunta real: cinco cotizaciones sin respuesta y nada en
   relevamiento significa que el mes que viene no entra nada.

   Se puede arrastrar de columna a columna. No es la única forma de
   mover una oportunidad — desde la ficha también se hace, con teclado
   y en el teléfono — pero es la que cuesta menos que contarlo por
   WhatsApp, y ése es el listón.

   Todo lo que se toca se ve al instante. La ida al servidor pasa
   atrás; si vuelve mal, la tarjeta regresa sola y recién ahí aparece
   el error.
   ------------------------------------------------------------------ */

export type Op = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  etapa: string
  monto_neto: number | null
  moneda: string
  proxima_accion: string | null
  sin_agendar: boolean
  seguimiento_vencido: boolean
  negocia_sin_base: boolean
  cotizado_sin_monto: boolean
  referente: string | null
  enfriada: boolean
}

/* La enfriada no es una etapa más. Una etapa dice hasta dónde llegó la
   conversación, y eso no cambia porque el cliente deje de contestar:
   sigue siendo una cotización enviada. Lo que cambia es que está fría.
   Por eso conserva su etapa, y volver a levantarla retoma donde estaba
   en vez de empezar de nuevo. */
const FRIA = '__fria'

function Chip({
  tono,
  children,
}: {
  tono: 'amarillo' | 'rojo' | 'violeta' | 'gris'
  children: React.ReactNode
}) {
  const color =
    tono === 'rojo'
      ? 'border-rojo text-rojo'
      : tono === 'violeta'
        ? 'border-violeta-50 text-violeta-50'
        : tono === 'gris'
          ? 'border-linea-fuerte text-gris-50'
          : 'border-amarillo text-amarillo'
  return (
    <span
      className={`rounded-full border px-1.5 py-px text-[10px] uppercase tracking-wider ${color}`}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------
   La tarjeta va afuera del componente a propósito.

   Definida adentro, React la trata como un tipo distinto en cada
   render: desmonta y vuelve a montar todas las tarjetas del tablero
   cada vez que cambia cualquier cosa. Y como la lista entra con una
   animación escalonada, ese remontaje la volvía a correr entera —al
   empezar a arrastrar, al soltar y otra vez al contestar el servidor—.
   Eso era el parpadeo: no era la red, era el tablero rearmándose.
   ------------------------------------------------------------------ */

function Tarjeta({
  o,
  etiqueta,
  arrastrando,
  yendose,
  alEmpezar,
  alTerminar,
  alArchivar,
}: {
  o: Op
  etiqueta: string
  arrastrando: string | null
  yendose: boolean
  alEmpezar: (id: string) => void
  alTerminar: () => void
  alArchivar: (id: string) => void
}) {
  return (
    <li className="sale" data-yendo={yendose ? 'si' : 'no'}>
      <div className="group/tarjeta relative">
        {/* Aparece al pasar el cursor para no competir con el contenido,
            pero en pantalla táctil queda siempre visible: sin cursor no
            hay hover que revele nada. */}
        <button
          type="button"
          aria-label={`Archivar ${o.nombre}`}
          title="Archivar: sale del tablero y queda en el historial"
          disabled={yendose}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            alArchivar(o.id)
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
            <path
              d="M1.6 3.2h12.8v2.4H1.6zM6.5 8.4h3"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <Link
          href={`/proyecto/${o.codigo}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', o.id)
            alEmpezar(o.id)
          }}
          onDragEnd={alTerminar}
          className={`flex cursor-grab flex-col gap-2 rounded-md border border-linea
                      bg-superficie p-3 transition-[border-color,box-shadow,transform,opacity]
                      duration-200 ease-[var(--ease-salida)] hover:border-azul
                      hover:shadow-[var(--sombra-flotante)] active:cursor-grabbing ${
                        arrastrando === o.id ? 'scale-[0.97] opacity-40' : ''
                      }`}
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-bold leading-snug tracking-tight text-tinta">
              {o.nombre}
            </span>
            <span className="truncate text-2xs text-gris-50">{o.cliente}</span>
          </span>

          {o.monto_neto !== null ? (
            <span className="cifra text-sm font-medium text-tinta">
              {plata(o.monto_neto, o.moneda)}
            </span>
          ) : o.cotizado_sin_monto ? (
            <span className="text-2xs text-amarillo">cotizado sin monto</span>
          ) : null}

          {o.proxima_accion && (
            <span className="line-clamp-2 text-2xs leading-snug text-gris">{o.proxima_accion}</span>
          )}

          {(o.sin_agendar || o.seguimiento_vencido || o.negocia_sin_base || o.referente || o.enfriada) && (
            <span className="flex flex-wrap gap-1">
              {!o.enfriada && o.seguimiento_vencido && <Chip tono="rojo">vencido</Chip>}
              {!o.enfriada && o.sin_agendar && <Chip tono="amarillo">sin agendar</Chip>}
              {!o.enfriada && o.negocia_sin_base && <Chip tono="amarillo">nurturing</Chip>}
              {o.referente && <Chip tono="violeta">por {o.referente.split(' ')[0]}</Chip>}
              {o.enfriada && <Chip tono="gris">{etiqueta}</Chip>}
            </span>
          )}
        </Link>
      </div>
    </li>
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

export default function Tablero({ ops, etapas }: { ops: Op[]; etapas: EtapaViva[] }) {
  const ETIQUETA = new Map<string, string>(etapas.map((e) => [e.valor, e.etiqueta]))
  const [, empezar] = useTransition()
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [encima, setEncima] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /* Un conjunto y no un id: archivar tres seguidas sin esperar a la
     primera es normal, y con un solo id la anterior reaparecía. */
  const [yendose, setYendose] = useState<Set<string>>(new Set())

  // La tarjeta se mueve al soltarla, no cuando contesta el servidor.
  const [vista, mover] = useOptimistic(
    ops,
    (actual: Op[], c: { id: string; etapa?: string; fria?: boolean }) =>
      actual.map((o) =>
        o.id === c.id
          ? { ...o, etapa: c.etapa ?? o.etapa, enfriada: c.fria ?? o.enfriada }
          : o,
      ),
  )

  function soltar(columna: string) {
    const id = arrastrando
    setArrastrando(null)
    setEncima(null)
    if (!id) return
    const op = vista.find((o) => o.id === id)
    if (!op) return

    setError(null)
    empezar(async () => {
      /* Sin router.refresh(): estas acciones ya revalidan la ruta y
         Next vuelve con la página al día en la misma respuesta.
         Pedirlo de nuevo era un segundo viaje completo por lo mismo. */
      if (columna === FRIA) {
        if (op.enfriada) return
        mover({ id, fria: true })
        const r = await enfriar(id, '')
        if (!r.ok) setError(r.error)
      } else if (op.enfriada) {
        // Sale del frío y, si además la soltaron en otra columna, avanza.
        mover({ id, fria: false, etapa: columna })
        const r = await reflotar(id)
        if (!r.ok) return setError(r.error)
        if (op.etapa !== columna) {
          const s = await cambiarEtapa(id, columna)
          if (!s.ok) setError(s.error)
        }
      } else {
        if (op.etapa === columna) return
        mover({ id, etapa: columna })
        const r = await cambiarEtapa(id, columna)
        if (!r.ok) setError(r.error)
      }
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

  const propiasDeTarjeta = {
    arrastrando,
    alEmpezar: setArrastrando,
    alTerminar: () => {
      setArrastrando(null)
      setEncima(null)
    },
    alArchivar: archivar,
  }

  const frias = vista.filter((o) => o.enfriada)
  const friasVisibles = frias.filter((o) => !yendose.has(o.id))
  const friaObjetivo = encima === FRIA && arrastrando !== null

  return (
    <div className="flex flex-col gap-3">
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
        {etapas.map((etapa) => {
          const suyas = vista.filter((o) => o.etapa === etapa.valor && !o.enfriada)
          const visibles = suyas.filter((o) => !yendose.has(o.id))
          const enPesos = visibles.reduce(
            (s, o) => s + (o.moneda === 'ARS' ? o.monto_neto ?? 0 : 0),
            0,
          )
          const objetivo = encima === etapa.valor && arrastrando !== null

          return (
            <section
              key={etapa.valor}
              onDragOver={(e) => {
                e.preventDefault()
                setEncima(etapa.valor)
              }}
              onDragLeave={() => setEncima((v) => (v === etapa.valor ? null : v))}
              onDrop={() => soltar(etapa.valor)}
              className={`flex w-[16.5rem] shrink-0 flex-col gap-2.5 rounded-[var(--radius-tarjeta)]
                          border p-2.5 transition-[border-color,background-color] duration-200
                          [scroll-snap-align:start] ${
                            objetivo ? 'border-azul bg-azul-aire' : 'border-linea bg-panel'
                          }`}
            >
              <header className="flex flex-col gap-0.5 px-1 pt-0.5">
                <span className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-bold tracking-tight text-tinta">{etapa.etiqueta}</h2>
                  <span className="cifra text-2xs text-gris-50">{visibles.length}</span>
                </span>
                <span className="cifra text-2xs text-gris-50">
                  {enPesos > 0 ? plata(enPesos, 'ARS') : '—'}
                </span>
              </header>

              <ul className="escalona flex flex-col gap-2">
                {suyas.map((o) => (
                  <Tarjeta
                    key={o.id}
                    o={o}
                    etiqueta={ETIQUETA.get(o.etapa) ?? o.etapa}
                    yendose={yendose.has(o.id)}
                    {...propiasDeTarjeta}
                  />
                ))}
              </ul>

              {(objetivo || visibles.length === 0) && (
                <Hueco activo={objetivo} texto={objetivo ? 'Soltala acá' : 'Vacía'} />
              )}
            </section>
          )
        })}
      </div>

      {/* Las enfriadas al pie: no se perdieron, pero tampoco tienen que
          ocupar una columna del ancho de las que se están trabajando. */}
      <Plegable
        titulo="Sin respuesta"
        cuantos={friasVisibles.length}
        ayuda="se enfriaron, no se perdieron"
        resaltado={friaObjetivo}
        alPasarEncima={(e) => {
          e.preventDefault()
          setEncima(FRIA)
        }}
        alSalir={() => setEncima((v) => (v === FRIA ? null : v))}
        alSoltar={() => soltar(FRIA)}
      >
        {friasVisibles.length === 0 ? (
          <p className="px-1 py-2 text-2xs text-gris-50">
            Ninguna enfriada. Arrastrá acá una oportunidad que dejó de contestar.
          </p>
        ) : (
          <ul className="escalona grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {frias.map((o) => (
              <Tarjeta
                key={o.id}
                o={o}
                etiqueta={ETIQUETA.get(o.etapa) ?? o.etapa}
                yendose={yendose.has(o.id)}
                {...propiasDeTarjeta}
              />
            ))}
          </ul>
        )}
      </Plegable>
    </div>
  )
}
