'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { asignarCliente } from '@/app/acciones'

/* La charla se anotó sin saber de quién era. Ahora sí se sabe: se mueve
   de la sala de espera a su cuenta, y de ahí en adelante es un cliente
   como cualquier otro. */

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

export default function AsignarCliente({
  proyectoId,
  clientes,
}: {
  proyectoId: string
  clientes: { id: string; nombre: string }[]
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [elegido, setElegido] = useState('')
  const [nuevo, setNuevo] = useState('')

  return (
    <section className="surge flex flex-col gap-3 rounded-lg border border-amarillo bg-amarillo-aire p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight text-tinta">Falta decir de quién es</h2>
        <p className="max-w-[70ch] text-sm text-gris">
          Se anotó sin cliente, que estuvo bien: cargarla igual es mejor que perderla. Pero hasta
          que tenga cuenta no se puede cotizar ni facturar.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <select
          value={elegido}
          onChange={(e) => setElegido(e.target.value)}
          className={`${campo} w-64`}
          aria-label="Cliente"
        >
          <option value="">elegí…</option>
          <option value="nuevo">Es un cliente nuevo</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        {elegido === 'nuevo' && (
          <input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder="Cómo se llama"
            className={`${campo} w-56`}
            autoFocus
          />
        )}

        <button
          type="button"
          disabled={pendiente || !elegido}
          onClick={() => {
            setError(null)
            empezar(async () => {
              const r = await asignarCliente(proyectoId, elegido, nuevo)
              if (!r.ok) setError(r.error)
              else router.refresh()
            })
          }}
          className="boton boton-principal"
        >
          {pendiente ? 'Asignando…' : 'Asignar'}
        </button>

        {error && <span className="text-sm text-rojo">{error}</span>}
      </div>
    </section>
  )
}
