'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cambiarRoles, otorgarPermiso, quitarPermiso } from '@/app/acciones'

/* ------------------------------------------------------------------
   Quién puede qué.

   Tres capas, de la más gruesa a la más fina:
     el rol       — lo que puede hacer en general
     la apertura  — cuánto ve de la plata de un proyecto
     el permiso   — la excepción puntual, en un proyecto y una acción

   La regla que hace que esto no sea peligroso: el permiso SUMA, nunca
   resta. Se otorga sobre lo que el rol ya permite; quitarlo devuelve a
   lo que el rol dice. Una excepción se anota como excepción, que es
   distinto de cambiar la regla para todos.
   ------------------------------------------------------------------ */

export type Miembro = {
  id: string
  nombre: string
  email: string | null
  roles: string[]
  es_externa: boolean
  activa: boolean
  tiene_cuenta: boolean
  en_equipos: number
  participa_en: number
  permisos_dados: number
}

export type Permiso = {
  id: string
  persona_id: string
  proyecto_id: string
  accion: string
  motivo: string | null
}

const ROLES: [string, string][] = [
  ['direccion', 'Dirección'],
  ['coordinacion', 'Coordinación'],
  ['project_manager', 'Project manager'],
  ['vendedor', 'Vendedor'],
  ['administracion', 'Administración'],
  ['desarrollo', 'Desarrollo'],
]

const ACCIONES: [string, string, string][] = [
  ['ver_facturacion', 'Ver la facturación', 'cuánto se cotizó, qué se facturó y si pagó'],
  ['ver_economia', 'Ver la economía de adentro', 'costos y cuánto cobra cada uno'],
  ['cargar_cobros', 'Cargar cobros', 'registrar que entró la plata'],
  ['cambiar_montos', 'Cambiar montos', 'tocar el precio del proyecto'],
  ['configurar_equipo', 'Armar el equipo', 'sumar y sacar gente'],
  ['ver_comercial', 'Ver lo comercial', 'lo que se habló en el embudo'],
]

const NOMBRE_ACCION = new Map(ACCIONES.map(([v, t]) => [v, t]))
const NOMBRE_ROL = new Map(ROLES)

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 hover:border-linea-fuerte focus:border-azul'

const rotulo = 'text-2xs font-medium uppercase tracking-wider text-gris-50'

