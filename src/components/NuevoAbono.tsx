'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { crearAbono } from '@/app/acciones'

/* Hay trabajos que arrancan siendo mantenimiento: hosting, redes,
   soporte de algo que hizo otro. Sin esto la única forma de cargarlos
   era inventar un proyecto para poder cerrarlo, que es justo el tipo de
   dato falso que después ensucia todos los números. */

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

const rotulo = 'text-2xs font-medium uppercase tracking-wider text-gris-50'

export default function NuevoAbono({
  clientes,
  personas,
  servicios,
  hoy,
}: {
  clientes: { id: string; nombre: string }[]
  personas: { id: string; nombre: string }[]
  servicios: { id: string; nombre: string }[]
  hoy: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [cliente, setCliente] = useState('')

  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-fit rounded-md bg-azul-hondo px-3.5 py-1.5 text-sm font-medium text-white
                   transition-colors duration-150 hover:bg-azul"
      >
        Nuevo abono
      </button>
    )

  return (
    <form
      action={(fd) => {
        setError(null)
        empezar(async () => {
          const r = await crearAbono(fd)
          if (r.ok && r.ir) router.push(r.ir)
          else if (!r.ok) setError(r.error)
        })
      }}
      className="surge flex w-full flex-col gap-4 rounded-lg border border-azul bg-azul-aire p-4"
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight text-tinta">Nuevo abono</h2>
        <p className="max-w-[70ch] text-sm text-gris">
          Para lo que arranca siendo mantenimiento y no tuvo un desarrollo antes: hosting, redes,
          soporte de algo que hizo otro. No hace falta inventarle un proyecto de origen.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>De quién</span>
          <select
            name="cliente_id"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className={campo}
            required
            autoFocus
          >
            <option value="">elegí…</option>
            <option value="nuevo">Un cliente nuevo</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        {cliente === 'nuevo' && (
          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Cómo se llama</span>
            <input name="cliente_nuevo" placeholder="Vision Motors" className={campo} />
          </label>
        )}

        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>De qué es</span>
          <input name="nombre" required placeholder="Hosting y soporte" className={campo} />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Qué servicio</span>
          <select name="servicio_id" defaultValue="" className={campo}>
            <option value="">sin clasificar</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Cuánto por mes</span>
          <span className="flex gap-2">
            <input
              name="monto_mensual"
              required
              inputMode="decimal"
              placeholder="45.000"
              className={`${campo} cifra min-w-0 flex-1`}
            />
            <select name="moneda" defaultValue="ARS" className={`${campo} w-24`} aria-label="Moneda">
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </span>
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Vigente desde</span>
          <input
            name="vigencia_desde"
            type="date"
            required
            defaultValue={hoy}
            className={`${campo} cifra`}
          />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Responsable</span>
          <select name="responsable_id" defaultValue="" className={campo}>
            <option value="">sin asignar</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex w-fit items-center gap-2 text-sm text-gris">
        <input
          name="renovacion"
          type="checkbox"
          defaultChecked
          className="size-3.5 accent-[var(--color-azul-hondo)]"
        />
        Se renueva solo mientras nadie lo dé de baja
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-azul-hondo px-3.5 py-1.5 text-sm font-medium text-white
                     transition-colors duration-150 hover:bg-azul disabled:opacity-50"
        >
          {pendiente ? 'Creando…' : 'Crear el abono'}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="px-2 py-1.5 text-sm text-gris hover:text-tinta"
        >
          Cancelar
        </button>
        {error && <span className="text-sm text-rojo">{error}</span>}
      </div>

      <p className="text-2xs text-gris-50">
        Nace vigente y sin anticipo: un abono no arranca contra un pago inicial, arranca y se cobra
        todos los meses.
      </p>
    </form>
  )
}
