'use client'

import { useState, useTransition, useRef } from 'react'
import type { Resultado } from '@/app/acciones'

/* ------------------------------------------------------------------
   Edición en el lugar. Nada de modales para cambiar una fecha: se
   toca el dato, se cambia, se guarda solo. La fricción es el enemigo.
   ------------------------------------------------------------------ */

const base =
  'w-full rounded-md border bg-superficie px-2 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 disabled:opacity-50 ' +
  'hover:border-linea-fuerte focus:border-violeta'

function Estado({ guardando, error, ok }: { guardando: boolean; error: string | null; ok: boolean }) {
  if (guardando) return <span className="text-2xs text-tinta-3">guardando…</span>
  if (error) return <span className="text-2xs text-rojo">{error}</span>
  if (ok) return <span className="text-2xs text-verde">guardado</span>
  return null
}

function useGuardado() {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)

  function correr(fn: () => Promise<Resultado>) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (r.ok) {
        setOk(true)
        if (reloj.current) clearTimeout(reloj.current)
        reloj.current = setTimeout(() => setOk(false), 2000)
      } else {
        setError(r.error)
      }
    })
  }

  return { pendiente, error, ok, correr }
}

export function Select({
  etiqueta,
  valor,
  opciones,
  alCambiar,
  vacio,
}: {
  etiqueta: string
  valor: string | null
  opciones: { valor: string; texto: string }[]
  alCambiar: (v: string) => Promise<Resultado>
  vacio?: string
}) {
  const { pendiente, error, ok, correr } = useGuardado()
  const [local, setLocal] = useState(valor ?? '')

  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline gap-2">
        <span className="text-2xs font-medium uppercase tracking-wider text-tinta-3">{etiqueta}</span>
        <Estado guardando={pendiente} error={error} ok={ok} />
      </span>
      <select
        value={local}
        disabled={pendiente}
        onChange={(e) => {
          setLocal(e.target.value)
          correr(() => alCambiar(e.target.value))
        }}
        className={`${base} ${error ? 'border-rojo' : 'border-linea'} cursor-pointer`}
      >
        {vacio && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Fecha({
  etiqueta,
  valor,
  alCambiar,
}: {
  etiqueta: string
  valor: string | null
  alCambiar: (v: string) => Promise<Resultado>
}) {
  const { pendiente, error, ok, correr } = useGuardado()
  const [local, setLocal] = useState(valor ?? '')

  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline gap-2">
        <span className="text-2xs font-medium uppercase tracking-wider text-tinta-3">{etiqueta}</span>
        <Estado guardando={pendiente} error={error} ok={ok} />
      </span>
      <input
        type="date"
        value={local}
        disabled={pendiente}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => local !== (valor ?? '') && correr(() => alCambiar(local))}
        className={`${base} cifra ${error ? 'border-rojo' : local ? 'border-linea' : 'border-rojo/40'}`}
      />
    </label>
  )
}

export function Numero({
  etiqueta,
  valor,
  alCambiar,
  ayuda,
}: {
  etiqueta: string
  valor: number | null
  alCambiar: (v: string) => Promise<Resultado>
  ayuda?: string
}) {
  const { pendiente, error, ok, correr } = useGuardado()
  const [local, setLocal] = useState(valor?.toString() ?? '')

  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline gap-2">
        <span className="text-2xs font-medium uppercase tracking-wider text-tinta-3">{etiqueta}</span>
        <Estado guardando={pendiente} error={error} ok={ok} />
      </span>
      <input
        type="number"
        min={1}
        value={local}
        placeholder="—"
        disabled={pendiente}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => local !== (valor?.toString() ?? '') && correr(() => alCambiar(local))}
        className={`${base} cifra ${error ? 'border-rojo' : 'border-linea'}`}
      />
      {ayuda && <span className="text-2xs text-tinta-3">{ayuda}</span>}
    </label>
  )
}

export function Texto({
  etiqueta,
  valor,
  marcador,
  alCambiar,
}: {
  etiqueta: string
  valor: string | null
  marcador: string
  alCambiar: (v: string) => Promise<Resultado>
}) {
  const { pendiente, error, ok, correr } = useGuardado()
  const [local, setLocal] = useState(valor ?? '')

  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline gap-2">
        <span className="text-2xs font-medium uppercase tracking-wider text-tinta-3">{etiqueta}</span>
        <Estado guardando={pendiente} error={error} ok={ok} />
      </span>
      <input
        type="text"
        value={local}
        placeholder={marcador}
        disabled={pendiente}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => local !== (valor ?? '') && correr(() => alCambiar(local))}
        className={`${base} ${error ? 'border-rojo' : 'border-linea'} placeholder:text-tinta-3`}
      />
    </label>
  )
}

export function Casilla({
  etiqueta,
  marcado,
  alCambiar,
}: {
  etiqueta: string
  marcado: boolean
  alCambiar: (v: boolean) => Promise<Resultado>
}) {
  const { pendiente, error, correr } = useGuardado()
  const [local, setLocal] = useState(marcado)

  return (
    <label
      className="group inline-flex cursor-pointer items-center gap-2 select-none"
      title={error ?? undefined}
    >
      <input
        type="checkbox"
        checked={local}
        disabled={pendiente}
        onChange={(e) => {
          setLocal(e.target.checked)
          correr(() => alCambiar(e.target.checked))
        }}
        className="size-3.5 cursor-pointer accent-violeta"
      />
      <span
        className={`text-xs transition-colors duration-150 ${
          error ? 'text-rojo' : local ? 'text-tinta' : 'text-tinta-3 group-hover:text-tinta-2'
        }`}
      >
        {etiqueta}
      </span>
    </label>
  )
}