export default function Permisos({
  equipo,
  permisos,
  proyectos,
  puedeConfigurar,
  esDireccion,
}: {
  equipo: Miembro[]
  permisos: Permiso[]
  proyectos: { id: string; nombre: string; codigo: string }[]
  puedeConfigurar: boolean
  esDireccion: boolean
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [proyecto, setProyecto] = useState('')
  const [accion, setAccion] = useState('ver_facturacion')
  const [motivo, setMotivo] = useState('')

  const nombreProyecto = new Map(proyectos.map((p) => [p.id, p.nombre]))

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>, alTerminar?: () => void) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo guardar.')
      else {
        alTerminar?.()
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[70ch] text-sm text-gris">
        Hay tres capas: el <span className="font-medium text-tinta">rol</span> dice lo que puede
        hacer en general, la <span className="font-medium text-tinta">apertura</span> cuánto ve de
        la plata de cada proyecto, y el <span className="font-medium text-tinta">permiso</span> es
        la excepción puntual. Los permisos suman: nunca sacan algo que el rol ya da.
      </p>

      {error && (
        <p className="surge rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      <ul className="escalona flex flex-col gap-2">
        {equipo.map((m) => {
          const suyos = permisos.filter((p) => p.persona_id === m.id)
          const editando = abierta === m.id

          return (
            <li
              key={m.id}
              className="flex flex-col gap-3 rounded-lg border border-linea bg-superficie p-3.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                <span className="min-w-0">
                  <span className="text-base font-bold tracking-tight text-tinta">
                    {m.nombre}
                    {m.es_externa && (
                      <span className="ml-2 text-2xs font-normal text-gris-50">externa</span>
                    )}
                  </span>
                  <span className="cifra block truncate text-2xs text-gris-50">
                    {m.email ?? 'sin correo'}
                    {m.tiene_cuenta ? ' · entra al sistema' : ' · sin cuenta, igual cobra'}
                    {m.en_equipos > 0 && ` · en ${m.en_equipos} equipos`}
                  </span>
                </span>

                {puedeConfigurar && (
                  <button
                    type="button"
                    onClick={() => setAbierta(editando ? null : m.id)}
                    className="shrink-0 rounded-md border border-linea px-2.5 py-1 text-2xs text-gris
                               transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
                  >
                    {editando ? 'Listo' : 'Dar un permiso'}
                  </button>
                )}
              </div>

              {/* Roles */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={rotulo}>Roles</span>
                {ROLES.map(([valor, texto]) => {
                  const puesto = m.roles.includes(valor)
                  return (
                    <button
                      key={valor}
                      type="button"
                      disabled={!esDireccion || pendiente}
                      aria-pressed={puesto}
                      onClick={() =>
                        correr(() =>
                          cambiarRoles(
                            m.id,
                            puesto ? m.roles.filter((r) => r !== valor) : [...m.roles, valor],
                          ),
                        )
                      }
                      className={`rounded-full border px-2 py-0.5 text-2xs transition-colors duration-150
                                  disabled:cursor-default disabled:opacity-70 ${
                                    puesto
                                      ? 'border-azul-hondo bg-azul-aire font-medium text-azul-hondo'
                                      : 'border-linea text-gris-50 enabled:hover:border-azul'
                                  }`}
                    >
                      {texto}
                    </button>
                  )
                })}
                {!esDireccion && (
                  <span className="text-2xs text-gris-50">solo dirección los cambia</span>
                )}
              </div>

              {/* Permisos puntuales */}
              {suyos.length > 0 && (
                <ul className="flex flex-col gap-1 border-t border-linea pt-2.5">
                  {suyos.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                    >
                      <span className="min-w-0 text-sm text-gris">
                        <span className="font-medium text-tinta">
                          {NOMBRE_ACCION.get(p.accion) ?? p.accion}
                        </span>
                        {' en '}
                        {nombreProyecto.get(p.proyecto_id) ?? 'un proyecto'}
                        {p.motivo && (
                          <span className="block text-2xs text-gris-50">{p.motivo}</span>
                        )}
                      </span>
                      {puedeConfigurar && (
                        <button
                          type="button"
                          disabled={pendiente}
                          onClick={() =>
                            correr(() => quitarPermiso(p.persona_id, p.proyecto_id, p.accion))
                          }
                          className="shrink-0 text-2xs text-gris-50 transition-colors duration-150 hover:text-rojo"
                        >
                          quitar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {editando && (
                <div className="surge flex flex-wrap items-end gap-2 rounded-md border border-azul bg-azul-aire p-3">
                  <label className="flex flex-col gap-0.5">
                    <span className={rotulo}>En qué proyecto</span>
                    <select
                      value={proyecto}
                      onChange={(e) => setProyecto(e.target.value)}
                      className={`${campo} w-56`}
                    >
                      <option value="">elegí…</option>
                      {proyectos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-0.5">
                    <span className={rotulo}>Qué puede hacer</span>
                    <select
                      value={accion}
                      onChange={(e) => setAccion(e.target.value)}
                      className={`${campo} w-56`}
                    >
                      {ACCIONES.map(([v, t]) => (
                        <option key={v} value={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex min-w-48 flex-1 flex-col gap-0.5">
                    <span className={rotulo}>Por qué</span>
                    <input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Está cubriendo a Germán este mes"
                      className={campo}
                    />
                  </label>

                  <button
                    type="button"
                    disabled={pendiente || !proyecto}
                    onClick={() =>
                      correr(
                        () => otorgarPermiso(m.id, proyecto, accion, motivo),
                        () => {
                          setProyecto('')
                          setMotivo('')
                          setAbierta(null)
                        },
                      )
                    }
                    className="rounded-md bg-azul-hondo px-3 py-1.5 text-sm font-medium text-white
                               transition-colors duration-150 hover:bg-azul disabled:opacity-40"
                  >
                    Dárselo
                  </button>

                  <p className="w-full text-2xs text-gris-50">
                    {ACCIONES.find(([v]) => v === accion)?.[2]}. Se puede quitar cuando quieras y
                    vuelve a lo que dice su rol.
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <p className="text-2xs text-gris-50">
        Roles hoy: {[...new Set(equipo.flatMap((m) => m.roles))]
          .map((r) => NOMBRE_ROL.get(r) ?? r)
          .join(' · ') || 'ninguno'}
      </p>
    </div>
  )
}
