'use client'

import { useState, useTransition } from 'react'
import { abrirMantenimiento } from '@/app/acciones'

/* ------------------------------------------------------------------
   Cuando un proyecto se termina, preguntar si sigue con abono.

   Es el momento exacto en que conviene preguntarlo: el trabajo está
   fresco, se sabe qué se entregó y qué va a haber que mantener. Una
   semana después nadie se acuerda, y el cliente se queda con algo
   funcionando que nadie factura.

   Aparece al soltar en Terminado y se puede ignorar sin más: si no era,
   se cierra y listo. Hoy sigue avisando de los terminados sin abono,
   así que no es la última oportunidad.

   El monto arranca vacío a propósito. Podría traer el del proyecto,
   pero lo que costó construir algo no tiene relación con lo que sale
   mantenerlo, y un número puesto por defecto es un número que queda.
   ------------------------------------------------------------------ */

export default function OfrecerAbono({
  proyecto,
  hoy,
  alCerrar,
}: {
  proyecto: { id: string; nombre: string; cliente: string }
  hoy: string
  alCerrar: () => void
}) {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [mensual, setMensual] = useState('')
  const [desde, setDesde] = useState(hoy)
  /* El reparto suele continuar, pero mantener no es lo mismo que
     construir y el que construyó puede no ser el que mantiene. Por eso
     se pregunta en vez de asumirlo. */
  const [copiarReparto, setCopiarReparto] = useState(true)

  function abrir() {
    setError(null)
    empezar(async () => {
      const r = await abrirMantenimiento(proyecto.id, mensual, desde, copiarReparto)
      if (r.ok) alCerrar()
      else setError(r.error)
    })
  }

  return (
    <div
      role="dialog"
      aria-label="Abrir el mantenimiento"
      className="surge tarjeta flex flex-col gap-3 border-azul p-4 shadow-[var(--sombra-flotante)]"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold tracking-tight text-tinta">
          {proyecto.nombre} quedó terminado
        </span>
        <span className="text-2xs text-gris">
          ¿{proyecto.cliente} sigue con un abono mensual? Se puede abrir ahora, mientras está
          fresco lo que hay que mantener.
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-0.5">
          <span className="rotulo">Por mes</span>
          <input
            value={mensual}
            inputMode="decimal"
            autoFocus
            onChange={(e) => setMensual(e.target.value)}
            placeholder="85.000"
            className="campo cifra w-32"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="rotulo">Desde</span>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="campo cifra w-40"
          />
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={copiarReparto}
            onChange={(e) => setCopiarReparto(e.target.checked)}
            className="size-4 accent-[var(--color-azul-hondo)]"
          />
          <span className="text-2xs text-gris">
            Con el mismo reparto entre el equipo
          </span>
        </label>
      </div>

      {error && (
        <p role="alert" className="text-2xs text-rojo">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={abrir}
          disabled={pendiente || !mensual}
          className="boton boton-principal"
        >
          {pendiente ? 'Abriendo…' : 'Abrir el mantenimiento'}
        </button>
        <button type="button" onClick={alCerrar} className="boton boton-sutil">
          Ahora no
        </button>
      </div>

      <p className="text-2xs text-gris-50">
        Si no era, cerrá y listo: Hoy te lo va a recordar mientras siga terminado y sin abono.
      </p>
    </div>
  )
}
