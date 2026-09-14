'use client'

import { useMemo, useState } from 'react'
import { plata } from '@/lib/estados'
import type { Componente, Cuota, EtapaPropuesta } from '@/app/acciones'

/* ------------------------------------------------------------------
   Armar una propuesta.

   Tres niveles, porque una cotización real tiene tres y mezclarlos fue
   el error de la primera versión:

     La ETAPA es el bloque que el cliente aprueba o rechaza entero.
     Los COMPONENTES son qué recibe y cuánto vale cada parte. Su suma
     da el total de la etapa.
     Las CUOTAS son cuándo paga ese total.

   Lo importante de separarlos: una etapa puede tener precio y todavía
   no tener forma de pago. Es el estado normal de algo cotizado y no
   vendido, y antes no se podía expresar sin inventar cuotas falsas.

   Los componentes vienen en tres clases y las tres hacen falta.
   Cotizado tiene precio. Bonificado vale cero y se muestra igual, para
   que se vea qué se está regalando. Sin cotizar es alcance que el
   cliente ya vio y que necesita relevamiento antes de tener número: no
   suma, pero existe, y es la venta que sigue.
   ------------------------------------------------------------------ */

const CLASES: [Componente['estado'], string, string][] = [
  ['cotizado', 'Cotizado', 'tiene precio'],
  ['bonificado', 'Bonificado', 'se regala, y se muestra para que se vea'],
  ['sin_cotizar', 'Sin cotizar', 'falta relevarlo para poder ponerle número'],
]

const REPARTOS: [string, number[]][] = [
  ['50 / 50', [50, 50]],
  ['30 / 40 / 30', [30, 40, 30]],
  ['Todo al inicio', [100]],
]

const NOMBRES = ['Anticipo', 'Avance', 'Entrega final']

const vacia = (moneda: string): EtapaPropuesta => ({
  nombre: '',
  alcance: '',
  componentes: [{ nombre: '', estado: 'cotizado', monto: null, moneda, recurrente: false }],
  cuotas: [],
})

/* Lo de una sola vez. Lo recurrente queda afuera: son dos platas
   distintas y sumarlas da un número que no es ninguno de los dos. */
function totalDe(e: EtapaPropuesta) {
  return e.componentes
    .filter((c) => c.estado === 'cotizado' && !c.recurrente)
    .reduce((s, c) => s + (Number(c.monto) || 0), 0)
}

function bonificadoDe(e: EtapaPropuesta) {
  return e.componentes
    .filter((c) => c.estado === 'bonificado' && !c.recurrente)
    .reduce((s, c) => s + (Number(c.monto) || 0), 0)
}

/* Lo que va a entrar todos los meses cuando esto termine. */
function mensualDe(e: EtapaPropuesta) {
  return e.componentes
    .filter((c) => c.recurrente && c.estado !== 'sin_cotizar')
    .reduce((s, c) => s + (Number(c.monto) || 0), 0)
}

