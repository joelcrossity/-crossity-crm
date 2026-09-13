'use client'

import { useMemo, useState } from 'react'
import { plata } from '@/lib/estados'
import type { EtapaCotizada } from '@/app/acciones'

/* ------------------------------------------------------------------
   Cotizar un trabajo por etapas.

   Una cotización de tres etapas no es un monto: es un acuerdo sobre qué
   se entrega y cuánto vale cada cosa. Guardarla como un número suelto
   pierde justo lo que el cliente aprobó, y después nadie puede
   contestar por qué se factura lo que se factura.

   El total se calcula acá y no se escribe. Un total tipeado al lado de
   las etapas es un número que deja de coincidir la primera vez que
   alguien corrige una y se olvida del otro.

   Las etapas que ya arrancaron se muestran pero no se tocan: pueden
   tener plata repartida, facturada o cobrada, y cambiarles el monto
   desde acá rompería cuentas que ya existen. La base también lo frena;
   esto es para que no parezca posible.
   ------------------------------------------------------------------ */

export type Etapa = EtapaCotizada & { activa?: boolean }

const ESQUEMAS: [string, string, number[]][] = [
  ['cincuenta_cincuenta', '50 / 50', [50, 50]],
  ['treinta_cuarenta_treinta', '30 / 40 / 30', [30, 40, 30]],
  ['contado', '100% al inicio', [100]],
]

function nueva(orden: number, moneda: string, casa: string): Etapa {
  return { orden, titulo: '', monto: 0, moneda, casa, activa: false }
}

