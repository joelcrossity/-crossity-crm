'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { guardarReparto, quitarReparto } from '@/app/acciones'
import { plata } from '@/lib/estados'

/* ------------------------------------------------------------------
   Cómo se reparte la plata de este trabajo.

   Era la pieza que faltaba, y explica buena parte de la confusión: el
   sistema venía calculando porciones, liquidaciones y "cuánto queda
   para Crossity" a partir de participaciones que no se podían ver ni
   cargar desde ninguna pantalla. Un número que sale de algo invisible
   no se puede creer, y termina no mirándose.

   El porcentaje se aplica sobre la base de reparto —lo que queda
   después de gastos e impuestos—, no sobre el precio al cliente. Eso
   se dice acá porque es la primera pregunta que hace cualquiera.
   ------------------------------------------------------------------ */

export type Parte = {
  id: string
  concepto: string
  porcentaje: number
  apertura: string
  es_crossity: boolean
  persona_id: string | null
  quien: string
  devengado: number
  ya_movio: number
}

const CONCEPTOS: [string, string][] = [
  ['desarrollo', 'Desarrollo'],
  ['gestion', 'Gestión'],
  ['venta', 'Venta'],
  ['referido', 'Referido'],
  ['diseno', 'Diseño'],
  ['otro', 'Otro'],
]

const NOMBRE = new Map(CONCEPTOS)

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

const rotulo = 'text-2xs font-medium uppercase tracking-wider text-gris-50'

export default function Reparto({
  proyectoId,
  partes,
  personas,
  moneda,
  puedeEditar,
}: {
  proyectoId: string
  partes: Parte[]
  personas: { id: string; nombre: string }[]
  moneda: string
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [quien, setQuien] = useState('')
  const [concepto, setConcepto] = useState('desarrollo')
  const [pct, setPct] = useState('')
  const [apertura, setApertura] = useState('cerrada')

  const total = partes.reduce((s, p) => s + Number(p.porcentaje), 0)

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
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-md font-bold tracking-tight">Cómo se reparte</h2>
          <p className="max-w-[70ch] text-sm text-gris">
            El porcentaje se aplica sobre lo que queda después de gastos e impuestos, no sobre el
            precio al cliente. De acá salen las liquidaciones de cada uno.
          </p>
        </div>
        {puedeEditar && !abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="shrink-0 rounded-md border border-linea-fuerte px-2.5 py-1 text-sm
                       font-medium text-gris transition-colors duration-150
                       hover:border-azul hover:text-azul-hondo"
          >
            Sumar una parte
          </button>
        )}
      </div>

      {error && <p className="text-sm font-medium text-rojo">{error}</p>}

      {abierto && (
        <div className="surge flex flex-wrap items-end gap-2 rounded-lg border border-azul bg-azul-aire p-3">
          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>De quién</span>
            <select value={quien} onChange={(e) => setQuien(e.target.value)} className={`${campo} w-52`}>
              <option value="">elegí…</option>
              <option value="casa">Crossity (la casa)</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Por qué</span>
            <select
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className={`${campo} w-36`}
            >
              {CONCEPTOS.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Cuánto</span>
            <span className="flex items-center gap-1">
              <input
                value={pct}
                inputMode="decimal"
                onChange={(e) => setPct(e.target.value)}
                placeholder="70"
                className={`${campo} cifra w-20`}
              />
              <span className="text-sm text-gris-50">%</span>
            </span>
          </label>

          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Qué ve</span>
            <select
              value={apertura}
              onChange={(e) => setApertura(e.target.value)}
              className={`${campo} w-52`}
            >
              <option value="cerrada">Solo lo suyo</option>
              <option value="abierta">Todo el proyecto</option>
            </select>
          </label>

          <button
            type="button"
            disabled={pendiente || !quien || !pct}
            onClick={() =>
              correr(
                () => guardarReparto(proyectoId, quien, concepto, pct, apertura),
                () => {
                  setQuien('')
                  setPct('')
                  setAbierto(false)
                },
              )
            }
            className="rounded-md bg-azul-hondo px-3 py-1.5 text-sm font-medium text-white
                       transition-colors duration-150 hover:bg-azul disabled:opacity-40"
          >
            {pendiente ? 'Guardando…' : 'Sumarla'}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="px-2 py-1.5 text-sm text-gris hover:text-tinta"
          >
            Cancelar
          </button>
        </div>
      )}

      {partes.length === 0 ? (
        <p className="rounded-lg border border-amarillo bg-amarillo-aire px-3.5 py-3 text-sm text-tinta">
          Sin reparto cargado, todo lo que entra queda como de Crossity y nadie tiene liquidación.
          Si en este trabajo participa alguien más, cargalo acá.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {partes.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border
                           border-linea bg-superficie px-3.5 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-tinta">
                    {p.quien}
                    {p.es_crossity && (
                      <span className="ml-2 text-2xs font-normal text-gris-50">la casa</span>
                    )}
                  </span>
                  <span className="block truncate text-2xs text-gris-50">
                    {NOMBRE.get(p.concepto) ?? p.concepto}
                    {' · '}
                    {p.apertura === 'abierta' ? 've todo el proyecto' : 've solo lo suyo'}
                  </span>
                </span>

                {Number(p.devengado) > 0 && (
                  <span className="cifra shrink-0 text-2xs text-gris">
                    {plata(p.devengado, moneda)} generados
                  </span>
                )}

                <span className="cifra w-16 shrink-0 text-right text-base font-bold text-tinta">
                  {Number(p.porcentaje)} %
                </span>

                {puedeEditar && (
                  <button
                    type="button"
                    aria-label={`Sacar a ${p.quien}`}
                    title={
                      p.ya_movio > 0
                        ? 'Ya se le liquidó o hay plata lista para transferirle'
                        : `Sacar a ${p.quien}`
                    }
                    disabled={pendiente}
                    onClick={() => correr(() => quitarReparto(p.id))}
                    className="shrink-0 text-sm leading-none text-gris-50 transition-colors
                               duration-150 hover:text-rojo"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>

          <p
            className={`text-2xs ${
              total === 100 ? 'text-gris-50' : 'font-medium text-amarillo'
            }`}
          >
            {total === 100
              ? 'Suma 100 %: el reparto está cerrado.'
              : total < 100
                ? `Suma ${total} %. Falta ${100 - total} % por asignar, y esa parte queda sin dueño.`
                : `Suma ${total} %, que es más de lo que hay. Revisalo antes de liquidar.`}
          </p>
        </>
      )}
    </section>
  )
}
