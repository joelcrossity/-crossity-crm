'use client'

import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { archivarProyecto, cambiarEtapa, enfriar, reflotar } from '@/app/acciones'
import { plata, type EtapaViva } from '@/lib/estados'
import { Plegable } from '@/components/ui'
import EditarOportunidad from '@/components/EditarOportunidad'
import type { Cliente } from '@/components/ElegirCliente'
import { agrupar, avance, alSoltarEn, columnaDe, type ColumnaAgrupada } from '@/lib/pipeline'
import { requisitosParaGanar } from '@/components/ListoParaGanar'

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
  organizacion_id: string
  responsable_id: string | null
  descripcion: string | null
  casa_cotizacion: string
  cotizacion_pactada: number | null
  puedo_editar: boolean
  etapas_cotizadas: number
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
  paso,
  pasos,
  hayPrevia,
  hayProxima,
  alMover,
  arrastrando,
  yendose,
  alEmpezar,
  alTerminar,
  alArchivar,
  alEditar,
}: {
  o: Op
  etiqueta: string
  /* Cuántos pasos de su columna lleva cumplidos, y de cuántos. Se
     dibuja como barra y no como lista: con tres columnas hay más
     tarjetas a la vista, y tres renglones extra por tarjeta es
     exactamente lo que agrupar vino a evitar. */
  paso: number
  pasos: number
  /* Mover con botones y no solo arrastrando. En una pantalla tactil el
     arrastre entre columnas que se desplazan de costado es casi
     imposible: hay que sostener la tarjeta y empujar el tablero al
     mismo tiempo con el mismo dedo. */
  hayPrevia: boolean
  hayProxima: boolean
  alMover: (o: Op, direccion: -1 | 1) => void
  alEditar: (o: Op) => void
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
        <span className="absolute top-2 right-2 z-10 flex gap-0.5 lg:opacity-0
                         lg:group-hover/tarjeta:opacity-100">
          {o.puedo_editar && (
            <button
              type="button"
              aria-label={`Editar ${o.nombre}`}
              title="Editar y cotizar sin salir del pipeline"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                alEditar(o)
              }}
              className="grid size-6 place-items-center rounded-md bg-superficie text-gris-25
                         transition-colors duration-150 hover:text-azul-hondo"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
                <path d="M11.2 2.6a1.4 1.4 0 0 1 2 2L6 11.8l-2.7.9.9-2.7 7-7.4Z"
                      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </button>
          )}
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
          className="grid size-6 place-items-center rounded-md bg-superficie text-gris-25
                     transition-colors duration-150 hover:text-azul-hondo"
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
        </span>

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
              {o.etapas_cotizadas > 0 && (
                <Chip tono="violeta">
                  {o.etapas_cotizadas} etapa{o.etapas_cotizadas > 1 ? 's' : ''}
                </Chip>
              )}
            </span>
          )}

          {/* Dónde está dentro de su columna. Antes lo decía la columna
              misma —había una por etapa— y al agrupar eso se perdía.
              Acá vuelve, en un renglón en vez de seis. */}
          {/* Al pie y siempre visibles: en el telefono no hay cursor que
              revele nada, y son el unico modo comodo de mover algo. */}
          {(hayPrevia || hayProxima) && (
            <span className="flex items-center gap-1 pt-1">
              {hayPrevia && (
                <button
                  type="button"
                  aria-label={`Retroceder ${o.nombre}`}
                  title="A la columna anterior"
                  onClick={(e) => { e.preventDefault(); alMover(o, -1) }}
                  className="grid size-6 place-items-center rounded-md border border-linea text-gris-50 transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
                >
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
                    <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              {hayProxima && (
                <button
                  type="button"
                  aria-label={`Avanzar ${o.nombre}`}
                  title="A la columna siguiente"
                  onClick={(e) => { e.preventDefault(); alMover(o, 1) }}
                  className="grid size-6 place-items-center rounded-md border border-linea text-gris-50 transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
                >
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
                    <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </span>
          )}

          {pasos > 1 && (
            <span
              className="flex gap-0.5 pt-0.5"
              title={`Paso ${paso} de ${pasos}`}
              aria-label={`Paso ${paso} de ${pasos}`}
            >
              {Array.from({ length: pasos }, (_, i) => (
                <span
                  key={i}
                  className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ${
                    i < paso ? 'bg-verde' : 'bg-linea-fuerte'
                  }`}
                />
              ))}
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

export default function Tablero({
  ops,
  etapas,
  clientes = [],
  personas = [],
  cotizaciones = [],
}: {
  ops: Op[]
  etapas: EtapaViva[]
  clientes?: Cliente[]
  personas?: { id: string; nombre: string }[]
  cotizaciones?: { casa: string; venta: number }[]
}) {
  const [editando, setEditando] = useState<Op | null>(null)
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

  function soltar(columna: string, grupo?: ColumnaAgrupada) {
    const id = arrastrando
    setArrastrando(null)
    setEncima(null)
    if (!id) return
    const op = vista.find((o) => o.id === id)
    if (!op) return

    /* Una columna agrupa varias etapas, así que soltar adentro de la
       propia no es avanzar: es reordenar. Y quien ya está en
       negociación no vuelve a "a cotizar" por haber arrastrado la
       tarjeta dos centímetros. */
    const destino = grupo ? alSoltarEn(op.etapa, grupo) : columna
    if (grupo && destino === null && !op.enfriada) return
    columna = destino ?? columna

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

  /* Avanzar o retroceder una columna con los botones de la tarjeta.

     Entrar en Resolución es ganar, y ganar genera entregas, reparte
     plata y le pone fechas a gente. Si falta algo se abre el lápiz en
     vez de avanzar: es donde se arregla, y avisa qué falta. Bloquear
     sin abrir dónde resolverlo es dejar a alguien mirando un botón que
     no anda. */
  function moverUno(o: Op, direccion: -1 | 1) {
    const i = columnas.findIndex((c) => c.clave === columnaDe(o.etapa, columnas))
    const destino = columnas[i + direccion]
    if (!destino) return

    if (direccion === 1 && destino.clave === 'resolucion') {
      const faltan = requisitosParaGanar({
        entregas: o.etapas_cotizadas,
        moneda: o.moneda,
        casa: o.casa_cotizacion,
        responsable: o.responsable_id,
      }).filter((r) => !r.cumple)

      if (faltan.length > 0) {
        setError(
          `Antes de darla por ganada falta: ${faltan.map((f) => f.texto.toLowerCase()).join(', ')}.`,
        )
        setEditando(o)
        return
      }
    }

    setError(null)
    empezar(async () => {
      const etapa = destino.pasos[direccion === 1 ? 0 : destino.pasos.length - 1]?.valor
      if (!etapa) return
      mover({ id: o.id, etapa })
      const r = await cambiarEtapa(o.id, etapa)
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

  const propiasDeTarjeta = {
    arrastrando,
    alEmpezar: setArrastrando,
    alTerminar: () => {
      setArrastrando(null)
      setEncima(null)
    },
    alArchivar: archivar,
    alEditar: setEditando,
  }

  /* Tres columnas en vez de seis. La etapa exacta no se toca: cada
     oportunidad sigue teniendo la suya y todo lo que la lee sigue
     viendo lo mismo. Acá solo cambia cuántas cajas se dibujan. */
  const columnas = agrupar(etapas)

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
        {columnas.map((etapa) => {
          const suyas = vista.filter(
            (o) => columnaDe(o.etapa, columnas) === etapa.clave && !o.enfriada,
          )
          const visibles = suyas.filter((o) => !yendose.has(o.id))
          const enPesos = visibles.reduce(
            (s, o) => s + (o.moneda === 'ARS' ? o.monto_neto ?? 0 : 0),
            0,
          )
          const objetivo = encima === etapa.clave && arrastrando !== null

          return (
            <section
              key={etapa.clave}
              onDragOver={(e) => {
                e.preventDefault()
                setEncima(etapa.clave)
              }}
              onDragLeave={() => setEncima((v) => (v === etapa.clave ? null : v))}
              onDrop={() => soltar(etapa.clave, etapa)}
              className={`flex w-[19rem] shrink-0 flex-col gap-2.5 rounded-[var(--radius-tarjeta)]
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
                <span className="text-2xs leading-snug text-gris-50">{etapa.ayuda}</span>
              </header>

              <ul className="escalona flex flex-col gap-2">
                {suyas.map((o) => (
                  <Tarjeta
                    key={o.id}
                    o={o}
                    etiqueta={ETIQUETA.get(o.etapa) ?? o.etapa}
                    paso={avance(o.etapa, etapa)}
                    pasos={etapa.pasos.length}
                    hayPrevia={columnas.findIndex((c) => c.clave === etapa.clave) > 0}
                    hayProxima={
                      columnas.findIndex((c) => c.clave === etapa.clave) < columnas.length - 1
                    }
                    alMover={moverUno}
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

      {editando && (
        <EditarOportunidad
          op={{
            id: editando.id,
            codigo: editando.codigo,
            nombre: editando.nombre,
            organizacion_id: editando.organizacion_id,
            cliente: editando.cliente,
            responsable_id: editando.responsable_id,
            monto_neto: editando.monto_neto,
            moneda: editando.moneda,
            casa_cotizacion: editando.casa_cotizacion,
            cotizacion_pactada: editando.cotizacion_pactada,
            etapa: editando.etapa,
            descripcion: editando.descripcion,
          }}
          clientes={clientes}
          personas={personas}
          etapasPipeline={etapas}
          cotizaciones={cotizaciones}
          alCerrar={() => setEditando(null)}
        />
      )}

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
                paso={0}
                pasos={0}
                hayPrevia={false}
                hayProxima={false}
                alMover={moverUno}
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
