'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { activarEtapa } from '@/app/acciones'
import { plata } from '@/lib/estados'
import { Seccion } from '@/components/ui'

/* ------------------------------------------------------------------
   Lo que ya se le cotizó y no se le vendió.

   Es la lista más rentable que tiene un cliente y la que nadie mira,
   porque hasta ahora no existía en ningún lado: quedaba en un PDF, en
   un mail de marzo o en la cabeza del que lo cotizó.

   El precio ya está acordado y el cliente ya lo vio. No hay que
   presupuestar de nuevo, no hay que explicar el alcance otra vez: solo
   hay que preguntar si lo quiere ahora.

   Se muestra a cuánto se acordó el dólar y a cuánto está hoy, porque es
   la conversación que va a haber. Una etapa cotizada en marzo a 1.100 y
   activada hoy a 1.545 son cuarenta por ciento de diferencia, y eso se
   habla antes de activarla, no después de facturarla.
   ------------------------------------------------------------------ */

export type PreCotizada = {
  hito_id: string
  proyecto_id: string
  codigo: string
  trabajo: string
  etapa_nombre: string
  entregable: string | null
  monto_neto: number
  moneda: string
  casa: string | null
  cotizacion_acordada: number | null
  cotizacion_hoy: number | null
  en_pesos: number | null
  ya_es_proyecto: boolean
}

export default function PreCotizadas({
  etapas,
  puedeActivar,
  hoy,
}: {
  etapas: PreCotizada[]
  puedeActivar: boolean
  hoy: string
}) {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [vence, setVence] = useState(hoy)

  if (etapas.length === 0) return null

  const total = etapas.reduce((s, e) => s + Number(e.en_pesos ?? 0), 0)

  function activar(id: string) {
    setError(null)
    empezar(async () => {
      const r = await activarEtapa(id, vence)
      if (r.ok) setAbriendo(null)
      else setError(r.error)
    })
  }

  return (
    <Seccion
      titulo="Ya cotizado, sin arrancar"
      cuantos={etapas.length}
      ayuda="Etapas que se le presupuestaron y todavía no pidió. El precio está acordado y ya las vio: no hay que cotizar de nuevo, solo preguntar."
    >
      {error && (
        <p role="alert" className="rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {etapas.map((e) => {
          /* Cuánto se movió el dólar desde que se cotizó. Se avisa a
             partir del cinco por ciento: menos que eso es ruido de
             mercado y no hace falta molestar a nadie. */
          const brecha =
            e.moneda !== 'ARS' && e.cotizacion_acordada && e.cotizacion_hoy
              ? (e.cotizacion_hoy / e.cotizacion_acordada - 1) * 100
              : null
          const corrida = brecha != null && Math.abs(brecha) >= 5

          return (
            <li key={e.hito_id} className="tarjeta flex flex-col gap-2 px-3.5 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-tinta">{e.etapa_nombre}</span>
                  <Link
                    href={`/proyecto/${e.codigo}`}
                    className="block truncate text-2xs text-gris-50 transition-colors
                               duration-150 hover:text-azul-hondo"
                  >
                    {e.trabajo}
                  </Link>
                </span>

                <span className="text-right">
                  <span className="cifra block text-sm font-bold text-tinta">
                    {plata(e.monto_neto, e.moneda)}
                  </span>
                  {e.moneda !== 'ARS' && e.en_pesos != null && (
                    <span className="cifra block text-2xs text-gris-50">
                      {plata(e.en_pesos, 'ARS')}
                    </span>
                  )}
                </span>
              </div>

              {e.entregable && (
                <span className="text-2xs leading-snug text-gris">{e.entregable}</span>
              )}

              {corrida && (
                <span className="text-2xs text-amarillo">
                  Se cotizó al {e.casa} de ${e.cotizacion_acordada?.toLocaleString('es-AR')} y hoy
                  está ${e.cotizacion_hoy?.toLocaleString('es-AR')}:{' '}
                  {brecha! > 0 ? 'subió' : 'bajó'} {Math.abs(brecha!).toFixed(0)}%. Conviene
                  hablarlo antes de activarla.
                </span>
              )}

              {puedeActivar &&
                (abriendo === e.hito_id ? (
                  <span className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-0.5">
                      <span className="rotulo">Se entrega el</span>
                      <input
                        type="date"
                        value={vence}
                        onChange={(x) => setVence(x.target.value)}
                        className="campo cifra w-40"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => activar(e.hito_id)}
                      disabled={pendiente || !vence}
                      className="boton boton-principal boton-chico"
                    >
                      {pendiente ? 'Activando…' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbriendo(null)}
                      className="boton boton-sutil boton-chico"
                    >
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAbriendo(e.hito_id)}
                    className="boton boton-secundario boton-chico w-fit"
                  >
                    Activar y ponerle fecha
                  </button>
                ))}
            </li>
          )
        })}
      </ul>

      <p className="flex flex-wrap items-baseline gap-x-3 border-t border-linea pt-2.5">
        <span className="rotulo">Todo junto</span>
        <span className="cifra text-base font-bold text-tinta">{plata(total, 'ARS')}</span>
        <span className="text-2xs text-gris-50">
          a las cotizaciones con las que se acordó cada una
        </span>
      </p>

      <p className="text-2xs text-gris-50">
        Activar una etapa la pone en ejecución: aparece en el proyecto, entra en la previsión de
        cobros y reparte su parte al equipo. Por eso pide la fecha de entrega.
      </p>
    </Seccion>
  )
}
