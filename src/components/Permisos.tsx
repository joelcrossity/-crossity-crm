'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { crearPersona, otorgarPermiso, quitarPermiso } from '@/app/acciones'
import Persona, { type Permiso as PermisoGeneral } from '@/components/Persona'

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
  telefono: string | null
  puede_entrar: boolean
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
  generales,
  proyectos,
  puedeConfigurar,
  esDireccion,
  yoSoy,
}: {
  equipo: Miembro[]
  permisos: Permiso[]
  generales: (PermisoGeneral & { persona_id: string })[]
  proyectos: { id: string; nombre: string; codigo: string }[]
  puedeConfigurar: boolean
  esDireccion: boolean
  yoSoy: string | null
}) {
  const [editando, setEditando] = useState<string | null>(null)
  const [alta, setAlta] = useState(false)
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-[70ch] text-sm text-gris">
          Cada rol trae permisos por defecto y los switches los ajustan por persona. Además se
          pueden dar permisos en un proyecto puntual, sin tocar lo general.
        </p>
        {puedeConfigurar && !alta && (
          <button
            type="button"
            onClick={() => setAlta(true)}
            className="shrink-0 rounded-md bg-azul-hondo px-3 py-1.5 text-sm font-medium text-white
                       transition-colors duration-150 hover:bg-azul"
          >
            Nueva persona
          </button>
        )}
      </div>

      {alta && (
        <form
          action={(fd) =>
            correr(() => crearPersona(fd), () => setAlta(false))
          }
          className="surge flex flex-wrap items-end gap-2 rounded-lg border border-azul bg-azul-aire p-3"
        >
          <input name="nombre" required placeholder="Nombre y apellido" className={`${campo} w-56`} autoFocus />
          <input name="email" type="email" placeholder="Correo" className={`${campo} w-56`} />
          <span className="flex flex-wrap items-center gap-1.5">
            {ROLES.map(([v, t]) => (
              <label key={v} className="flex items-center gap-1 text-2xs text-gris">
                <input name="roles" value={v} type="checkbox" className="size-3 accent-[var(--color-azul-hondo)]" />
                {t}
              </label>
            ))}
          </span>
          <button
            type="submit"
            disabled={pendiente}
            className="boton boton-principal"
          >
            Crear
          </button>
          <button
            type="button"
            onClick={() => setAlta(false)}
            className="boton boton-sutil"
          >
            Cancelar
          </button>
          <p className="w-full text-2xs text-gris-50">
            Crear la persona no crea su cuenta: eso se hace en Supabase con el mismo correo y se
            enlaza sola. Participar y cobrar no exige entrar al sistema.
          </p>
        </form>
      )}

      <p className="hidden max-w-[70ch] text-sm text-gris">
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
                    {m.tiene_cuenta
                      ? m.puede_entrar
                        ? ' · entra al sistema'
                        : ' · acceso apagado'
                      : ' · sin cuenta, igual cobra'}
                    {m.en_equipos > 0 && ` · en ${m.en_equipos} equipos`}
                  </span>
                </span>

                {puedeConfigurar && (
                  <span className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditando(editando === m.id ? null : m.id)}
                      className="boton boton-secundario boton-chico"
                    >
                      {editando === m.id ? 'Listo' : 'Editar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbierta(abierta === m.id ? null : m.id)}
                      className="boton boton-secundario boton-chico"
                    >
                      Permiso en un proyecto
                    </button>
                  </span>
                )}
              </div>

              {editando === m.id && (
                <Persona
                  id={m.id}
                  nombre={m.nombre}
                  email={m.email}
                  telefono={m.telefono}
                  activa={m.activa}
                  esExterna={m.es_externa}
                  tieneCuenta={m.tiene_cuenta}
                  puedeEntrar={m.puede_entrar}
                  roles={m.roles}
                  permisos={generales.filter((g) => g.persona_id === m.id)}
                  puedeEditar={puedeConfigurar}
                  esDireccion={esDireccion}
                  soyYo={m.id === yoSoy}
                  alCerrar={() => setEditando(null)}
                />
              )}

              {editando !== m.id && (
                <span className="flex flex-wrap items-center gap-1.5">
                  {m.roles.length === 0 ? (
                    <span className="text-2xs text-gris-50">sin rol</span>
                  ) : (
                    m.roles.map((r) => (
                      <span
                        key={r}
                        className="rounded-full border border-linea px-2 py-0.5 text-2xs text-gris"
                      >
                        {NOMBRE_ROL.get(r) ?? r}
                      </span>
                    ))
                  )}
                  <span className="cifra ml-1 text-2xs text-gris-50">
                    {generales.filter((g) => g.persona_id === m.id && g.puede).length} permisos
                  </span>
                  {generales.some((g) => g.persona_id === m.id && g.ajustado) && (
                    <span className="rounded-full bg-amarillo-aire px-1.5 py-px text-[10px] font-medium text-amarillo">
                      {generales.filter((g) => g.persona_id === m.id && g.ajustado).length} ajustado
                    </span>
                  )}
                </span>
              )}

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

              {abierta === m.id && (
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
                    className="boton boton-principal"
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
