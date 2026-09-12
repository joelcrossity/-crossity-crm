'use client'

import { useState, useTransition } from 'react'
import {
  agregarContacto,
  agregarMarca,
  agregarRazonSocial,
  borrarDelCliente,
  cambiarAlias,
  cambiarCliente,
} from '@/app/acciones'
import type { Resultado } from '@/app/acciones'

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

function useGuardado() {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  function correr(fn: () => Promise<Resultado>, alTerminar?: () => void) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (r.ok) {
        setOk(true)
        setTimeout(() => setOk(false), 1800)
        alTerminar?.()
      } else setError(r.error)
    })
  }
  return { pendiente, error, ok, correr }
}

function Aviso({ ok, error }: { ok: boolean; error: string | null }) {
  if (error) return <span className="text-2xs text-rojo">{error}</span>
  if (ok) return <span className="text-2xs text-verde">guardado</span>
  return null
}

export function DatoCliente({
  id,
  campo: cual,
  etiqueta,
  valor,
  marcador,
  ancho = 'w-64',
}: {
  id: string
  campo: 'nombre_canonico' | 'cuit' | 'notas'
  etiqueta: string
  valor: string | null
  marcador?: string
  ancho?: string
}) {
  const { pendiente, error, ok, correr } = useGuardado()
  const [local, setLocal] = useState(valor ?? '')

  return (
    <label className="flex flex-col gap-0.5">
      <span className="flex items-baseline gap-2">
        <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">{etiqueta}</span>
        <Aviso ok={ok} error={error} />
      </span>
      <input
        value={local}
        placeholder={marcador}
        disabled={pendiente}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => local !== (valor ?? '') && correr(() => cambiarCliente(id, cual, local))}
        className={`${campo} ${ancho} ${error ? 'border-rojo' : ''}`}
      />
    </label>
  )
}

export function AliasCliente({ id, alias }: { id: string; alias: string[] }) {
  const { pendiente, error, ok, correr } = useGuardado()
  const [local, setLocal] = useState(alias.join(', '))

  return (
    <label className="flex flex-col gap-0.5">
      <span className="flex items-baseline gap-2">
        <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
          También aparece como
        </span>
        <Aviso ok={ok} error={error} />
      </span>
      <input
        value={local}
        placeholder="Vision motor, VISION MOTORS"
        disabled={pendiente}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => local !== alias.join(', ') && correr(() => cambiarAlias(id, local))}
        className={`${campo} w-full max-w-lg ${error ? 'border-rojo' : ''}`}
      />
      <span className="text-2xs text-gris-50">
        Separados por coma. Evitan que el mismo cliente escrito de dos formas se duplique.
      </span>
    </label>
  )
}

function Borrar({ tabla, id }: { tabla: 'razones_sociales' | 'marcas' | 'contactos'; id: string }) {
  const { pendiente, error, correr } = useGuardado()
  return (
    <button
      type="button"
      aria-label="Borrar"
      title={error ?? 'Borrar'}
      disabled={pendiente}
      onClick={() => correr(() => borrarDelCliente(tabla, id))}
      className={`text-sm leading-none transition-colors duration-150 ${
        error ? 'text-rojo' : 'text-gris-50 hover:text-rojo'
      }`}
    >
      ×
    </button>
  )
}

export function Lista({
  titulo,
  ayuda,
  items,
  tabla,
  organizacionId,
  tipo,
}: {
  titulo: string
  ayuda: string
  items: { id: string; principal: string; secundario?: string | null; esPrincipal?: boolean }[]
  tabla: 'razones_sociales' | 'marcas' | 'contactos'
  organizacionId: string
  tipo: 'razon' | 'marca' | 'contacto'
}) {
  const { pendiente, error, correr } = useGuardado()
  const [abierto, setAbierto] = useState(false)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [c, setC] = useState('')

  function agregar() {
    const fn =
      tipo === 'razon'
        ? () => agregarRazonSocial(organizacionId, a, b)
        : tipo === 'marca'
          ? () => agregarMarca(organizacionId, a)
          : () => agregarContacto(organizacionId, a, b, c, '')
    correr(fn, () => {
      setA('')
      setB('')
      setC('')
      setAbierto(false)
    })
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight">{titulo}</h2>
        <p className="max-w-[65ch] text-sm text-gris">{ayuda}</p>
      </div>

      {items.length > 0 && (
        <ul className="divide-y divide-linea overflow-hidden tarjeta">
          {items.map((i) => (
            <li key={i.id} className="flex items-baseline justify-between gap-4 px-3.5 py-2.5">
              <span className="min-w-0">
                <span className="text-base font-medium text-tinta">
                  {i.principal}
                  {i.esPrincipal && (
                    <span className="ml-2 text-2xs font-normal text-azul-hondo">principal</span>
                  )}
                </span>
                {i.secundario && (
                  <span className="cifra block text-2xs text-gris-50">{i.secundario}</span>
                )}
              </span>
              {!i.esPrincipal && <Borrar tabla={tabla} id={i.id} />}
            </li>
          ))}
        </ul>
      )}

      {abierto ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-azul bg-azul-aire p-3">
          <input
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder={tipo === 'contacto' ? 'Nombre' : tipo === 'marca' ? 'Marca' : 'Razón social'}
            className={`${campo} w-56`}
            autoFocus
          />
          {tipo !== 'marca' && (
            <input
              value={b}
              onChange={(e) => setB(e.target.value)}
              placeholder={tipo === 'contacto' ? 'Qué hace' : 'CUIT'}
              className={`${campo} w-40`}
            />
          )}
          {tipo === 'contacto' && (
            <input
              value={c}
              onChange={(e) => setC(e.target.value)}
              placeholder="Correo"
              className={`${campo} w-56`}
            />
          )}
          <button
            type="button"
            disabled={pendiente}
            onClick={agregar}
            className="boton boton-principal"
          >
            {pendiente ? 'Agregando…' : 'Agregar'}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="boton boton-sutil"
          >
            Cancelar
          </button>
          {error && <span className="w-full text-2xs text-rojo">{error}</span>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="boton boton-secundario w-fit"
        >
          {tipo === 'razon' ? 'Sumar razón social' : tipo === 'marca' ? 'Sumar marca' : 'Sumar contacto'}
        </button>
      )}
    </section>
  )
}
