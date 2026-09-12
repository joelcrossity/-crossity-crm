'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { borrarPersona, quitarAcceso } from '@/app/acciones'

/* ------------------------------------------------------------------
   Las dos formas de sacar a alguien.

   Quitarle el acceso es lo que se necesita casi siempre: alguien dejó
   el equipo, deja de poder entrar, y su nombre sigue en los proyectos
   donde participó porque esa plata existió.

   Borrarla es otra cosa y solo sirve para lo que nunca pasó: una carga
   de prueba, un nombre mal escrito, un duplicado. Si tiene historia, la
   base no deja y el sistema explica por qué en vez de tirar un error.
   ------------------------------------------------------------------ */

export default function BajaPersona({
  personaId,
  nombre,
  tieneCuenta,
  soyYo,
}: {
  personaId: string
  nombre: string
  tieneCuenta: boolean
  soyYo: boolean
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [seguro, setSeguro] = useState<'acceso' | 'borrar' | null>(null)

  if (soyYo)
    return (
      <p className="text-2xs text-gris-50">
        Sos vos: no podés quitarte el acceso ni borrarte a vos mismo.
      </p>
    )

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo.')
      else {
        setSeguro(null)
        router.refresh()
      }
    })
  }

  const primer = nombre.split(' ')[0]

  return (
    <div className="flex flex-col gap-2">
      {seguro === null && (
        <span className="flex flex-wrap gap-2">
          {tieneCuenta && (
            <button type="button" onClick={() => setSeguro('acceso')} className="boton boton-peligro boton-chico">
              Quitarle el acceso
            </button>
          )}
          <button type="button" onClick={() => setSeguro('borrar')} className="boton boton-peligro boton-chico">
            Borrarla del sistema
          </button>
        </span>
      )}

      {seguro === 'acceso' && (
        <div className="surge flex flex-col gap-2 rounded-lg border border-rojo bg-rojo-aire p-3">
          <p className="max-w-[60ch] text-sm text-tinta">
            <span className="font-medium">{primer}</span> deja de poder entrar y su ficha queda
            inactiva. Su nombre sigue en los proyectos donde participó y su plata queda donde está:
            eso ya pasó y no se borra.
          </p>
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => quitarAcceso(personaId))}
              className="boton boton-principal boton-chico"
            >
              {pendiente ? 'Quitando…' : 'Sí, quitarle el acceso'}
            </button>
            <button type="button" onClick={() => setSeguro(null)} className="boton boton-sutil boton-chico">
              No
            </button>
          </span>
        </div>
      )}

      {seguro === 'borrar' && (
        <div className="surge flex flex-col gap-2 rounded-lg border border-rojo bg-rojo-aire p-3">
          <p className="max-w-[60ch] text-sm text-tinta">
            Desaparece del sistema. Solo funciona si nunca participó de nada ni cobró: si tiene
            historia, el sistema no va a dejar y te va a decir por qué.
          </p>
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => borrarPersona(personaId))}
              className="rounded-md bg-rojo px-2.5 py-1 text-2xs font-medium text-white
                         transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
            >
              {pendiente ? 'Borrando…' : 'Sí, borrarla'}
            </button>
            <button type="button" onClick={() => setSeguro(null)} className="boton boton-sutil boton-chico">
              No
            </button>
          </span>
        </div>
      )}

      {error && <p className="text-2xs font-medium text-rojo">{error}</p>}
    </div>
  )
}
