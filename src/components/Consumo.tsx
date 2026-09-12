'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  anotarConsumo,
  borrarConsumo,
  cambiarModalidad,
  fecharConsumo,
} from '@/app/acciones'
import { plata } from '@/lib/estados'
import { Seccion } from '@/components/ui'

/* ------------------------------------------------------------------
   Cómo se cobra este abono.

   Tres modalidades porque las tres existen, y forzar las tres a un
   monto fijo tiene una consecuencia concreta: el cashflow proyecta un
   número que no es, y la factura sale tarde porque alguien tiene que ir
   a buscar el consumo a otro lado el día que hay que emitirla.

   El monto de cada mes se calcula, no se escribe. Escribirlo a mano es
   garantizar que algún día no coincida con cantidad por precio.
   ------------------------------------------------------------------ */

export type Consumo = {
  id: string
  periodo: string
  cantidad: number
  precio_unitario: number | null
  monto: number
  notas: string | null
  facturado_at: string | null
  cobrado_at: string | null
}

const MODALIDADES: [string, string, string][] = [
  ['fijo', 'Monto fijo', 'Lo mismo todos los meses, pase lo que pase'],
  ['consumo', 'Por consumo', 'Se liquida a mes vencido según lo que se usó'],
  ['fijo_mas_consumo', 'Piso más consumo', 'Un mínimo mensual, y lo que se pase encima'],
]

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const campo = 'campo'

const rotulo = 'rotulo'

