'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { cambiarFecha, cambiarMonto, cambiarPrioridad, cambiarResponsable } from '@/app/acciones'
import type { Resultado } from '@/app/acciones'

export type Proyecto = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  color: string
  monto_neto: number | null
  moneda: string
  fecha_comprometida: string | null
  responsable_id: string | null
  prioridad: number | null
}

const PUNTO: Record<string, string> = {
  verde: 'bg-verde',
  amarillo: 'bg-amarillo',
  gris: 'bg-gris-50',
  naranja: 'bg-naranja',
  rojo: 'bg-rojo',
}

const celda =
  'w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-tinta ' +
  'transition-colors duration-150 hover:border-linea focus:border-azul focus:bg-superficie'

/* Una fila por proyecto, toda editable. El objetivo es completar 38
   proyectos de corrido: se tabula de campo en campo y cada uno guarda
   al salir. Nada de abrir y cerrar fichas. */
export default function FilaCarga({
  p,
  personas,
}: {
  p: Proyecto
  personas: { id: string; nombre: string }[]
}) {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const [monto, setMonto] = useState(p.monto_neto?.toString() ?? '')
  const [moneda, setMoneda] = useState(p.moneda)
  const [fecha, setFecha] = useState(p.fecha_comprometida ?? '')
  const [prioridad, setPrioridad] = useState(p.prioridad?.toString() ?? '')

  function correr(fn: () => Promise<Resultado>) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (r.ok) {
        setOk(true)
        setTimeout(() => setOk(false), 1500)
      } else {
        setError(r.error)
      }
    })
  }

  const falta = !monto || !fecha || !p.responsable_id

  return (
    <tr
      className={`border-b border-linea transition-colors duration-150 last:border-0 ${
        pendiente ? 'opacity-60' : ''
      } ${ok ? 'bg-verde-aire' : error ? 'bg-rojo-aire' : 'hover:bg-panel'}`}
    >
      <td className="px-2 py-1.5">
        <span className="flex items-center gap-2">
          <span className={`size-1.5 shrink-0 rounded-full ${PUNTO[p.color]}`} aria-hidden />
          <Link
            href={`/proyecto/${p.codigo}`}
            className="min-w-0 hover:text-azul-hondo"
            title={`${p.codigo} · ${p.cliente}`}
          >
            <span className="block max-w-[16rem] truncate text-sm font-medium text-tinta">
              {p.nombre}
            </span>
            <span className="cifra block max-w-[16rem] truncate text-2xs text-gris-50">
              {p.cliente}
            </span>
          </Link>
        </span>
      </td>

      <td className="px-1 py-1.5">
        <span className="flex gap-1">
          <input
            inputMode="decimal"
            value={monto}
            placeholder="—"
            onChange={(e) => setMonto(e.target.value)}
            onBlur={() =>
              monto !== (p.monto_neto?.toString() ?? '') &&
              correr(() => cambiarMonto(p.id, monto, moneda))
            }
            className={`${celda} cifra w-24 text-right`}
            aria-label={`Monto de ${p.nombre}`}
          />
          <select
            value={moneda}
            onChange={(e) => {
              setMoneda(e.target.value)
              correr(() => cambiarMonto(p.id, monto, e.target.value))
            }}
            className={`${celda} w-16 cursor-pointer text-2xs`}
            aria-label={`Moneda de ${p.nombre}`}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </span>
      </td>

      <td className="px-1 py-1.5">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          onBlur={() =>
            fecha !== (p.fecha_comprometida ?? '') && correr(() => cambiarFecha(p.id, fecha))
          }
          className={`${celda} cifra w-32`}
          aria-label={`Entrega de ${p.nombre}`}
        />
      </td>

      <td className="px-1 py-1.5">
        <select
          defaultValue={p.responsable_id ?? ''}
          onChange={(e) => correr(() => cambiarResponsable(p.id, e.target.value))}
          className={`${celda} w-36 cursor-pointer`}
          aria-label={`Responsable de ${p.nombre}`}
        >
          <option value="">sin asignar</option>
          {personas.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nombre}
            </option>
          ))}
        </select>
      </td>

      <td className="px-1 py-1.5">
        <input
          type="number"
          min={1}
          value={prioridad}
          placeholder="—"
          onChange={(e) => setPrioridad(e.target.value)}
          onBlur={() =>
            prioridad !== (p.prioridad?.toString() ?? '') &&
            correr(() => cambiarPrioridad(p.id, prioridad))
          }
          className={`${celda} cifra w-14 text-center`}
          aria-label={`Prioridad de ${p.nombre}`}
        />
      </td>

      <td className="px-2 py-1.5 text-right">
        {error ? (
          <span className="text-2xs text-rojo">{error}</span>
        ) : falta ? (
          <span className="text-2xs text-gris-50">incompleto</span>
        ) : (
          <span className="text-2xs text-verde">listo</span>
        )}
      </td>
    </tr>
  )
}
