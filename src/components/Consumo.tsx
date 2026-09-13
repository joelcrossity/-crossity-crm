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
  usado: number
  incluido: number | null
  unidad: string | null
  bloques: number
  max_bloques: number | null
  requiere_upgrade: boolean
  notas: string | null
  facturado_at: string | null
  cobrado_at: string | null
  moneda: string
  /* En null si la persona no tiene ver_rentabilidad_mantenimientos.
     No los tapa esta pantalla: no le llegan. */
  base: number | null
  excedente: number | null
  facturado: number | null
  costo_meta: number | null
  costo_ia: number | null
  costo_otros: number | null
  costo_total: number | null
  margen: number | null
  margen_pct: number | null
  ve_la_plata: boolean
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
  puedeVerLaPlata,
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
  puedeVerLaPlata?: boolean
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
  const [cMeta, setCMeta] = useState('')
  const [cIa, setCIa] = useState('')
  const [cOtros, setCOtros] = useState('')

  const variable = modalidad !== 'fijo'
  /* Lo dice la base, no el rol de esta pantalla. Y si todavía no hay
     ningún mes cargado no se puede deducir de las filas, así que la
     página lo pregunta y lo pasa. */
  const veLaPlata = puedeVerLaPlata ?? (consumos[0]?.ve_la_plata ?? false)

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
  /* Solo con los meses cuyo monto llegó: promediar tratando los tapados
     como cero daría un promedio falso y más bajo. */
  const conMonto = consumos.slice(0, 3).filter((c) => c.facturado != null)
  const promedio =
    conMonto.length > 0
      ? conMonto.reduce((s, c) => s + Number(c.facturado), 0) / conMonto.length
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
                  () => anotarConsumo(proyectoId, `${mes}-01`, cant, notas,
                    { meta: cMeta, ia: cIa, otros: cOtros }),
                  () => {
                    setCant('')
                    setNotas('')
                    setCMeta('')
                    setCIa('')
                    setCOtros('')
                  },
                )
              }
              className="boton boton-principal"
            >
              {pendiente ? 'Guardando…' : 'Cerrar el mes'}
            </button>

            {/* Lo que costó atender el mes. Solo lo ve —y lo carga—
                quien tiene el permiso de rentabilidad: a quien no, ni
                le llega el dato ni tiene sentido pedirle que lo cargue.

                Dejarlos vacíos es válido y no es lo mismo que cero: la
                factura de Meta llega después de cerrar el mes, así que
                se carga primero el consumo y los costos cuando lleguen.
                Un vacío no pisa lo que ya estaba. */}
            {veLaPlata && (
              <div className="flex w-full flex-wrap items-end gap-2 border-t border-linea pt-3">
                <span className="w-full text-2xs text-gris-50">
                  Lo que costó atender el mes. Se puede dejar vacío y completar cuando lleguen las
                  facturas: vacío no borra lo ya cargado.
                </span>
                {([
                  ['Meta / WhatsApp', cMeta, setCMeta],
                  ['Créditos de IA', cIa, setCIa],
                  ['Servidores y otros', cOtros, setCOtros],
                ] as const).map(([et, val, set]) => (
                  <label key={et} className="flex flex-col gap-0.5">
                    <span className={rotulo}>{et}</span>
                    <input
                      value={val}
                      inputMode="decimal"
                      onChange={(e) => set(e.target.value)}
                      placeholder="—"
                      className={`${campo} cifra w-32`}
                    />
                  </label>
                ))}
              </div>
            )}
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
                      {Number(c.usado)}
                      {c.incluido ? (
                        <span className="text-gris-50"> / {Number(c.incluido)}</span>
                      ) : null}{' '}
                      {c.unidad || u || 'unidades'}
                      {c.bloques > 0 && (
                        <span className="ml-2 text-2xs text-amarillo">
                          +{c.bloques} bloque{c.bloques > 1 ? 's' : ''}
                        </span>
                      )}
                    </span>
                    {c.requiere_upgrade ? (
                      <span className="block text-2xs font-medium text-rojo">
                        Pasó el máximo de {c.max_bloques} bloques: conviene ofrecerle el plan que
                        sigue.
                      </span>
                    ) : (
                      c.notas && (
                        <span className="block truncate text-2xs text-gris-50">{c.notas}</span>
                      )
                    )}
                  </span>

                  {/* Sin permiso, acá no hay un cero: no hay nada, y se
                      dice por qué en vez de dejar un hueco mudo. */}
                  <span className="w-40 shrink-0 text-right">
                    {c.facturado == null ? (
                      <span className="text-2xs text-gris-25">sin acceso a los montos</span>
                    ) : (
                      <>
                        <span className="cifra block text-sm font-bold text-tinta">
                          {plata(c.facturado, c.moneda || moneda)}
                        </span>
                        <span className="cifra block text-2xs text-gris-50">
                          {c.excedente ? (
                            <>
                              {plata(c.base ?? 0, c.moneda || moneda)} + {plata(c.excedente, c.moneda || moneda)}
                            </>
                          ) : (
                            'base'
                          )}
                          {c.margen != null && (
                            <span className={c.margen >= 0 ? ' text-verde' : ' text-rojo'}>
                              {' · '}queda {plata(c.margen, c.moneda || moneda)}
                              {c.margen_pct != null && ` (${c.margen_pct}%)`}
                            </span>
                          )}
                        </span>
                      </>
                    )}
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
