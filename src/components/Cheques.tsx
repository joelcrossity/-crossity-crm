'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { borrarCheque, cambiarEstadoCheque, registrarCheque } from '@/app/acciones'
import { plata, fechaCorta } from '@/lib/estados'

/* ------------------------------------------------------------------
   Cheques.

   Un cheque a noventa días es plata que existe y todavía no está. Sin
   registrarlo pasa una de dos: se cuenta como cobrado —y no lo está— o
   se olvida en un cajón hasta que alguien pregunta.

   El estado se cambia en la misma fila, como en SUINO: obligar a entrar
   a una ficha para decir "se acreditó" hace que nadie lo diga.
   ------------------------------------------------------------------ */

export type Cheque = {
  id: string
  tipo: string
  numero: string
  banco: string | null
  importe: number
  moneda: string
  fecha_cobro: string
  estado: string
  es_echeq: boolean
  organizacion_id: string | null
}

const ESTADOS: [string, string][] = [
  ['en_cartera', 'En cartera'],
  ['depositado', 'Depositado'],
  ['entregado', 'Entregado a un tercero'],
  ['acreditado', 'Acreditado'],
  ['rechazado', 'Rechazado'],
]

const TONO: Record<string, string> = {
  en_cartera: 'text-azul-hondo',
  depositado: 'text-amarillo',
  entregado: 'text-gris',
  acreditado: 'text-verde',
  rechazado: 'text-rojo',
}

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

export default function Cheques({
  cheques,
  clientes,
}: {
  cheques: Cheque[]
  clientes: { id: string; nombre: string }[]
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [soloAbiertos, setSoloAbiertos] = useState(true)

  const visibles = soloAbiertos
    ? cheques.filter((c) => c.estado === 'en_cartera' || c.estado === 'depositado')
    : cheques

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>, alTerminar?: () => void) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo guardar.')
      else {
        alTerminar?.()
        router.refresh()
      }
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-md font-bold tracking-tight">Cheques</h2>
          <p className="max-w-[65ch] text-sm text-gris">
            Plata que existe y todavía no está. Cada uno entra en la agenda el día que se cobra.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSoloAbiertos((v) => !v)}
            className="boton boton-secundario boton-chico"
          >
            {soloAbiertos ? 'Ver todos' : 'Solo los abiertos'}
          </button>
          {!abierto && (
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="rounded-md bg-azul-hondo px-3 py-1.5 text-sm font-medium text-white
                         transition-colors duration-150 hover:bg-azul"
            >
              Registrar cheque
            </button>
          )}
        </div>
      </div>

      {abierto && (
        <form
          action={(fd) => correr(() => registrarCheque(fd), () => setAbierto(false))}
          className="surge flex flex-wrap items-end gap-2 rounded-lg border border-azul bg-azul-aire p-3"
        >
          <select name="tipo" defaultValue="recibido" className={`${campo} w-36`} aria-label="Tipo">
            <option value="recibido">Recibido</option>
            <option value="emitido">Emitido</option>
          </select>
          <input name="numero" required placeholder="N° de cheque" className={`${campo} w-36`} autoFocus />
          <input name="banco" placeholder="Banco" className={`${campo} w-44`} />
          <input
            name="importe"
            required
            inputMode="decimal"
            placeholder="Importe"
            className={`${campo} cifra w-32`}
          />
          <label className="flex flex-col gap-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
              Se cobra el
            </span>
            <input name="fecha_cobro" type="date" required className={`${campo} cifra w-40`} />
          </label>
          <select name="organizacion_id" defaultValue="" className={`${campo} w-52`} aria-label="De quién">
            <option value="">Sin cliente asociado</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 px-1 text-sm text-gris">
            <input name="es_echeq" type="checkbox" className="size-3.5 accent-[var(--color-azul-hondo)]" />
            e-cheq
          </label>

          <button
            type="submit"
            disabled={pendiente}
            className="boton boton-principal"
          >
            {pendiente ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="boton boton-sutil"
          >
            Cancelar
          </button>
        </form>
      )}

      {error && <p className="text-sm text-rojo">{error}</p>}

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-linea bg-superficie px-3.5 py-3 text-sm text-gris">
          {soloAbiertos ? 'No hay cheques en cartera ni depositados.' : 'Todavía no se cargó ninguno.'}
        </p>
      ) : (
        <ul className="escalona flex flex-col gap-1.5">
          {visibles.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-linea
                         bg-superficie px-3.5 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-tinta">
                  {c.tipo === 'recibido' ? 'Recibido' : 'Emitido'} · N.º {c.numero}
                  {c.es_echeq && (
                    <span className="ml-2 text-2xs font-normal text-gris-50">e-cheq</span>
                  )}
                </span>
                <span className="cifra block truncate text-2xs text-gris-50">
                  {c.banco ?? 'sin banco'} · se cobra el {fechaCorta(c.fecha_cobro)}
                </span>
              </span>

              <span className="cifra shrink-0 text-sm font-medium text-tinta">
                {plata(c.importe, c.moneda)}
              </span>

              <select
                value={c.estado}
                disabled={pendiente}
                aria-label={`Estado del cheque ${c.numero}`}
                onChange={(e) => correr(() => cambiarEstadoCheque(c.id, e.target.value))}
                className={`shrink-0 rounded-md border border-linea bg-superficie px-2 py-1 text-2xs
                            font-medium transition-colors duration-150 hover:border-linea-fuerte
                            focus:border-azul ${TONO[c.estado]}`}
              >
                {ESTADOS.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>

              <button
                type="button"
                aria-label="Borrar cheque"
                disabled={pendiente}
                onClick={() => correr(() => borrarCheque(c.id))}
                className="shrink-0 text-sm leading-none text-gris-50 transition-colors duration-150 hover:text-rojo"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
