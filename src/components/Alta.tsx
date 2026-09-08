'use client'

import { useState, useTransition } from 'react'
import { crearCliente, crearProyecto } from '@/app/acciones'

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

function Boton({ children, pendiente }: { children: React.ReactNode; pendiente: boolean }) {
  return (
    <button
      type="submit"
      disabled={pendiente}
      className="rounded-md bg-azul-hondo px-3.5 py-1.5 text-sm font-medium text-white
                 transition-colors duration-150 hover:bg-azul disabled:opacity-50"
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
          if (r && !r.ok) setError(r.error)
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
          className="px-2 py-1.5 text-sm text-gris hover:text-tinta"
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

export function NuevoProyecto({
  clientes,
  arrancaComo = 'proyecto',
}: {
  /* Con cuántos proyectos viene cada uno: al elegirlo se ve si es un
     cliente de siempre o alguien con quien recién empezamos. */
  clientes: { id: string; nombre: string; proyectos: number; enVivo: number }[]
  arrancaComo?: 'proyecto' | 'oportunidad'
}) {
  const [abierto, setAbierto] = useState(false)
  const [cliente, setCliente] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  const esOportunidad = arrancaComo === 'oportunidad'
  const elegido = clientes.find((c) => c.id === cliente)

  if (!abierto)
    return (
      <Abrir
        texto={esOportunidad ? 'Nueva oportunidad' : 'Nuevo proyecto'}
        onClick={() => setAbierto(true)}
      />
    )

  return (
    <form
      action={(fd) => {
        setError(null)
        empezar(async () => {
          const r = await crearProyecto(fd)
          if (r && !r.ok) setError(r.error)
        })
      }}
      className="flex w-full flex-col gap-3 rounded-lg border border-azul bg-azul-aire p-4"
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight text-tinta">
          {esOportunidad ? 'Nueva oportunidad' : 'Nuevo proyecto'}
        </h2>
        <p className="max-w-[65ch] text-sm text-gris">
          {esOportunidad
            ? 'Tres datos y listo. El monto recién hace falta cuando haya cotización: pedirlo antes es lo que hace que nadie cargue nada.'
            : 'El código se genera solo a partir del cliente. Monto, fecha y responsable se cargan adentro.'}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-0.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">Cliente</span>
          <select
            name="cliente"
            required
            autoFocus
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className={`${campo} w-64 cursor-pointer`}
          >
            <option value="">elegir cliente</option>
            <option value="nuevo">＋ Cliente nuevo</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.proyectos > 0 ? ` · ${c.proyectos} proyecto${c.proyectos > 1 ? 's' : ''}` : ' · sin historia'}
              </option>
            ))}
          </select>
        </label>

        {cliente === 'nuevo' && (
          <label className="flex flex-col gap-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-azul-hondo">
              Nombre del cliente nuevo
            </span>
            <input
              name="cliente_nuevo"
              required
              placeholder="Vision Motors"
              className={`${campo} w-56 border-azul`}
            />
          </label>
        )}

        <label className="flex flex-col gap-0.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">Qué es</span>
          <input
            name="nombre"
            required
            placeholder="Agente conversacional"
            className={`${campo} w-64`}
          />
        </label>

        <input type="hidden" name="arranca" value={arrancaComo} />

        <Boton pendiente={pendiente}>{esOportunidad ? 'Crear oportunidad' : 'Crear proyecto'}</Boton>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="px-2 py-1.5 text-sm text-gris hover:text-tinta"
        >
          Cancelar
        </button>
      </div>

      {elegido && (
        <p className="text-2xs text-gris-50">
          {elegido.proyectos === 0
            ? 'Cliente sin historia todavía: éste sería el primero.'
            : `Ya tiene ${elegido.proyectos} proyecto${elegido.proyectos > 1 ? 's' : ''} en la cuenta${
                elegido.enVivo > 0 ? `, ${elegido.enVivo} en vivo` : ''
              }.`}
        </p>
      )}

      {cliente === 'nuevo' && (
        <p className="text-2xs text-gris-50">
          Se crea la cuenta con su razón social y su marca. Los alias y las demás empresas se
          agregan después desde la ficha del cliente.
        </p>
      )}

      {error && <p className="text-sm text-rojo">{error}</p>}
    </form>
  )
}
