'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ganarOportunidad, guardarPropuesta, leerPropuesta } from '@/app/acciones'
import type { EtapaPropuesta } from '@/app/acciones'
import { plata } from '@/lib/estados'

/* ------------------------------------------------------------------
   Ganar una oportunidad: qué etapas arrancan y para cuándo.

   Se elige por etapa y no por cuota, porque una etapa es lo que el
   cliente aprueba entero: no compra la mitad de un alcance. Lo que no
   arranca queda cotizado y esperando, con su precio ya acordado.

   Las fechas dejan de ser opcionales acá. En el pipeline no se piden a
   propósito —mientras se negocia no hay contra qué comprometerse— pero
   una cuota sin fecha no entra en la previsión de cobros, no le aparece
   a nadie en su calendario y no dispara ningún aviso: existe en la base
   y no existe en la operación.

   Una etapa sin cuotas no se puede arrancar. Tiene precio y no tiene
   forma de pago, y poner trabajo en ejecución sin saber cuándo se cobra
   es exactamente cómo se llega a fin de mes sin haber facturado.
   ------------------------------------------------------------------ */

export default function ConvertirAProyecto({
  op,
  hoy,
  alCerrar,
}: {
  op: { id: string; codigo: string; nombre: string; cliente: string; moneda: string }
  hoy: string
  alCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [etapas, setEtapas] = useState<EtapaPropuesta[]>([])
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [inicio, setInicio] = useState(hoy)
  const [fechas, setFechas] = useState<Record<string, string>>({})

  useEffect(() => {
    let vivo = true
    leerPropuesta(op.id).then((r) => {
      if (!vivo) return
      if (r.ok) {
        setEtapas(r.etapas)
        // La primera que tenga cuotas arranca sola: es lo que pasa casi
        // siempre, y deja la decisión en sacarla y no en ponerla.
        const primera = r.etapas.find((e) => e.cuotas.length > 0)
        if (primera?.id) setElegidas(new Set([primera.id]))
      } else setError(r.error)
      setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [op.id])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [alCerrar])

  const conId = etapas.filter((e) => e.id)
  const activas = conId.filter((e) => elegidas.has(e.id!))
  const total = activas.reduce(
    (s, e) => s + e.cuotas.reduce((t, q) => t + (Number(q.monto) || 0), 0),
    0,
  )
  const cuotasActivas = activas.flatMap((e) => e.cuotas)
  const sinFecha = cuotasActivas.filter((q) => q.id && !fechas[q.id]).length

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
    if (sinFecha > 0) return setError('Faltan fechas de entrega en las cuotas que arrancan.')

    empezar(async () => {
      /* Las fechas se guardan antes de ganar: una vez activa, la cuota
         tiene plata repartida y ya no se puede editar desde acá. */
      const r = await guardarPropuesta(
        op.id,
        etapas.map((e) => ({
          ...e,
          cuotas: e.cuotas.map((q) => ({
            ...q,
            vence: q.id && fechas[q.id] ? fechas[q.id] : q.vence ?? null,
          })),
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
        className="surge tarjeta riel relative flex max-h-full w-full max-w-2xl flex-col gap-4
                   overflow-y-auto p-5 shadow-[var(--sombra-flotante)]"
      >
        <div className="flex flex-col gap-0.5">
          <span className="rotulo">{op.cliente}</span>
          <h2 className="text-base font-bold tracking-tight text-tinta">
            {op.nombre} pasa a proyecto
          </h2>
          <p className="text-2xs text-gris">
            Elegí qué etapas arrancan. Las demás quedan cotizadas y esperando: el precio ya está
            acordado y el cliente ya las vio.
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

        {cargando ? (
          <p className="px-3 py-6 text-center text-2xs text-gris-50">Cargando la propuesta…</p>
        ) : conId.length === 0 ? (
          <p className="rounded-md border border-amarillo bg-amarillo-aire px-3 py-2 text-2xs text-tinta">
            Esta oportunidad no tiene una propuesta cargada, así que las entregas se van a generar
            con el esquema 50 / 50 y sin fechas. Conviene cotizarla antes, desde el lápiz.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {conId.map((e) => {
              const marcada = elegidas.has(e.id!)
              const suTotal = e.cuotas.reduce((s, q) => s + (Number(q.monto) || 0), 0)
              const sinCuotas = e.cuotas.length === 0

              return (
                <li
                  key={e.id}
                  className={`flex flex-col gap-2 rounded-lg border px-3 py-2.5
                              transition-colors duration-150 ${
                                marcada ? 'border-azul bg-azul-aire' : 'border-linea'
                              }`}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <input
                      type="checkbox"
                      checked={marcada}
                      disabled={sinCuotas}
                      onChange={() => alternar(e.id!)}
                      aria-label={`Arrancar ${e.nombre}`}
                      className="size-4 shrink-0 accent-[var(--color-azul-hondo)] disabled:opacity-30"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-tinta">
                        {e.nombre}
                      </span>
                      {e.alcance && (
                        <span className="block truncate text-2xs text-gris-50">{e.alcance}</span>
                      )}
                    </span>
                    <span className="cifra shrink-0 text-sm font-bold text-tinta">
                      {plata(suTotal, op.moneda)}
                    </span>
                  </div>

                  {/* Sin cuotas no se puede arrancar: poner trabajo en
                      ejecución sin saber cuándo se cobra es cómo se
                      llega a fin de mes sin haber facturado. */}
                  {sinCuotas ? (
                    <span className="text-2xs text-amarillo">
                      Sin forma de pago definida. Volvé al lápiz y repartí el total en cuotas para
                      poder arrancarla.
                    </span>
                  ) : marcada ? (
                    <ul className="flex flex-col gap-1 border-t border-linea pt-2">
                      {e.cuotas.map((q) => (
                        <li key={q.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="min-w-0 flex-1 truncate text-2xs text-gris">
                            {q.titulo}
                          </span>
                          <span className="cifra shrink-0 text-2xs text-tinta">
                            {plata(Number(q.monto), op.moneda)}
                          </span>
                          <label className="flex shrink-0 items-center gap-1.5">
                            <span className="text-2xs text-gris-50">vence</span>
                            <input
                              type="date"
                              value={fechas[q.id!] ?? q.vence ?? ''}
                              onChange={(x) => setFechas({ ...fechas, [q.id!]: x.target.value })}
                              className={`campo cifra w-36 ${
                                !(fechas[q.id!] ?? q.vence) ? 'border-amarillo' : ''
                              }`}
                            />
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-2xs text-gris-50">
                      {e.cuotas.length} cuota{e.cuotas.length > 1 ? 's' : ''} · queda cotizada
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-linea pt-3">
          <span className="text-2xs text-gris-50">
            {conId.length - activas.length > 0
              ? `${conId.length - activas.length} ${
                  conId.length - activas.length === 1 ? 'etapa queda' : 'etapas quedan'
                } para más adelante`
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
            disabled={pendiente || cargando}
            className="boton boton-principal flex-1 justify-center"
          >
            {cargando ? 'Cargando…' : pendiente ? 'Pasando…' : 'Pasar a proyecto'}
          </button>
          <button type="button" onClick={alCerrar} className="boton boton-sutil">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
