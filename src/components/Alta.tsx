'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { crearCliente } from '@/app/acciones'

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

function Boton({ children, pendiente }: { children: React.ReactNode; pendiente: boolean }) {
  return (
    <button
      type="submit"
      disabled={pendiente}
      className="boton boton-principal"
    >
      {pendiente ? 'Creando…' : children}
    </button>
  )
}

function Abrir({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-fit rounded-md bg-azul-hondo px-3.5 py-1.5 text-sm font-medium text-white
                 transition-colors duration-150 hover:bg-azul"
    >
      {texto}
    </button>
  )
}

export function NuevoCliente() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  if (!abierto) return <Abrir texto="Nuevo cliente" onClick={() => setAbierto(true)} />

  return (
    <form
      action={(fd) => {
        setError(null)
        empezar(async () => {
          const r = await crearCliente(fd)
          if (r.ok && r.ir) router.push(r.ir)
          else if (!r.ok) setError(r.error)
        })
      }}
      className="flex w-full flex-col gap-3 rounded-lg border border-azul bg-azul-aire p-4"
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight text-tinta">Nuevo cliente</h2>
        <p className="max-w-[65ch] text-sm text-gris">
          El código se genera solo. Después le agregás sus razones sociales y sus marcas si factura
          por más de una empresa.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-0.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">Nombre</span>
          <input name="nombre" required autoFocus placeholder="Vision Motors" className={`${campo} w-56`} />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
            También aparece como
          </span>
          <input
            name="alias"
            placeholder="Vision motor, VISION MOTORS"
            className={`${campo} w-72`}
          />
        </label>
        <Boton pendiente={pendiente}>Crear cliente</Boton>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="boton boton-sutil"
        >
          Cancelar
        </button>
      </div>

      <p className="text-2xs text-gris-50">
        Los alias separados por coma. Sirven para que el mismo cliente escrito de dos formas no se
        duplique, y para que la captura por WhatsApp sepa a quién pertenece un mensaje.
      </p>
      {error && <p className="text-sm text-rojo">{error}</p>}
    </form>
  )
}
