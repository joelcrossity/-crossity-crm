'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cambiarVigencia, cerrarMantenimiento, reabrirMantenimiento } from '@/app/acciones'
import { plata, fechaCorta } from '@/lib/estados'

/* ------------------------------------------------------------------
   La vigencia de un abono.

   Un proyecto se entrega; un abono se da de baja. Son cosas distintas y
   por eso tienen caminos distintos: marcar un abono como "perdido"
   diría que salió mal, cuando lo normal es que simplemente terminó.

   "Hasta" vacío es lo correcto en un abono vigente: no tiene fecha de
   fin, tiene fecha de baja, y esa fecha se sabe el día que se da.
   ------------------------------------------------------------------ */

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

const rotulo = 'text-2xs font-medium uppercase tracking-wider text-gris-50'

export default function Abono({
  proyectoId,
  desde,
  hasta,
  mensual,
  moneda,
  cerrado,
  cobrado,
  hoy,
}: {
  proyectoId: string
  desde: string | null
  hasta: string | null
  mensual: number | null
  moneda: string
  cerrado: boolean
  cobrado: number
  hoy: string
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [cerrando, setCerrando] = useState(false)
  const [fecha, setFecha] = useState(hoy)
  const [motivo, setMotivo] = useState('')

  // Meses corridos: es la cifra que dice si el abono ya se pagó solo.
  const meses =
    desde && hoy
      ? Math.max(
          0,
          (Number(hoy.slice(0, 4)) - Number(desde.slice(0, 4))) * 12 +
            (Number(hoy.slice(5, 7)) - Number(desde.slice(5, 7))),
        )
      : 0

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>, luego?: () => void) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo guardar.')
      else {
        luego?.()
        router.refresh()
      }
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-linea bg-superficie p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Vigente desde</span>
          <input
            type="date"
            defaultValue={desde ?? ''}
            disabled={pendiente}
            onChange={(e) => correr(() => cambiarVigencia(proyectoId, 'vigencia_desde', e.target.value))}
            className={`${campo} cifra`}
          />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Hasta</span>
          <input
            type="date"
            defaultValue={hasta ?? ''}
            disabled={pendiente}
            onChange={(e) => correr(() => cambiarVigencia(proyectoId, 'vigencia_hasta', e.target.value))}
            className={`${campo} cifra`}
          />
          <span className="text-2xs text-gris-50">
            {hasta
              ? 'Después de esta fecha deja de contarse.'
              : 'Vacío es lo normal: un abono vigente no tiene fin, tiene baja.'}
          </span>
        </label>

        <span className="flex flex-col gap-0.5">
          <span className={rotulo}>Lleva andando</span>
          <span className="cifra text-lg font-bold text-tinta">
            {meses} {meses === 1 ? 'mes' : 'meses'}
          </span>
          <span className="text-2xs text-gris-50">
            {desde ? `desde ${fechaCorta(desde)}` : 'sin fecha de inicio'}
          </span>
        </span>

        <span className="flex flex-col gap-0.5">
          <span className={rotulo}>Generó en total</span>
          <span className="cifra text-lg font-bold text-tinta">
            {plata((mensual ?? 0) * meses, moneda)}
          </span>
          <span className="cifra text-2xs text-gris-50">
            {cobrado > 0 ? `${plata(cobrado, moneda)} cobrados` : 'sin cobros registrados'}
          </span>
        </span>
      </div>

      {error && <p className="text-sm font-medium text-rojo">{error}</p>}

      <div className="border-t border-linea pt-3.5">
        {cerrado ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gris">
              Este abono está dado de baja
              {hasta && <span className="cifra"> desde el {fechaCorta(hasta)}</span>}.
            </span>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => reabrirMantenimiento(proyectoId))}
              className="rounded-md border border-linea-fuerte px-3 py-1.5 text-sm font-medium
                         text-gris transition-colors duration-150 hover:border-azul
                         hover:text-azul-hondo disabled:opacity-50"
            >
              Volver a activarlo
            </button>
          </div>
        ) : cerrando ? (
          <div className="surge flex flex-col gap-2.5">
            <span className="flex flex-col gap-0.5">
              <span className={rotulo}>Dar de baja</span>
              <span className="max-w-[65ch] text-sm text-gris">
                Deja de contarse como ingreso mensual a partir de la fecha. No se marca perdido:
                perdido diría que salió mal, y lo normal es que simplemente terminó.
              </span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={`${campo} cifra w-40`}
              />
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Por qué se da de baja"
                className={`${campo} w-72`}
              />
              <button
                type="button"
                disabled={pendiente}
                onClick={() =>
                  correr(() => cerrarMantenimiento(proyectoId, fecha, motivo), () => setCerrando(false))
                }
                className="rounded-md bg-naranja px-3.5 py-1.5 text-sm font-medium text-white
                           transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
              >
                Darlo de baja
              </button>
              <button
                type="button"
                onClick={() => setCerrando(false)}
                className="px-2 py-1.5 text-sm text-gris hover:text-tinta"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCerrando(true)}
            className="rounded-md border border-linea px-3 py-1.5 text-sm text-gris
                       transition-colors duration-150 hover:border-naranja hover:text-naranja"
          >
            Dar de baja este abono
          </button>
        )}
      </div>
    </section>
  )
}
