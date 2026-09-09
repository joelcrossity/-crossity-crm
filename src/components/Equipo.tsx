'use client'

import { useState, useTransition } from 'react'
import { sumarAlEquipo, sacarDelEquipo, fecharHito } from '@/app/acciones'
import type { Resultado } from '@/app/acciones'

const ROLES = [
  { valor: 'desarrollo', texto: 'desarrollo' },
  { valor: 'project_manager', texto: 'project manager' },
  { valor: 'vendedor', texto: 'vendedor' },
  { valor: 'coordinacion', texto: 'coordinación' },
  { valor: 'administracion', texto: 'administración' },
]

export type Miembro = {
  id: string
  rol: string
  personas: { nombre: string } | null
}

export function Equipo({
  proyectoId,
  miembros,
  personas,
  editable,
}: {
  proyectoId: string
  miembros: Miembro[]
  personas: { id: string; nombre: string }[]
  editable: boolean
}) {
  const [sumando, setSumando] = useState(false)
  const [quien, setQuien] = useState('')
  const [rol, setRol] = useState('desarrollo')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  const yaEstan = new Set(miembros.map((m) => m.personas?.nombre))
  const libres = personas.filter((p) => !yaEstan.has(p.nombre))

  return (
    <div className="flex flex-col gap-3">
      {miembros.length === 0 ? (
        <p className="text-sm text-gris">Todavía no hay nadie asignado.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {miembros.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-md border border-linea bg-superficie px-2.5 py-1.5"
            >
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-tinta">{m.personas?.nombre}</span>
                <span className="text-2xs text-gris-50">{m.rol.replace(/_/g, ' ')}</span>
              </span>
              {editable && <Sacar asignacionId={m.id} />}
            </li>
          ))}
        </ul>
      )}

      {editable &&
        (sumando ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              empezar(async () => {
                const r = await sumarAlEquipo(proyectoId, quien, rol)
                if (r.ok) {
                  setSumando(false)
                  setQuien('')
                } else setError(r.error)
              })
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <select
              value={quien}
              onChange={(e) => setQuien(e.target.value)}
              className="rounded-md border border-linea bg-superficie px-2 py-1.5 text-sm"
              autoFocus
            >
              <option value="">elegir persona</option>
              {libres.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className="rounded-md border border-linea bg-superficie px-2 py-1.5 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.texto}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pendiente}
              className="boton boton-principal"
            >
              {pendiente ? 'Sumando…' : 'Sumar'}
            </button>
            <button
              type="button"
              onClick={() => setSumando(false)}
              className="boton boton-sutil"
            >
              Cancelar
            </button>
            {error && <span className="w-full text-2xs text-rojo">{error}</span>}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setSumando(true)}
            className="boton boton-secundario w-fit"
          >
            Sumar a alguien
          </button>
        ))}
    </div>
  )
}

function Sacar({ asignacionId }: { asignacionId: string }) {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <button
      type="button"
      title={error ?? 'Sacar del equipo'}
      aria-label="Sacar del equipo"
      disabled={pendiente}
      onClick={() =>
        empezar(async () => {
          const r = await sacarDelEquipo(asignacionId)
          if (!r.ok) setError(r.error)
        })
      }
      className={`text-sm leading-none transition-colors duration-150 ${
        error ? 'text-rojo' : 'text-gris-50 hover:text-rojo'
      }`}
    >
      ×
    </button>
  )
}

/* Los tres hechos de una entrega, cada uno con su fecha propia.
   Se puede cobrar sin haber facturado, y facturar mucho después. */
export function FechaHito({
  hitoId,
  campo,
  etiqueta,
  valor,
}: {
  hitoId: string
  campo: 'entregado_at' | 'facturado_at' | 'vence_at'
  etiqueta: string
  valor: string | null
}) {
  const [local, setLocal] = useState(valor ? valor.slice(0, 10) : '')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  function guardar(v: string) {
    setError(null)
    empezar(async () => {
      const r: Resultado = await fecharHito(hitoId, campo, v)
      if (!r.ok) setError(r.error)
    })
  }

  return (
    <label className="flex flex-col gap-0.5" title={error ?? undefined}>
      <span
        className={`text-2xs uppercase tracking-wider ${
          error ? 'text-rojo' : local ? 'text-verde' : 'text-gris-50'
        }`}
      >
        {etiqueta}
      </span>
      <input
        type="date"
        value={local}
        disabled={pendiente}
        onChange={(e) => {
          setLocal(e.target.value)
          guardar(e.target.value)
        }}
        className={`cifra w-32 rounded border px-1.5 py-1 text-sm transition-colors duration-150
                    ${error ? 'border-rojo' : local ? 'border-linea text-tinta' : 'border-transparent text-gris-50'}
                    hover:border-linea-fuerte focus:border-azul disabled:opacity-50`}
      />
    </label>
  )
}
