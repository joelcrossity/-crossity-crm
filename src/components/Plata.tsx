'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { anotarCotizacion, cambiarIva, cambiarMoneda } from '@/app/acciones'
import { plata } from '@/lib/estados'

/* ------------------------------------------------------------------
   Moneda e IVA del proyecto.

   Dos cosas que se daban por supuestas: que todo está en pesos y que
   todo lleva 21 %. Ninguna de las dos es cierta siempre, y darlas por
   supuestas no es un redondeo — es cobrar de más o de menos.
   ------------------------------------------------------------------ */

const MONEDAS: [string, string][] = [
  ['ARS', '$ Pesos'],
  ['USD', 'USD Dólares'],
  ['EUR', 'EUR Euros'],
]

/* Cuando lleva, casi siempre es 21. La alícuota solo aparece si el
   interruptor está prendido: preguntar "cuánto" antes de "si" hace que
   el cero parezca un valor raro en vez de una respuesta normal. */
const ALICUOTAS: [string, string][] = [
  ['21', '21 %'],
  ['10.5', '10,5 %'],
  ['27', '27 %'],
]

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

const rotulo = 'text-2xs font-medium uppercase tracking-wider text-gris-50'

export default function Plata({
  proyectoId,
  neto,
  moneda,
  alicuota,
  notaIva,
  cotizacion,
  diasDeAtraso,
}: {
  proyectoId: string
  neto: number | null
  moneda: string
  alicuota: number
  notaIva: string | null
  cotizacion: number | null
  diasDeAtraso: number | null
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nota, setNota] = useState(notaIva ?? '')

  const iva = (neto ?? 0) * (alicuota / 100)
  const total = (neto ?? 0) + iva
  const enPesos = moneda !== 'ARS' && cotizacion ? total * cotizacion : null

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo guardar.')
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3 tarjeta p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Moneda</span>
          <select
            value={moneda}
            disabled={pendiente}
            onChange={(e) => correr(() => cambiarMoneda(proyectoId, e.target.value))}
            className={`${campo} w-32`}
          >
            {MONEDAS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <span className="flex flex-col gap-0.5">
          <span className={rotulo}>IVA</span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={alicuota > 0}
              aria-label="Lleva IVA"
              disabled={pendiente}
              onClick={() =>
                correr(() => cambiarIva(proyectoId, alicuota > 0 ? '0' : '21', nota))
              }
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200
                          disabled:opacity-50 ${
                            alicuota > 0 ? 'bg-azul-hondo' : 'bg-linea-fuerte'
                          }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white transition-[left]
                            duration-200 ease-(--ease-salida) ${
                              alicuota > 0 ? 'left-[1.375rem]' : 'left-0.5'
                            }`}
                aria-hidden
              />
            </button>

            {alicuota > 0 ? (
              <select
                value={String(alicuota)}
                disabled={pendiente}
                onChange={(e) => correr(() => cambiarIva(proyectoId, e.target.value, nota))}
                className={`${campo} w-24`}
                aria-label="Alícuota"
              >
                {ALICUOTAS.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-medium text-amarillo">No aplica</span>
            )}
          </span>
        </span>

        <span className="flex flex-col gap-0.5">
          <span className={rotulo}>Cómo queda</span>
          <span className="cifra flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="text-gris">{plata(neto, moneda)} neto</span>
            {alicuota > 0 && <span className="text-gris-50">+ {plata(iva, moneda)} de IVA</span>}
            <span className="font-bold text-tinta">{plata(total, moneda)}</span>
          </span>
        </span>
      </div>

      {alicuota === 0 && (
        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Por qué no lleva IVA</span>
          <input
            value={nota}
            placeholder="Exportación de servicios, cliente exento…"
            disabled={pendiente}
            onChange={(e) => setNota(e.target.value)}
            onBlur={() =>
              nota !== (notaIva ?? '') && correr(() => cambiarIva(proyectoId, '0', nota))
            }
            className={`${campo} w-full max-w-lg`}
          />
          <span className="text-2xs text-gris-50">
            Dentro de un año nadie se acuerda, y es lo primero que pregunta el contador.
          </span>
        </label>
      )}

      {moneda !== 'ARS' && (
        <p className="border-t border-linea pt-2.5 text-2xs text-gris-50">
          {enPesos !== null ? (
            <>
              Son <span className="cifra font-medium text-tinta">{plata(enPesos)}</span> a la
              cotización de {cotizacion}
              {diasDeAtraso !== null && diasDeAtraso > 3 && (
                <span className="font-medium text-amarillo">
                  , cargada hace {diasDeAtraso} días
                </span>
              )}
              .
            </>
          ) : (
            <span className="font-medium text-amarillo">
              No hay cotización cargada para {moneda}: este monto no entra en los totales de la
              empresa.
            </span>
          )}
        </p>
      )}

      {error && <p className="text-sm text-rojo">{error}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------
   Cotizaciones. Van en administración, no en cada proyecto: es un dato
   de la empresa, no del trabajo.
   ------------------------------------------------------------------ */

export type Cotizacion = {
  codigo: string
  nombre: string
  valor: number | null
  fecha: string | null
  dias_de_atraso: number | null
}

export function Cotizaciones({ monedas }: { monedas: Cotizacion[] }) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})

  const otras = monedas.filter((m) => m.codigo !== 'ARS')

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight">Cotizaciones</h2>
        <p className="max-w-[65ch] text-sm text-gris">
          Cuántos pesos vale una unidad. Sin esto, un proyecto en dólares no se puede sumar con uno
          en pesos y los totales de la empresa mienten por omisión.
        </p>
      </div>

      <ul className="flex flex-wrap gap-3">
        {otras.map((m) => {
          const viejo = (m.dias_de_atraso ?? 999) > 3
          return (
            <li
              key={m.codigo}
              className="flex flex-col gap-1.5 tarjeta p-3"
            >
              <span className="flex items-baseline gap-2">
                <span className="text-base font-bold text-tinta">{m.codigo}</span>
                <span className="text-2xs text-gris-50">{m.nombre}</span>
              </span>

              <span className="flex items-center gap-2">
                <input
                  inputMode="decimal"
                  defaultValue={m.valor ?? ''}
                  placeholder="1450,00"
                  disabled={pendiente}
                  onChange={(e) => setValores((v) => ({ ...v, [m.codigo]: e.target.value }))}
                  className={`${campo} cifra w-28`}
                />
                <button
                  type="button"
                  disabled={pendiente || !valores[m.codigo]}
                  onClick={() => {
                    setError(null)
                    empezar(async () => {
                      const r = await anotarCotizacion(m.codigo, valores[m.codigo] ?? '')
                      if (!r.ok) setError(r.error)
                      else router.refresh()
                    })
                  }}
                  className="boton boton-principal"
                >
                  Guardar
                </button>
              </span>

              <span className={`text-2xs ${viejo ? 'font-medium text-amarillo' : 'text-gris-50'}`}>
                {m.fecha
                  ? m.dias_de_atraso === 0
                    ? 'cargada hoy'
                    : `hace ${m.dias_de_atraso} días`
                  : 'nunca se cargó'}
              </span>
            </li>
          )
        })}
      </ul>

      {error && <p className="text-sm text-rojo">{error}</p>}
    </section>
  )
}
