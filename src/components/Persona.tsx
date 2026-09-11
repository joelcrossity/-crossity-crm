'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Invitar from '@/components/Invitar'
import {
  ajustarPermiso,
  cambiarRoles,
  guardarPersona,
  soltarPermiso,
} from '@/app/acciones'

/* ------------------------------------------------------------------
   Editar una persona y lo que puede hacer.

   Copiado del sistema de Stilo, incluida la parte que lo hace
   entendible: cada rol trae permisos por defecto y los switches los
   ajustan, con la palabra "ajustado" marcando quién quedó fuera de lo
   que su rol dice. Sin esa marca, con el tiempo nadie sabe por qué
   fulano ve algo y mengano no, y los permisos se vuelven un misterio
   que nadie se anima a tocar.
   ------------------------------------------------------------------ */

export type Permiso = {
  accion: string
  etiqueta: string
  ayuda: string
  grupo: string
  orden: number
  por_rol: boolean
  puede: boolean
  ajustado: boolean
}

const ROLES: [string, string][] = [
  ['direccion', 'Dirección'],
  ['coordinacion', 'Coordinación'],
  ['project_manager', 'Project manager'],
  ['vendedor', 'Vendedor'],
  ['administracion', 'Administración'],
  ['desarrollo', 'Desarrollo'],
]

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

const rotulo = 'text-2xs font-medium uppercase tracking-wider text-gris-50'