export default function Cotizador({
  etapas,
  alCambiar,
  moneda,
  casa,
  cotizacion,
  soloLectura = false,
}: {
  etapas: Etapa[]
  alCambiar: (e: Etapa[]) => void
  moneda: string
  casa: string
  /* La del día para la casa elegida, para mostrar el equivalente en
     pesos mientras se cotiza. Sin esto hay que abrir la calculadora. */
  cotizacion: number | null
  soloLectura?: boolean
}) {
  const [esquema, setEsquema] = useState('')

  const total = useMemo(
    () => etapas.reduce((s, e) => s + (Number(e.monto) || 0), 0),
    [etapas],
  )
  const enPesos = moneda !== 'ARS' && cotizacion ? total * cotizacion : null

  function tocar(i: number, campo: keyof Etapa, valor: string | number) {
    alCambiar(etapas.map((e, j) => (j === i ? { ...e, [campo]: valor } : e)))
  }

  function agregar() {
    alCambiar([...etapas, nueva(etapas.length + 1, moneda, casa)])
  }

  function sacar(i: number) {
    alCambiar(etapas.filter((_, j) => j !== i).map((e, j) => ({ ...e, orden: j + 1 })))
  }

  function mover(i: number, hacia: number) {
    const j = i + hacia
    if (j < 0 || j >= etapas.length) return
    const copia = [...etapas]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    alCambiar(copia.map((e, k) => ({ ...e, orden: k + 1 })))
  }

  /* Repartir un total conocido según un esquema. Es lo que se hace
     cuando ya se acordó el precio y falta ponerle nombre a las partes,
     que es el camino inverso al de cotizar etapa por etapa: los dos
     existen y conviene que los dos estén. */
  function repartir(clave: string) {
    setEsquema(clave)
    const partes = ESQUEMAS.find((e) => e[0] === clave)?.[2]
    if (!partes || total <= 0) return
    const nombres = ['Anticipo', 'Avance', 'Entrega final']
    alCambiar(
      partes.map((pct, i) => ({
        ...(etapas[i] ?? nueva(i + 1, moneda, casa)),
        orden: i + 1,
        titulo: etapas[i]?.titulo || nombres[i] || `Etapa ${i + 1}`,
        monto: Math.round(total * (pct / 100) * 100) / 100,
        moneda,
        casa,
      })),
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="rotulo">Cotización por etapas</span>
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
          Sin etapas. Se puede cotizar todo junto o partirlo en entregas: partido, el cliente
          aprueba lo que ve y después se factura exactamente eso.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {etapas.map((e, i) => (
            <li
              key={e.id ?? `nueva-${i}`}
              className={`flex flex-wrap items-end gap-2 rounded-lg border px-3 py-2.5 ${
                e.activa ? 'border-linea bg-panel' : 'border-linea bg-superficie'
              }`}
            >
              <span className="cifra w-5 shrink-0 pb-2 text-2xs text-gris-50">{i + 1}</span>

              <label className="flex min-w-40 flex-1 flex-col gap-0.5">
                <span className="rotulo">Qué se entrega</span>
                <input
                  value={e.titulo}
                  disabled={soloLectura || e.activa}
                  onChange={(x) => tocar(i, 'titulo', x.target.value)}
                  placeholder="Relevamiento y arquitectura"
                  className="campo"
                />
              </label>

              <label className="flex flex-col gap-0.5">
                <span className="rotulo">Cuánto</span>
                <input
                  value={e.monto === 0 ? '' : String(e.monto)}
                  inputMode="decimal"
                  disabled={soloLectura || e.activa}
                  onChange={(x) => tocar(i, 'monto', Number(x.target.value.replace(',', '.')) || 0)}
                  placeholder="0"
                  className="campo cifra w-28"
                />
              </label>

              {e.activa ? (
                <span className="pb-2 text-2xs text-verde">ya arrancó</span>
              ) : (
                !soloLectura && (
                  <span className="flex shrink-0 gap-1 pb-1">
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                      aria-label="Subir"
                      className="grid size-7 place-items-center rounded-md border border-linea
                                 text-2xs text-gris-50 transition-colors duration-150
                                 hover:border-azul hover:text-azul-hondo disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={i === etapas.length - 1}
                      aria-label="Bajar"
                      className="grid size-7 place-items-center rounded-md border border-linea
                                 text-2xs text-gris-50 transition-colors duration-150
                                 hover:border-azul hover:text-azul-hondo disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => sacar(i)}
                      aria-label="Sacar esta etapa"
                      className="grid size-7 place-items-center rounded-md border border-linea
                                 text-sm text-gris-50 transition-colors duration-150
                                 hover:border-rojo hover:text-rojo"
                    >
                      ×
                    </button>
                  </span>
                )
              )}

              {!e.activa && (
                <label className="flex w-full flex-col gap-0.5">
                  <span className="rotulo">Qué incluye</span>
                  <input
                    value={e.entregable ?? ''}
                    disabled={soloLectura}
                    onChange={(x) => tocar(i, 'entregable', x.target.value)}
                    placeholder="Lo que el cliente recibe al cerrar esta etapa"
                    className="campo text-2xs"
                  />
                </label>
              )}
            </li>
          ))}
        </ul>
      )}

      {!soloLectura && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={agregar} className="boton boton-secundario boton-chico">
            + Agregar etapa
          </button>

          {/* El camino inverso: ya está acordado el total y falta
              partirlo. Pasa seguido con clientes que negocian un número
              cerrado y después se define cómo se paga. */}
          {total > 0 && (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs text-gris-50">o repartir el total en</span>
              {ESQUEMAS.map(([v, t]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => repartir(v)}
                  className={`rounded-md border px-2 py-1 text-2xs transition-colors duration-150 ${
                    esquema === v
                      ? 'border-azul-hondo bg-azul-aire text-azul-hondo'
                      : 'border-linea text-gris hover:border-azul'
                  }`}
                >
                  {t}
                </button>
              ))}
            </span>
          )}
        </div>
      )}

      <p className="text-2xs text-gris-50">
        Las fechas se ponen al pasar a proyecto, no ahora: mientras se negocia no hay contra qué
        comprometerse, y una fecha puesta para llenar el campo después se lee como una promesa.
      </p>
    </section>
  )
}
