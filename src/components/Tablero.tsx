'use client'

import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cambiarEtapa } from '@/app/acciones'
import { ETAPAS, plata } from '@/lib/estados'

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
}

export default function Tablero({ ops }: { ops: Op[] }) {
  const router = useRouter()
  const [, empezar] = useTransition()
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [encima, setEncima] = useState<string | null>(null)

  // La tarjeta se mueve al soltarla, no cuando contesta el servidor.
  const [vista, mover] = useOptimistic(ops, (actual: Op[], cambio: { id: string; etapa: string }) =>
    actual.map((o) => (o.id === cambio.id ? { ...o, etapa: cambio.etapa } : o)),
  )

  function soltar(etapa: string) {
    const id = arrastrando
    setArrastrando(null)
    setEncima(null)
    if (!id) return
    const op = vista.find((o) => o.id === id)
    if (!op || op.etapa === etapa) return

    empezar(async () => {
      mover({ id, etapa })
      await cambiarEtapa(id, etapa)
      router.refresh()
    })
  }

  return (
    <div className="riel -mx-5 flex gap-3 overflow-x-auto px-5 pb-3 lg:-mx-10 lg:px-10">
      {ETAPAS.map((etapa) => {
        const suyas = vista.filter((o) => o.etapa === etapa.valor)
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
                            : 'border-linea bg-panel'
                        }`}
          >
            <header className="flex flex-col gap-0.5 px-1 pt-0.5">
              <span className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold tracking-tight text-tinta">{etapa.etiqueta}</h2>
                <span className="cifra text-2xs text-gris-50">{suyas.length}</span>
              </span>
              <span className="cifra text-2xs text-gris-50">
                {enPesos > 0 ? plata(enPesos, 'ARS') : '—'}
              </span>
            </header>

            <ul className="escalona flex flex-col gap-2">
              {suyas.map((o) => (
                <li key={o.id}>
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

                    {(o.sin_agendar || o.seguimiento_vencido || o.negocia_sin_base || o.referente) && (
                      <span className="flex flex-wrap gap-1">
                        {o.seguimiento_vencido && <Chip tono="rojo">vencido</Chip>}
                        {o.sin_agendar && <Chip tono="amarillo">sin agendar</Chip>}
                        {o.negocia_sin_base && <Chip tono="amarillo">nurturing</Chip>}
                        {o.referente && <Chip tono="violeta">por {o.referente.split(' ')[0]}</Chip>}
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
                  {objetivo ? 'Soltala acá' : 'Vacía'}
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
  tono: 'amarillo' | 'rojo' | 'violeta'
  children: React.ReactNode
}) {
  const color =
    tono === 'rojo'
      ? 'border-rojo text-rojo'
      : tono === 'violeta'
        ? 'border-violeta-50 text-violeta-50'
        : 'border-amarillo text-amarillo'
  return (
    <span
      className={`rounded-full border px-1.5 py-px text-[10px] uppercase tracking-wider ${color}`}
    >
      {children}
    </span>
  )
}
