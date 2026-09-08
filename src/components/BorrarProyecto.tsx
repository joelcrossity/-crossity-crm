'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { borrarProyecto } from '@/app/acciones'

/* Una carga de prueba o una charla mal anotada se borra. Un proyecto
   que movió plata, no: eso se cierra con su motivo. La acción lo
   verifica en el servidor; acá solo se pide confirmación. */

export default function BorrarProyecto({
  proyectoId,
  nombre,
}: {
  proyectoId: string
  nombre: string
}) {
  const router = useRouter()
  const [seguro, setSeguro] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  if (!seguro)
    return (
      <button
        type="button"
        onClick={() => setSeguro(true)}
        className="w-fit text-2xs text-gris-50 transition-colors duration-150 hover:text-rojo"
      >
        Borrar este proyecto
      </button>
    )

  return (
    <div className="surge flex flex-col gap-2 rounded-lg border border-rojo bg-rojo-aire p-3">
      <p className="max-w-[60ch] text-sm text-tinta">
        Se borra <span className="font-medium">{nombre}</span> con sus entregas y su historial. No
        se puede deshacer. Si ya movió plata, el sistema no va a dejar.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            setError(null)
            empezar(async () => {
              const r = await borrarProyecto(proyectoId)
              if (r.ok && r.ir) router.push(r.ir)
              else if (!r.ok) setError(r.error)
            })
          }}
          className="rounded-md bg-rojo px-3 py-1.5 text-sm font-medium text-white
                     transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
        >
          {pendiente ? 'Borrando…' : 'Sí, borrarlo'}
        </button>
        <button
          type="button"
          onClick={() => setSeguro(false)}
          className="px-2 py-1.5 text-sm text-gris hover:text-tinta"
        >
          No
        </button>
      </div>
      {error && <p className="text-sm font-medium text-rojo">{error}</p>}
    </div>
  )
}