export default function Persona({
  id,
  nombre,
  email,
  telefono,
  activa,
  esExterna,
  tieneCuenta,
  roles,
  permisos,
  puedeEditar,
  esDireccion,
  alCerrar,
}: {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  activa: boolean
  esExterna: boolean
  tieneCuenta: boolean
  roles: string[]
  permisos: Permiso[]
  puedeEditar: boolean
  esDireccion: boolean
  alCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [n, setN] = useState(nombre)
  const [e, setE] = useState(email ?? '')
  const [t, setT] = useState(telefono ?? '')
  const [act, setAct] = useState(activa)
  const [ext, setExt] = useState(esExterna)

  const grupos = [...new Set(permisos.map((p) => p.grupo))]

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo guardar.')
      else router.refresh()
    })
  }

  function guardarDatos(cambios?: { activa?: boolean; externa?: boolean }) {
    correr(() =>
      guardarPersona(id, n, e, t, cambios?.activa ?? act, cambios?.externa ?? ext),
    )
  }

  return (
    <div className="surge flex flex-col gap-5 rounded-lg border border-azul bg-azul-aire p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-md font-bold tracking-tight text-tinta">Editar persona</h3>
        <button
          type="button"
          onClick={alCerrar}
          className="text-sm text-gris transition-colors duration-150 hover:text-tinta"
        >
          Cerrar
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Nombre</span>
          <input
            value={n}
            disabled={!puedeEditar || pendiente}
            onChange={(x) => setN(x.target.value)}
            onBlur={() => n !== nombre && guardarDatos()}
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Correo</span>
          <input
            value={e}
            type="email"
            disabled={!puedeEditar || pendiente}
            onChange={(x) => setE(x.target.value)}
            onBlur={() => e !== (email ?? '') && guardarDatos()}
            className={campo}
          />
          <span className="text-2xs text-gris-50">
            Con este correo se enlaza su cuenta cuando la creás en Supabase.
          </span>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Teléfono</span>
          <input
            value={t}
            disabled={!puedeEditar || pendiente}
            onChange={(x) => setT(x.target.value)}
            onBlur={() => t !== (telefono ?? '') && guardarDatos()}
            className={campo}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm text-gris">
          <input
            type="checkbox"
            checked={act}
            disabled={!puedeEditar || pendiente}
            onChange={(x) => {
              setAct(x.target.checked)
              guardarDatos({ activa: x.target.checked })
            }}
            className="size-3.5 accent-[var(--color-azul-hondo)]"
          />
          Activa (desmarcada deja de aparecer en las listas)
        </label>
        <label className="flex items-center gap-2 text-sm text-gris">
          <input
            type="checkbox"
            checked={ext}
            disabled={!puedeEditar || pendiente}
            onChange={(x) => {
              setExt(x.target.checked)
              guardarDatos({ externa: x.target.checked })
            }}
            className="size-3.5 accent-[var(--color-azul-hondo)]"
          />
          Externa (no es del equipo, pero participa y cobra)
        </label>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-azul pt-4">
        <span className={rotulo}>Acceso al sistema</span>
        <span className="text-2xs text-gris-50">
          {tieneCuenta
            ? 'Ya tiene cuenta y puede entrar.'
            : 'Todavía no puede entrar. El enlace la deja poner su propia contraseña.'}
        </span>
        {puedeEditar && (
          <span className="mt-1">
            <Invitar
              personaId={id}
              nombre={n}
              tieneCuenta={tieneCuenta}
              tieneCorreo={!!e.trim()}
            />
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-azul pt-4">
        <span className={rotulo}>Roles</span>
        <span className="text-2xs text-gris-50">
          Cada rol trae permisos por defecto. Al cambiarlos, los switches se recalculan.
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {ROLES.map(([valor, texto]) => {
            const puesto = roles.includes(valor)
            return (
              <button
                key={valor}
                type="button"
                disabled={!esDireccion || pendiente}
                aria-pressed={puesto}
                onClick={() =>
                  correr(() =>
                    cambiarRoles(id, puesto ? roles.filter((r) => r !== valor) : [...roles, valor]),
                  )
                }
                className={`rounded-full border px-2.5 py-1 text-2xs transition-colors duration-150
                            disabled:cursor-default disabled:opacity-70 ${
                              puesto
                                ? 'border-azul-hondo bg-azul-hondo font-medium text-white'
                                : 'border-linea bg-superficie text-gris-50 enabled:hover:border-azul'
                            }`}
              >
                {texto}
              </button>
            )
          })}
        </span>
      </div>

      <div className="flex flex-col gap-3 border-t border-azul pt-4">
        <span className="flex flex-col gap-0.5">
          <span className={rotulo}>Qué puede hacer</span>
          <span className="text-2xs text-gris-50">
            «Ajustado» quiere decir distinto de lo que dan sus roles. Tocá la palabra para volver a
            lo que el rol dice.
          </span>
        </span>

        <div className="grid gap-4 sm:grid-cols-2">
          {grupos.map((g) => (
            <div
              key={g}
              className="flex flex-col gap-2.5 rounded-lg border border-linea bg-superficie p-3"
            >
              <span className={rotulo}>{g}</span>
              {permisos
                .filter((p) => p.grupo === g)
                .sort((a, b) => a.orden - b.orden)
                .map((p) => (
                  <span key={p.accion} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium text-tinta">{p.etiqueta}</span>
                        {p.ajustado && (
                          <button
                            type="button"
                            disabled={!esDireccion || pendiente}
                            onClick={() => correr(() => soltarPermiso(id, p.accion))}
                            className="rounded-full bg-amarillo-aire px-1.5 py-px text-[10px]
                                       font-medium text-amarillo transition-opacity duration-150
                                       hover:opacity-70"
                            title={`Su rol ${p.por_rol ? 'sí' : 'no'} lo da. Tocá para volver a eso.`}
                          >
                            ajustado
                          </button>
                        )}
                      </span>
                      <span className="block text-2xs leading-snug text-gris-50">{p.ayuda}</span>
                    </span>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={p.puede}
                      aria-label={p.etiqueta}
                      disabled={!esDireccion || pendiente}
                      onClick={() => correr(() => ajustarPermiso(id, p.accion, !p.puede))}
                      className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors
                                  duration-200 disabled:opacity-40 ${
                                    p.puede ? 'bg-azul-hondo' : 'bg-linea-fuerte'
                                  }`}
                    >
                      <span
                        className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left]
                                    duration-200 ease-(--ease-salida) ${
                                      p.puede ? 'left-[1.125rem]' : 'left-0.5'
                                    }`}
                        aria-hidden
                      />
                    </button>
                  </span>
                ))}
            </div>
          ))}
        </div>

        <p className="text-2xs text-gris-50">
          Por más que se apague todo, cada uno sigue viendo su propia plata. Eso no es un permiso: es
          la regla maestra del sistema y no se apaga desde acá.
        </p>
      </div>
    </div>
  )
}