export default function Consumo({
  proyectoId,
  modalidad,
  unidad,
  precio,
  incluido,
  mensual,
  moneda,
  consumos,
  hoy,
}: {
  proyectoId: string
  modalidad: string
  unidad: string | null
  precio: number | null
  incluido: number | null
  mensual: number | null
  moneda: string
  consumos: Consumo[]
  hoy: string
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [u, setU] = useState(unidad ?? '')
  const [pr, setPr] = useState(precio != null ? String(precio) : '')
  const [inc, setInc] = useState(incluido != null ? String(incluido) : '')
  const [mes, setMes] = useState(hoy.slice(0, 7))
  const [cant, setCant] = useState('')
  const [notas, setNotas] = useState('')

  const variable = modalidad !== 'fijo'

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

  const guardarConfig = (m = modalidad) => correr(() => cambiarModalidad(proyectoId, m, u, pr, inc))

  const sinCobrar = consumos.filter((c) => !c.cobrado_at)
  const promedio =
    consumos.length > 0
      ? consumos.slice(0, 3).reduce((s, c) => s + Number(c.monto), 0) /
        Math.min(3, consumos.length)
      : 0

  return (
    <Seccion
      titulo="Cómo se cobra"
      ayuda="Un abono por consumo no se sabe hasta que el mes terminó. Cargar acá lo que se usó es lo que hace que la factura salga a tiempo y que el cashflow no proyecte un número inventado."
    >
      <div className="flex flex-wrap gap-1.5">
        {MODALIDADES.map(([v, t, ayuda]) => (
          <button
            key={v}
            type="button"
            title={ayuda}
            disabled={pendiente}
            aria-pressed={modalidad === v}
            onClick={() => guardarConfig(v)}
            className={`flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left
                        transition-colors duration-150 ${
                          modalidad === v
                            ? 'border-azul-hondo bg-azul-aire'
                            : 'border-linea hover:border-linea-fuerte'
                        }`}
          >
            <span
              className={`text-sm font-medium ${
                modalidad === v ? 'text-azul-hondo' : 'text-tinta'
              }`}
            >
              {t}
            </span>
            <span className="max-w-52 text-2xs leading-snug text-gris-50">{ayuda}</span>
          </button>
        ))}
      </div>

      {variable && (
        <div className="grid gap-4 border-t border-linea pt-3.5 sm:grid-cols-3">
          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Qué se cuenta</span>
            <input
              value={u}
              disabled={pendiente}
              onChange={(e) => setU(e.target.value)}
              onBlur={() => u !== (unidad ?? '') && guardarConfig()}
              placeholder="conversaciones"
              className={campo}
            />
            <span className="text-2xs text-gris-50">
              Sin la unidad, un número suelto no se discute con el cliente.
            </span>
          </label>

          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Cuánto vale cada una</span>
            <input
              value={pr}
              inputMode="decimal"
              disabled={pendiente}
              onChange={(e) => setPr(e.target.value)}
              onBlur={() => pr !== (precio != null ? String(precio) : '') && guardarConfig()}
              placeholder="120"
              className={`${campo} cifra`}
            />
          </label>

          {modalidad === 'fijo_mas_consumo' && (
            <label className="flex flex-col gap-0.5">
              <span className={rotulo}>Incluidas en el piso</span>
              <input
                value={inc}
                inputMode="decimal"
                disabled={pendiente}
                onChange={(e) => setInc(e.target.value)}
                onBlur={() => inc !== (incluido != null ? String(incluido) : '') && guardarConfig()}
                placeholder="500"
                className={`${campo} cifra`}
              />
              <span className="text-2xs text-gris-50">
                Recién de acá en adelante se cobra por unidad.
              </span>
            </label>
          )}
        </div>
      )}

      {error && <p className="text-sm font-medium text-rojo">{error}</p>}

      {variable && (
        <div className="flex flex-col gap-3 border-t border-linea pt-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className={rotulo}>Consumo de cada mes</span>
            <span className="cifra flex flex-wrap gap-x-4 text-2xs text-gris-50">
              {promedio > 0 && <span>promedio {plata(promedio, moneda)}</span>}
              {sinCobrar.length > 0 && (
                <span className="font-medium text-amarillo">{sinCobrar.length} sin cobrar</span>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-linea bg-panel p-3">
            <label className="flex flex-col gap-0.5">
              <span className={rotulo}>Mes</span>
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className={`${campo} cifra w-40`}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className={rotulo}>{u || 'Cantidad'}</span>
              <input
                value={cant}
                inputMode="decimal"
                onChange={(e) => setCant(e.target.value)}
                placeholder="0"
                className={`${campo} cifra w-28`}
              />
            </label>
            <label className="flex min-w-44 flex-1 flex-col gap-0.5">
              <span className={rotulo}>Nota</span>
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Mes con la campaña de septiembre"
                className={campo}
              />
            </label>
            <button
              type="button"
              disabled={pendiente || !cant}
              onClick={() =>
                correr(
                  () => anotarConsumo(proyectoId, `${mes}-01`, cant, notas),
                  () => {
                    setCant('')
                    setNotas('')
                  },
                )
              }
              className="boton boton-principal"
            >
              {pendiente ? 'Guardando…' : 'Cerrar el mes'}
            </button>
          </div>

          {consumos.length === 0 ? (
            <p className="text-sm text-gris">
              Todavía no se cerró ningún mes. Hasta que se cargue uno, este abono no aporta nada al
              cashflow.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {consumos.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border
                             border-linea bg-superficie px-3.5 py-2"
                >
                  <span className="cifra w-20 shrink-0 text-2xs font-medium uppercase tracking-wider text-gris-50">
                    {MESES[Number(c.periodo.slice(5, 7)) - 1]} {c.periodo.slice(2, 4)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="cifra block text-sm text-tinta">
                      {Number(c.cantidad)} {u || 'unidades'}
                      {c.precio_unitario ? (
                        <span className="text-2xs text-gris-50">
                          {' '}
                          × {plata(c.precio_unitario, moneda)}
                        </span>
                      ) : null}
                    </span>
                    {c.notas && (
                      <span className="block truncate text-2xs text-gris-50">{c.notas}</span>
                    )}
                  </span>

                  <span className="cifra w-28 shrink-0 text-right text-sm font-bold text-tinta">
                    {plata(c.monto, moneda)}
                  </span>

                  <span className="flex shrink-0 items-center gap-1.5">
                    <input
                      type="date"
                      aria-label="Facturado"
                      defaultValue={c.facturado_at ?? ''}
                      disabled={pendiente}
                      onChange={(e) => correr(() => fecharConsumo(c.id, 'facturado_at', e.target.value))}
                      className={`${campo} cifra w-32 ${c.facturado_at ? 'border-azul-hondo' : ''}`}
                      title="Cuándo se facturó"
                    />
                    <input
                      type="date"
                      aria-label="Cobrado"
                      defaultValue={c.cobrado_at ?? ''}
                      disabled={pendiente}
                      onChange={(e) => correr(() => fecharConsumo(c.id, 'cobrado_at', e.target.value))}
                      className={`${campo} cifra w-32 ${c.cobrado_at ? 'border-verde' : ''}`}
                      title="Cuándo se cobró"
                    />
                    <button
                      type="button"
                      aria-label="Borrar el mes"
                      disabled={pendiente}
                      onClick={() => correr(() => borrarConsumo(c.id))}
                      className="text-sm leading-none text-gris-50 transition-colors duration-150 hover:text-rojo"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!variable && (
        <p className="border-t border-linea pt-3.5 text-sm text-gris">
          Monto fijo: <span className="cifra font-medium text-tinta">{plata(mensual, moneda)}</span>{' '}
          por mes. El IVA y la conversión a pesos están abajo, con el resto de la plata.
        </p>
      )}
    </Seccion>
  )
}
