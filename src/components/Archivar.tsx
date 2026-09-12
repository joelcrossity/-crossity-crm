'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { archivarProyecto, desarchivarProyecto } from '@/app/acciones'

/* ------------------------------------------------------------------
   Sacar algo del escritorio, o traerlo de vuelta.

   No borra ni cambia ningún número: el proyecto sigue entero, con su
   plata, su historia y su reparto. Solo deja de aparecer en las listas
   del día. Por eso no pide confirmación con cartel rojo — es
   reversible, y tratarlo como si no lo fuera haría que nadie lo use.
   ------------------------------------------------------------------ */

export default function Archivar({
  proyectoId,
  archivado,
  sugerido,
}: {
  proyectoId: string
  archivado: boolean
  /* Se ofrece con más énfasis cuando el trabajo ya cerró: ése es el
     momento en que archivar tiene sentido y en el que nadie se acuerda. */
  sugerido?: boolean
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo.')
      else router.refresh()
    })
  }

  if (archivado)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gris">
          Está archivado: no aparece en las listas del día.
        </span>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => correr(() => desarchivarProyecto(proyectoId))}
          className="boton boton-secundario boton-chico"
        >
          {pendiente ? 'Restaurando…' : 'Traerlo de vuelta'}
        </button>
        {error && <span className="text-2xs text-rojo">{error}</span>}
      </div>
    )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => correr(() => archivarProyecto(proyectoId))}
        className={sugerido ? 'boton boton-secundario boton-chico' : 'boton boton-sutil boton-chico'}
      >
        {pendiente ? 'Archivando…' : 'Archivar'}
      </button>
      <span className="text-2xs text-gris-50">
        {sugerido
          ? 'Ya cerró: sacalo del escritorio. No se borra nada y vuelve cuando quieras.'
          : 'Sale de las listas del día. No se borra nada.'}
      </span>
      {error && <span className="text-2xs text-rojo">{error}</span>}
    </div>
  )
}
