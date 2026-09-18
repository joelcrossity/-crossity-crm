'use client'

import { useState, useTransition } from 'react'
import { bonificarEntrega, cobrarEntrega } from '@/app/acciones'

/* ------------------------------------------------------------------
   Marcar una entrega como regalada.

   Cero y regalado no son lo mismo, y hasta ahora el sistema no podía
   distinguirlos. Una entrega en cero se lee como "todavía no le pusimos
   precio": queda pendiente en la cabeza de todos y no aparece en el
   resumen que ve el cliente. Una bonificada es trabajo terminado que se
   decidió no cobrar, y es justo lo que uno quiere que el cliente vea.

   Pide el motivo porque la base lo exige, y la base lo exige por una
   razón: dentro de seis meses alguien va a mirar un proyecto con una
   entrega regalada y va a preguntar por qué. "Para cerrar el ERP" es
   una respuesta. El silencio deja a alguien reconstruyendo una decisión
   comercial de memoria.
   ------------------------------------------------------------------ */

export default function Bonificar({
  hitoId,
  bonificada,
  motivo,
}: {
  hitoId: string
  bonificada: boolean
  motivo: string | null
}) {
  const [pendiente, empezar] = useTransition()
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (bonificada) {
    return (
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className="rounded px-1 py-px text-2xs text-violeta ring-1 ring-violeta/40">
            bonificado
          </span>
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              empezar(async () => {
                const r = await cobrarEntrega(hitoId)
                if (!r.ok) setError(r.error)
              })
            }
            className="text-2xs text-gris-50 underline underline-offset-2
                       transition-colors duration-150 hover:text-tinta disabled:opacity-50"
          >
            volver a cobrarla
          </button>
        </span>
        {motivo && <span className="max-w-[30ch] text-2xs leading-snug text-gris-50">{motivo}</span>}
        {error && <span className="text-2xs text-rojo">{error}</span>}
      </span>
    )
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-2xs text-gris-50 underline underline-offset-2
                   transition-colors duration-150 hover:text-violeta"
      >
        bonificar
      </button>
    )
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-1.5">
        <input
          value={texto}
          autoFocus
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Por qué se regala"
          className="campo w-52 text-xs"
        />
        <button
          type="button"
          disabled={pendiente || !texto.trim()}
          onClick={() =>
            empezar(async () => {
              const r = await bonificarEntrega(hitoId, texto)
              if (r.ok) {
                setAbierto(false)
                setTexto('')
              } else setError(r.error)
            })
          }
          className="boton boton-principal boton-chico"
        >
          {pendiente ? 'Guardando…' : 'Bonificar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false)
            setError(null)
          }}
          className="text-2xs text-gris-50 transition-colors duration-150 hover:text-tinta"
        >
          Cancelar
        </button>
      </span>
      {/* El monto se va a cero al bonificar, y conviene decirlo antes y
          no después: si la entrega tenía precio, ese número se pierde. */}
      <span className="text-2xs text-gris-50">Queda en cero y se muestra al cliente como regalado.</span>
      {error && <span className="text-2xs text-rojo">{error}</span>}
    </span>
  )
}
