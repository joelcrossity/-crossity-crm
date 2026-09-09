'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { abrirMantenimiento } from '@/app/acciones'

/* Entregar no es terminar. Este formulario es el que evita que un
   proyecto entregado deje de facturar sin que nadie lo haya decidido. */
export default function AbrirMantenimiento({
  proyectoId,
  nombre,
}: {
  proyectoId: string
  nombre: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [monto, setMonto] = useState('')
  const [desde, setDesde] = useState(new Date().toISOString().slice(0, 10))
  const [copiar, setCopiar] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  if (!abierto) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-azul bg-azul-aire p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-md font-bold tracking-tight text-tinta">
            Todas las entregas están hechas
          </h2>
          <p className="max-w-[65ch] text-sm text-gris">
            Entregar no es terminar: es cuando empieza a facturarse todos los meses. Si nadie abre
            el mantenimiento, se dejó de facturar sin haberlo decidido.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-fit rounded-md bg-azul-hondo px-3.5 py-1.5 text-sm font-medium text-white
                     transition-colors duration-150 hover:bg-azul"
        >
          Abrir el mantenimiento
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        empezar(async () => {
          const r = await abrirMantenimiento(proyectoId, monto, desde, copiar)
          if (r.ok) {
            setAbierto(false)
            router.refresh()
          } else {
            setError(r.error)
          }
        })
      }}
      className="flex flex-col gap-4 rounded-lg border border-azul bg-azul-aire p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-md font-bold tracking-tight text-tinta">Abrir el mantenimiento</h2>
        <p className="text-sm text-gris">
          Nace ligado a {nombre}. La historia no se pierde: sigue en la misma cuenta del cliente.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-0.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
            Abono mensual
          </span>
          <input
            inputMode="decimal"
            value={monto}
            placeholder="180000"
            onChange={(e) => setMonto(e.target.value)}
            className="cifra w-32 rounded border border-linea bg-superficie px-2 py-1.5 text-sm text-right
                       placeholder:text-gris-50"
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">Desde</span>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="cifra rounded border border-linea bg-superficie px-2 py-1.5 text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={pendiente}
          className="boton boton-principal"
        >
          {pendiente ? 'Abriendo…' : 'Abrir'}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="boton boton-sutil"
        >
          Cancelar
        </button>
      </div>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={copiar}
          onChange={(e) => setCopiar(e.target.checked)}
          className="mt-0.5 size-3.5 cursor-pointer accent-azul-hondo"
        />
        <span className="text-sm text-gris">
          <span className="font-medium text-tinta">Copiar el reparto de la obra.</span> Mantener no
          es construir: el que construyó puede no ser el que mantiene, y el porcentaje casi nunca es
          el mismo. Si lo dudás, abrilo sin copiar y cargalo aparte.
        </span>
      </label>

      {error && <p className="text-sm text-rojo">{error}</p>}
    </form>
  )
}
