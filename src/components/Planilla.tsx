'use client'

import { useState, useTransition } from 'react'
import { plata } from '@/lib/estados'
import { leerPlanilla } from '@/app/acciones'

/* ------------------------------------------------------------------
   El mes, en una hoja.

   Lo real y lo previsto van en columnas separadas y no sumados en una
   sola cifra. Un ingreso previsto es una entrega con fecha en el mes
   que todavía no se cobró: ponerlo junto a lo que entró de verdad es
   exactamente cómo uno se convence de que tiene plata que no tiene.

   Por eso hay dos resultados abajo, y el que está en negrita es el
   real. El proyectado sirve para decidir; el real es el que existe.

   Todo se valúa en pesos porque sumar pesos y dólares no da nada. Cuál
   dólar usar se elige arriba: el resultado del mes cambia según cuál, y
   eso es una decisión, no un detalle técnico.
   ------------------------------------------------------------------ */

export type Linea = {
  seccion: string
  fila: string
  detalle: string
  monto: number
  es_previsto: boolean
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function Seccion({
  titulo,
  lineas,
  tono,
}: {
  titulo: string
  lineas: Linea[]
  tono: 'entra' | 'sale'
}) {
  const real = lineas.filter((l) => !l.es_previsto).reduce((s, l) => s + l.monto, 0)
  const previsto = lineas.filter((l) => l.es_previsto).reduce((s, l) => s + l.monto, 0)
  const signo = tono === 'entra' ? 'text-verde' : 'text-tinta'

  return (
    <tbody className="border-b border-linea">
      <tr>
        <th
          colSpan={3}
          className="px-3 pt-4 pb-1.5 text-left text-2xs font-medium uppercase
                     tracking-wider text-gris-50"
        >
          {titulo}
        </th>
      </tr>

      {lineas.length === 0 && (
        <tr>
          <td colSpan={3} className="px-3 py-2 text-sm text-gris-50">
            Nada cargado este mes.
          </td>
        </tr>
      )}

      {lineas.map((l) => (
        <tr key={l.fila} className="transition-colors duration-100 hover:bg-panel">
          <td className="px-3 py-1.5">
            <span className="text-sm text-tinta">{l.fila}</span>
            <span className="ml-2 text-2xs text-gris-50">{l.detalle}</span>
          </td>
          <td className="cifra px-3 py-1.5 text-right text-sm tabular-nums">
            {l.es_previsto ? <span className="text-gris-25">—</span> : plata(l.monto, 'ARS')}
          </td>
          <td className="cifra px-3 py-1.5 text-right text-sm tabular-nums text-gris">
            {l.es_previsto ? plata(l.monto, 'ARS') : <span className="text-gris-25">—</span>}
          </td>
        </tr>
      ))}

      <tr className="bg-panel/60">
        <td className="px-3 py-1.5 text-2xs font-medium uppercase tracking-wider text-gris-50">
          Subtotal
        </td>
        <td className={`cifra px-3 py-1.5 text-right text-sm font-bold tabular-nums ${signo}`}>
          {plata(real, 'ARS')}
        </td>
        <td className="cifra px-3 py-1.5 text-right text-sm tabular-nums text-gris">
          {plata(previsto, 'ARS')}
        </td>
      </tr>
    </tbody>
  )
}

export default function Planilla({
  inicial,
  mesInicial,
}: {
  inicial: Linea[]
  mesInicial: string
}) {
  const [pendiente, empezar] = useTransition()
  const [lineas, setLineas] = useState(inicial)
  const [mes, setMes] = useState(mesInicial)
  const [casa, setCasa] = useState<'oficial' | 'blue'>('oficial')
  const [error, setError] = useState<string | null>(null)

  function pedir(nuevoMes: string, nuevaCasa: 'oficial' | 'blue') {
    setMes(nuevoMes)
    setCasa(nuevaCasa)
    setError(null)
    empezar(async () => {
      const r = await leerPlanilla(nuevoMes, nuevaCasa)
      if (r.ok) setLineas(r.lineas)
      else setError(r.error)
    })
  }

  const ingresos = lineas.filter((l) => l.seccion === 'Ingresos')
  const egresos = lineas.filter((l) => l.seccion === 'Egresos')

  const suma = (ls: Linea[], previsto: boolean) =>
    ls.filter((l) => l.es_previsto === previsto).reduce((s, l) => s + l.monto, 0)

  const real = suma(ingresos, false) - suma(egresos, false)
  const proyectado =
    suma(ingresos, false) + suma(ingresos, true) - suma(egresos, false) - suma(egresos, true)

  const [anio, mesNum] = mes.split('-').map(Number)

  function correrMes(pasos: number) {
    const d = new Date(anio, mesNum - 1 + pasos, 1)
    pedir(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, casa)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => correrMes(-1)}
            aria-label="Mes anterior"
            className="boton boton-sutil boton-chico"
          >
            ‹
          </button>
          <span className="min-w-44 text-center text-base font-bold tracking-tight text-tinta">
            {MESES[mesNum - 1]} {anio}
          </span>
          <button
            type="button"
            onClick={() => correrMes(1)}
            aria-label="Mes siguiente"
            className="boton boton-sutil boton-chico"
          >
            ›
          </button>
        </div>

        {/* Qué dólar se usa para valuar: el resultado del mes cambia
            según cuál, así que se elige y se ve cuál está elegido. */}
        <div className="flex items-center gap-2">
          <span className="text-2xs text-gris-50">valuado al</span>
          <span className="flex rounded-md border border-linea p-0.5">
            {(['oficial', 'blue'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pedir(mes, c)}
                className={`rounded px-2.5 py-1 text-2xs transition-colors duration-150 ${
                  casa === c ? 'bg-azul-aire font-medium text-azul-hondo' : 'text-gris'
                }`}
              >
                {c === 'oficial' ? 'Oficial' : 'Blue'}
              </button>
            ))}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      <div className={`tarjeta overflow-x-auto transition-opacity duration-150 ${
        pendiente ? 'opacity-50' : ''
      }`}>
        <table className="w-full min-w-[34rem] border-collapse">
          <thead>
            <tr className="border-b border-linea">
              <th className="px-3 py-2 text-left text-2xs font-medium uppercase tracking-wider text-gris-50">
                Concepto
              </th>
              <th className="px-3 py-2 text-right text-2xs font-medium uppercase tracking-wider text-tinta">
                Real
              </th>
              <th className="px-3 py-2 text-right text-2xs font-medium uppercase tracking-wider text-gris-50">
                Previsto
              </th>
            </tr>
          </thead>

          <Seccion titulo="Ingresos" lineas={ingresos} tono="entra" />
          <Seccion titulo="Egresos" lineas={egresos} tono="sale" />

          <tfoot>
            <tr>
              <td className="px-3 pt-4 pb-1 text-sm font-bold text-tinta">Resultado del mes</td>
              <td
                className={`cifra px-3 pt-4 pb-1 text-right text-lg font-bold tabular-nums ${
                  real >= 0 ? 'text-verde' : 'text-rojo'
                }`}
              >
                {plata(real, 'ARS')}
              </td>
              <td
                className={`cifra px-3 pt-4 pb-1 text-right text-sm tabular-nums ${
                  proyectado >= 0 ? 'text-gris' : 'text-rojo'
                }`}
              >
                {plata(proyectado, 'ARS')}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="px-3 pb-3 text-2xs text-gris-50">
                El real es lo que entró menos lo que salió. El proyectado suma lo que todavía no
                pasó: sirve para decidir, no para contar con eso.
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
