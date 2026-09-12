'use client'

import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { archivarProyecto, cambiarEtapa, enfriar, reflotar } from '@/app/acciones'
import { plata, type EtapaViva } from '@/lib/estados'

/* ------------------------------------------------------------------
   El pipeline como tablero.

   Una lista te dice qué hay. Un tablero te dice dónde está trabado, que
   es la pregunta real: cinco cotizaciones sin respuesta y nada en
   relevamiento significa que el mes que viene no entra nada.

   Se puede arrastrar de columna a columna. No es la única forma de
   mover una oportunidad — desde la ficha también se hace, con teclado
   y en el teléfono — pero es la que cuesta menos que contarlo por
   WhatsApp, y ése es el listón.
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

export default function Tablero({ ops, etapas }: { ops: Op[]; etapas: EtapaViva[] }) {
  const ETIQUETA = new Map<string, string>(etapas.map((e) => [e.valor, e.etiqueta]))
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [encima, setEncima] = useState<string | null>(null)

  // La tarjeta se mueve al soltarla, no cuando contesta el servidor.
  /* La tarjeta desaparece apenas se toca archivar, sin esperar al
     servidor ni recargar. Si el servidor rechaza, vuelve sola en el
     refresco: React descarta el estado optimista. */
  const [archivando, setArchivando] = useState<string | null>(null)

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

    empezar(async () => {
      if (columna === FRIA) {
        if (op.enfriada) return
        mover({ id, fria: true })
        await enfriar(id, '')
      } else if (op.enfriada) {
        // Sale del frío y, si además la soltaron en otra columna, avanza.
        mover({ id, fria: false, etapa: columna })
        await reflotar(id)
        if (op.etapa !== columna) await cambiarEtapa(id, columna)
      } else {
        if (op.etapa === columna) return
        mover({ id, etapa: columna })
        await cambiarEtapa(id, columna)
      }
      router.refresh()
    })
  }

  return (
    <div className="riel -mx-5 flex gap-3 overflow-x-auto px-5 pb-3 lg:-mx-10 lg:px-10">
      {[...etapas, { valor: FRIA, etiqueta: 'Sin respuesta' }].map((etapa) => {
        const fria = etapa.valor === FRIA
        const suyas = (fria
          ? vista.filter((o) => o.enfriada)
          : vista.filter((o) => o.etapa === etapa.valor && !o.enfriada)
        ).filter((o) => o.id !== archivando)
        const enPesos = suyas.reduce(
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
            className={`flex w-[16.5rem] shrink-0 flex-col gap-2.5 rounded-lg border p-2.5
                        transition-colors duration-200 [scroll-snap-align:start] ${
                          objetivo
                            ? 'border-azul bg-azul-aire'
                            : fria
                              ? 'border-dashed border-linea-fuerte bg-panel/60'
                              : 'border-linea bg-panel'
                        }`}
          >
            <header className="flex flex-col gap-0.5 px-1 pt-0.5">
              <span className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold tracking-tight text-tinta">{etapa.etiqueta}</h2>
                <span className="cifra text-2xs text-gris-50">{suyas.length}</span>
              </span>
              <span className="cifra text-2xs text-gris-50">
                {fria
                  ? 'se enfriaron, no se perdieron'
                  : enPesos > 0
                    ? plata(enPesos, 'ARS')
                    : '—'}
              </span>
            </header>

            <ul className="escalona flex flex-col gap-2">
              {suyas.map((o) => (
                <li key={o.id} className="group/tarjeta relative">
                  {/* Aparece al pasar el cursor para no competir con el
                      contenido, pero en pantalla táctil queda siempre
                      visible: sin cursor no hay hover que revele nada. */}
                  <button
                    type="button"
                    aria-label={`Archivar ${o.nombre}`}
                    title="Archivar: sale del tablero y queda en el historial"
                    disabled={pendiente}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setArchivando(o.id)
                      empezar(async () => {
                        const r = await archivarProyecto(o.id)
                        if (!r.ok) setArchivando(null)
                        router.refresh()
                      })
                    }}
                    className="absolute top-2 right-2 z-10 grid size-6 place-items-center rounded-md
                               bg-superficie text-gris-25 opacity-100 transition-colors duration-150
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
                      setArrastrando(o.id)
                    }}
                    onDragEnd={() => {
                      setArrastrando(null)
                      setEncima(null)
                    }}
                    className={`flex cursor-grab flex-col gap-2 rounded-md border border-linea
                                bg-superficie p-3 transition-[border-color,box-shadow,opacity]
                                duration-150 hover:border-azul
                                hover:shadow-[0_2px_8px_-4px_oklch(0.232_0.003_106/0.25)]
                                active:cursor-grabbing ${
                                  arrastrando === o.id ? 'opacity-40' : ''
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
                      <span className="line-clamp-2 text-2xs leading-snug text-gris">
                        {o.proxima_accion}
                      </span>
                    )}

                    {(o.sin_agendar || o.seguimiento_vencido || o.negocia_sin_base || o.referente || o.enfriada) && (
                      <span className="flex flex-wrap gap-1">
                        {!o.enfriada && o.seguimiento_vencido && <Chip tono="rojo">vencido</Chip>}
                        {!o.enfriada && o.sin_agendar && <Chip tono="amarillo">sin agendar</Chip>}
                        {!o.enfriada && o.negocia_sin_base && <Chip tono="amarillo">nurturing</Chip>}
                        {o.referente && <Chip tono="violeta">por {o.referente.split(' ')[0]}</Chip>}
                    {o.enfriada && <Chip tono="gris">{ETIQUETA.get(o.etapa) ?? o.etapa}</Chip>}
                      </span>
                    )}
                  </Link>
                </li>
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
                  {objetivo ? 'Soltala acá' : fria ? 'Ninguna enfriada' : 'Vacía'}
                </li>
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

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