export default function Cotizador({
  etapas,
  alCambiar,
  moneda,
  cotizacion,
}: {
  etapas: EtapaPropuesta[]
  alCambiar: (e: EtapaPropuesta[]) => void
  moneda: string
  /* La del día, para mostrar el equivalente en pesos mientras se
     cotiza en dólares. Sin esto hay que abrir la calculadora. */
  cotizacion: number | null
}) {
  const [abierta, setAbierta] = useState<number | null>(0)

  const total = useMemo(() => etapas.reduce((s, e) => s + totalDe(e), 0), [etapas])
  const enPesos = moneda !== 'ARS' && cotizacion ? total * cotizacion : null

  const tocar = (i: number, cambio: Partial<EtapaPropuesta>) =>
    alCambiar(etapas.map((e, j) => (j === i ? { ...e, ...cambio } : e)))

  const mover = (i: number, hacia: number) => {
    const j = i + hacia
    if (j < 0 || j >= etapas.length) return
    const c = [...etapas]
    ;[c[i], c[j]] = [c[j], c[i]]
    alCambiar(c)
    setAbierta(j)
  }

  /* Reparte el total de la etapa en cuotas. Es el camino que se usa
     cuando el precio ya está cerrado y falta acordar cómo se paga. */
  function repartir(i: number, partes: number[]) {
    const e = etapas[i]
    const t = totalDe(e)
    if (t <= 0) return
    const cuotas: Cuota[] = partes.map((pct, k) => ({
      ...(e.cuotas[k] ?? {}),
      titulo: e.cuotas[k]?.titulo || NOMBRES[k] || `Cuota ${k + 1}`,
      monto: Math.round(t * (pct / 100) * 100) / 100,
      moneda,
    }))
    /* El redondeo puede dejar centavos afuera: van a la última, que es
       lo que hace cualquiera con una calculadora. */
    const dif = t - cuotas.reduce((s, q) => s + q.monto, 0)
    if (Math.abs(dif) > 0.001) cuotas[cuotas.length - 1].monto += Math.round(dif * 100) / 100
    tocar(i, { cuotas })
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="rotulo">La propuesta</span>
        <span className="cifra flex items-baseline gap-2">
          <span className="text-lg font-bold text-tinta">{plata(total, moneda)}</span>
          {enPesos != null && (
            <span className="text-2xs text-gris-50">≈ {plata(enPesos, 'ARS')}</span>
          )}
        </span>
      </div>

      {etapas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-linea-fuerte px-3 py-6 text-center
                      text-2xs text-gris-50">
          Sin etapas todavía. Una etapa es un bloque que el cliente aprueba o rechaza entero:
          podés venderle la primera y dejar el resto cotizado para más adelante.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {etapas.map((e, i) => {
            const suTotal = totalDe(e)
            const suBonificado = bonificadoDe(e)
            const suMensual = mensualDe(e)
            const sinCotizar = e.componentes.filter((c) => c.estado === 'sin_cotizar').length
            const repartido = e.cuotas.reduce((s, q) => s + (Number(q.monto) || 0), 0)
            const descuadre = e.cuotas.length > 0 ? suTotal - repartido : 0
            const arrancada = e.cuotas.some((q) => q.activa)

            return (
              <li key={e.id ?? `nueva-${i}`} className="tarjeta overflow-hidden">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-linea
                                bg-panel px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setAbierta(abierta === i ? null : i)}
                    aria-expanded={abierta === i}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      className={`size-3 shrink-0 text-gris-50 transition-transform duration-200
                                  ease-(--ease-salida) ${abierta === i ? '' : '-rotate-90'}`}
                      fill="none"
                      aria-hidden
                    >
                      <path d="M4 6.2 8 10l4-3.8" stroke="currentColor" strokeWidth="1.6"
                            strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="cifra text-2xs text-gris-50">{i + 1}</span>
                    <span className="min-w-0 truncate text-sm font-medium text-tinta">
                      {e.nombre || 'Etapa sin nombre'}
                    </span>
                  </button>

                  <span className="cifra flex shrink-0 items-baseline gap-2 text-2xs">
                    <span className="text-sm font-bold text-tinta">{plata(suTotal, moneda)}</span>
                    {suMensual > 0 && (
                      <span className="text-azul-hondo">
                        + {plata(suMensual, moneda)}/mes
                      </span>
                    )}
                    {suBonificado > 0 && (
                      <span className="text-verde">+{plata(suBonificado, moneda)} bonif.</span>
                    )}
                    {sinCotizar > 0 && (
                      <span className="text-amarillo">{sinCotizar} a relevar</span>
                    )}
                  </span>

                  {arrancada ? (
                    <span className="shrink-0 text-2xs text-verde">ya arrancó</span>
                  ) : (
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button" onClick={() => mover(i, -1)} disabled={i === 0}
                        aria-label="Subir la etapa"
                        className="grid size-6 place-items-center rounded-md border border-linea
                                   text-2xs text-gris-50 hover:border-azul hover:text-azul-hondo
                                   disabled:opacity-30"
                      >↑</button>
                      <button
                        type="button" onClick={() => mover(i, 1)} disabled={i === etapas.length - 1}
                        aria-label="Bajar la etapa"
                        className="grid size-6 place-items-center rounded-md border border-linea
                                   text-2xs text-gris-50 hover:border-azul hover:text-azul-hondo
                                   disabled:opacity-30"
                      >↓</button>
                      <button
                        type="button"
                        onClick={() => alCambiar(etapas.filter((_, j) => j !== i))}
                        aria-label="Sacar la etapa"
                        className="grid size-6 place-items-center rounded-md border border-linea
                                   text-sm text-gris-50 hover:border-rojo hover:text-rojo"
                      >×</button>
                    </span>
                  )}
                </div>

                {abierta === i && (
                  <div className="flex flex-col gap-4 px-3 py-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-0.5">
                        <span className="rotulo">Nombre de la etapa</span>
                        <input
                          value={e.nombre}
                          disabled={arrancada}
                          onChange={(x) => tocar(i, { nombre: x.target.value })}
                          placeholder="Etapa 1 · MVP"
                          className="campo"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="rotulo">Alcance</span>
                        <input
                          value={e.alcance ?? ''}
                          disabled={arrancada}
                          onChange={(x) => tocar(i, { alcance: x.target.value })}
                          placeholder="CRM, agente conversacional y prospección"
                          className="campo"
                        />
                      </label>
                    </div>

                    <Componentes
                      etapa={e}
                      moneda={moneda}
                      bloqueada={arrancada}
                      alCambiar={(componentes) => tocar(i, { componentes })}
                    />

                    <Cuotas
                      etapa={e}
                      moneda={moneda}
                      total={suTotal}
                      descuadre={descuadre}
                      alCambiar={(cuotas) => tocar(i, { cuotas })}
                      alRepartir={(partes) => repartir(i, partes)}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => {
          alCambiar([...etapas, vacia(moneda)])
          setAbierta(etapas.length)
        }}
        className="boton boton-secundario boton-chico w-fit"
      >
        + Agregar etapa
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------
   Los componentes: qué incluye la etapa.
   ------------------------------------------------------------------ */

function Componentes({
  etapa,
  moneda,
  bloqueada,
  alCambiar,
}: {
  etapa: EtapaPropuesta
  moneda: string
  bloqueada: boolean
  alCambiar: (c: Componente[]) => void
}) {
  const tocar = (i: number, cambio: Partial<Componente>) =>
    alCambiar(etapa.componentes.map((c, j) => (j === i ? { ...c, ...cambio } : c)))

  return (
    <div className="flex flex-col gap-1.5">
      <span className="rotulo">Qué incluye</span>

      {etapa.componentes.map((c, i) => (
        <div key={c.id ?? `c-${i}`} className="flex flex-wrap items-end gap-2 rounded-md
                                               border border-linea px-2.5 py-2">
          <label className="flex min-w-36 flex-1 flex-col gap-0.5">
            <input
              value={c.nombre}
              disabled={bloqueada}
              onChange={(x) => tocar(i, { nombre: x.target.value })}
              placeholder="Agente operativo en grupo"
              className="campo text-sm"
            />
          </label>

          {/* La clase primero, porque decide si hay monto o no. */}
          <span className="flex rounded-md border border-linea p-0.5">
            {CLASES.map(([v, t, ayuda]) => (
              <button
                key={v}
                type="button"
                title={ayuda}
                disabled={bloqueada}
                onClick={() =>
                  tocar(i, {
                    estado: v,
                    monto: v === 'sin_cotizar' ? null : (c.monto ?? 0),
                    // Lo que se cotiza de un abono es cuánto sale por
                    // mes: no puede estar sin cotizar y ser mensual.
                    recurrente: v === 'sin_cotizar' ? false : c.recurrente,
                  })
                }
                className={`rounded px-2 py-1 text-2xs transition-colors duration-150 ${
                  c.estado === v ? 'bg-azul-aire font-medium text-azul-hondo' : 'text-gris-50'
                }`}
              >
                {t}
              </button>
            ))}
          </span>

          {c.estado === 'sin_cotizar' ? (
            <span className="pb-2 text-2xs text-gris-50">falta relevarlo</span>
          ) : (
            <span className="flex items-center gap-1.5">
              <input
                value={c.monto == null || c.monto === 0 ? '' : String(c.monto)}
                inputMode="decimal"
                disabled={bloqueada}
                onChange={(x) => tocar(i, { monto: Number(x.target.value.replace(',', '.')) || 0 })}
                placeholder="0"
                aria-label="Monto"
                className="campo cifra w-24 text-sm"
              />
              {/* Por única vez o por mes. Un abono cotizado junto con el
                  proyecto es lo que después arranca solo al terminarlo,
                  con el monto que ya se había acordado. */}
              <button
                type="button"
                disabled={bloqueada}
                aria-pressed={!!c.recurrente}
                title={
                  c.recurrente
                    ? 'Es un abono mensual: no suma al total del proyecto'
                    : 'Se cobra una sola vez'
                }
                onClick={() => tocar(i, { recurrente: !c.recurrente })}
                className={`rounded-md border px-2 py-1.5 text-2xs transition-colors duration-150 ${
                  c.recurrente
                    ? 'border-azul-hondo bg-azul-aire font-medium text-azul-hondo'
                    : 'border-linea text-gris-50 hover:border-azul'
                }`}
              >
                {c.recurrente ? 'por mes' : 'una vez'}
              </button>
            </span>
          )}

          {!bloqueada && (
            <button
              type="button"
              onClick={() => alCambiar(etapa.componentes.filter((_, j) => j !== i))}
              aria-label="Sacar"
              className="grid size-7 shrink-0 place-items-center rounded-md border border-linea
                         text-sm text-gris-50 hover:border-rojo hover:text-rojo"
            >
              ×
            </button>
          )}

          {c.estado === 'sin_cotizar' && (
            <input
              value={c.detalle ?? ''}
              disabled={bloqueada}
              onChange={(x) => tocar(i, { detalle: x.target.value })}
              placeholder="Qué hay que relevar antes de poder cotizarlo"
              className="campo w-full text-2xs"
            />
          )}
        </div>
      ))}

      {!bloqueada && (
        <button
          type="button"
          onClick={() =>
            alCambiar([
              ...etapa.componentes,
              { nombre: '', estado: 'cotizado', monto: null, moneda, recurrente: false },
            ])
          }
          className="w-fit text-2xs text-azul-hondo transition-colors duration-150 hover:underline"
        >
          + Sumar algo a esta etapa
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------
   Las cuotas: cuándo se paga.
   ------------------------------------------------------------------ */

function Cuotas({
  etapa,
  moneda,
  total,
  descuadre,
  alCambiar,
  alRepartir,
}: {
  etapa: EtapaPropuesta
  moneda: string
  total: number
  descuadre: number
  alCambiar: (c: Cuota[]) => void
  alRepartir: (partes: number[]) => void
}) {
  const tocar = (i: number, cambio: Partial<Cuota>) =>
    alCambiar(etapa.cuotas.map((q, j) => (j === i ? { ...q, ...cambio } : q)))

  return (
    <div className="flex flex-col gap-1.5 border-t border-linea pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="rotulo">Cómo se paga</span>
        {etapa.cuotas.length === 0 && total > 0 && (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-2xs text-gris-50">repartir en</span>
            {REPARTOS.map(([t, partes]) => (
              <button
                key={t}
                type="button"
                onClick={() => alRepartir(partes)}
                className="rounded-md border border-linea px-2 py-1 text-2xs text-gris
                           transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
              >
                {t}
              </button>
            ))}
          </span>
        )}
      </div>

      {etapa.cuotas.length === 0 ? (
        <p className="text-2xs text-gris-50">
          Todavía sin forma de pago. No hace falta definirla para cotizar: se acuerda al vender, y
          una etapa cotizada y no vendida tiene precio sin tener cuotas.
        </p>
      ) : (
        <>
          {etapa.cuotas.map((q, i) => (
            <div key={q.id ?? `q-${i}`} className="flex flex-wrap items-end gap-2 rounded-md
                                                   border border-linea px-2.5 py-2">
              <input
                value={q.titulo}
                disabled={q.activa}
                onChange={(x) => tocar(i, { titulo: x.target.value })}
                placeholder="Anticipo a la firma"
                className="campo min-w-36 flex-1 text-sm"
              />
              <input
                value={q.monto === 0 ? '' : String(q.monto)}
                inputMode="decimal"
                disabled={q.activa}
                onChange={(x) => tocar(i, { monto: Number(x.target.value.replace(',', '.')) || 0 })}
                placeholder="0"
                aria-label="Monto de la cuota"
                className="campo cifra w-24 text-sm"
              />
              {q.activa ? (
                <span className="pb-2 text-2xs text-verde">en ejecución</span>
              ) : (
                <button
                  type="button"
                  onClick={() => alCambiar(etapa.cuotas.filter((_, j) => j !== i))}
                  aria-label="Sacar la cuota"
                  className="grid size-7 shrink-0 place-items-center rounded-md border border-linea
                             text-sm text-gris-50 hover:border-rojo hover:text-rojo"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <button
              type="button"
              onClick={() =>
                alCambiar([...etapa.cuotas, { titulo: '', monto: 0, moneda }])
              }
              className="text-2xs text-azul-hondo transition-colors duration-150 hover:underline"
            >
              + Sumar una cuota
            </button>

            {/* El descuadre se dice apenas aparece: cuotas que no suman
                el total de su etapa es la forma más fácil que hay de
                facturar de menos sin enterarse. */}
            {Math.abs(descuadre) > 0.01 && (
              <span className="cifra text-2xs font-medium text-rojo">
                {descuadre > 0 ? 'faltan ' : 'sobran '}
                {plata(Math.abs(descuadre), moneda)} para llegar al total de la etapa
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
