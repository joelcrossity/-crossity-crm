'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ganarOportunidad, guardarCotizacion } from '@/app/acciones'
import { plata } from '@/lib/estados'
import type { Etapa } from '@/components/Cotizador'

/* ------------------------------------------------------------------
   Ganar una oportunidad: qué arranca y para cuándo.

   Son las dos preguntas que hasta ahora no se hacían y terminaban
   resolviéndose mal. La primera: el cliente aprobó tres etapas y pidió
   arrancar con una, así que meter las tres en ejecución llena el
   tablero de trabajo que nadie está haciendo y promete plata que nadie
   va a facturar este mes.

   La segunda: las fechas. En el pipeline no se piden a propósito
   —mientras se negocia no hay contra qué comprometerse— pero al pasar a
   proyecto dejan de ser opcionales. Una entrega sin fecha no entra en
   la previsión de cobros, no le aparece a nadie en su calendario y no
   dispara ningún aviso: existe en la base y no existe en la operación.

   Por eso el paso es obligatorio y no un recordatorio para después.
   ------------------------------------------------------------------ */

export default function ConvertirAProyecto({
  op,
  etapas,
  hoy,
  alCerrar,
}: {
  op: { id: string; codigo: string; nombre: string; cliente: string; moneda: string }
  etapas: Etapa[]
  hoy: string
  alCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [inicio, setInicio] = useState(hoy)
  const [elegidas, setElegidas] = useState<Set<string>>(
    // La primera arranca sola: es lo que pasa casi siempre.
    new Set(etapas[0]?.id ? [etapas[0].id] : []),
  )
  const [fechas, setFechas] = useState<Record<string, string>>({})

  const conId = etapas.filter((e) => e.id)
  const activas = conId.filter((e) => elegidas.has(e.id!))
  const total = activas.reduce((s, e) => s + (Number(e.monto) || 0), 0)
  const quedan = conId.filter((e) => !elegidas.has(e.id!))
  const faltaFecha = activas.filter((e) => !fechas[e.id!])

  function alternar(id: string) {
    setElegidas((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function convertir() {
    setError(null)
    if (activas.length === 0) return setError('Elegí al menos una etapa para arrancar.')
    if (faltaFecha.length > 0)
      return setError('Faltan las fechas de entrega de las etapas que arrancan.')

    empezar(async () => {
      /* Las fechas van antes de ganar: una vez activa, el cotizador no
         puede tocar la etapa —tiene plata repartida— así que la fecha
         hay que dejarla puesta mientras todavía es propuesta. */
      const r = await guardarCotizacion(
        op.id,
        conId.map((e, i) => ({
          id: e.id,
          orden: i + 1,
          titulo: e.titulo,
          entregable: e.entregable,
          monto: Number(e.monto) || 0,
          moneda: e.moneda,
          casa: e.casa,
          cotizacion: e.cotizacion ?? null,
          vence: fechas[e.id!] || null,
        })),
      )
      if (!r.ok) return setError(r.error)

      const s = await ganarOportunidad(op.id, 'cincuenta_cincuenta', [...elegidas])
      if (!s.ok) return setError(s.error)
      if (s.ir) router.push(s.ir)
      alCerrar()
    })
  }

  return (
    <div className="fixed inset-0 z-(--z-modal) grid place-items-center p-5">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={alCerrar}
        className="absolute inset-0 bg-tinta/20 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pasar a proyecto"
        className="surge tarjeta relative flex max-h-full w-full max-w-xl flex-col gap-4
                   overflow-y-auto p-5 shadow-[var(--sombra-flotante)]"
      >
        <div className="flex flex-col gap-0.5">
          <span className="rotulo">{op.cliente}</span>
          <h2 className="text-base font-bold tracking-tight text-tinta">
            {op.nombre} pasa a proyecto
          </h2>
          <p className="text-2xs text-gris">
            Elegí qué se arranca ahora. Lo demás queda cotizado y a la espera: el precio ya está
            acordado y el cliente ya lo vio.
          </p>
        </div>

        <label className="flex w-fit flex-col gap-0.5">
          <span className="rotulo">Arranca el</span>
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="campo cifra w-44"
          />
        </label>

        {conId.length === 0 ? (
          <p className="rounded-md border border-amarillo bg-amarillo-aire px-3 py-2 text-2xs text-tinta">
            Esta oportunidad no tiene etapas cotizadas, así que las entregas se van a generar con
            el esquema 50 / 50 y sin fechas. Conviene cotizarla antes.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {conId.map((e) => {
              const marcada = elegidas.has(e.id!)
              return (
                <li
                  key={e.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5
                              transition-colors duration-150 ${
                                marcada ? 'border-azul bg-azul-aire' : 'border-linea'
                              }`}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() => alternar(e.id!)}
                    aria-label={`Arrancar ${e.titulo}`}
                    className="size-4 shrink-0 accent-[var(--color-azul-hondo)]"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-tinta">{e.titulo}</span>
                    {e.entregable && (
                      <span className="block truncate text-2xs text-gris-50">{e.entregable}</span>
                    )}
                  </span>

                  <span className="cifra shrink-0 text-sm font-medium text-tinta">
                    {plata(Number(e.monto), e.moneda)}
                  </span>

                  {marcada ? (
                    <label className="flex shrink-0 items-center gap-1.5">
                      <span className="text-2xs text-gris-50">entrega</span>
                      <input
                        type="date"
                        value={fechas[e.id!] ?? ''}
                        onChange={(x) => setFechas({ ...fechas, [e.id!]: x.target.value })}
                        className={`campo cifra w-36 ${!fechas[e.id!] ? 'border-amarillo' : ''}`}
                      />
                    </label>
                  ) : (
                    <span className="shrink-0 text-2xs text-gris-50">queda cotizada</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-linea pt-3">
          <span className="text-2xs text-gris-50">
            {quedan.length > 0
              ? `${quedan.length} ${quedan.length === 1 ? 'etapa queda' : 'etapas quedan'} para más adelante`
              : 'arrancan todas'}
          </span>
          <span className="cifra text-lg font-bold text-tinta">
            {plata(total, op.moneda)} arrancan
          </span>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-2xs text-rojo">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={convertir}
            disabled={pendiente}
            className="boton boton-principal flex-1 justify-center"
          >
            {pendiente ? 'Pasando…' : 'Pasar a proyecto'}
          </button>
          <button type="button" onClick={alCerrar} className="boton boton-sutil">
            Cancelar
          </button>
        </div>

        <p className="text-2xs text-gris-50">
          Las fechas no son un trámite: una entrega sin fecha no entra en la previsión de cobros,
          no le aparece a nadie en su calendario y no dispara ningún aviso.
        </p>
      </div>
    </div>
  )
}
