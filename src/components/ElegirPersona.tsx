'use client'

import { useState, useTransition } from 'react'
import { altaRapidaPersona } from '@/app/acciones'

/* ------------------------------------------------------------------
   Elegir a alguien del equipo, o darlo de alta ahí mismo.

   El caso que resuelve es concreto: estás cargando un proyecto, llegás
   a "responsable" y la persona no está en la lista porque entró esta
   semana. Sin esto hay que abandonar el formulario, ir a Usuarios,
   darla de alta, volver y cargar todo de nuevo.

   El alta crea la ficha y nada más. El acceso al sistema se da después
   desde Usuarios y roles, que ya genera el enlace de invitación: dar de
   alta a alguien para asignarle trabajo y darle llaves son decisiones
   distintas, y la segunda no debería poder tomarse sin querer desde un
   modal al costado de otra cosa.
   ------------------------------------------------------------------ */

const ROLES: [string, string][] = [
  ['desarrollo', 'Desarrollo'],
  ['project_manager', 'Project manager'],
  ['administracion', 'Administración'],
  ['coordinacion', 'Coordinación'],
]

export default function ElegirPersona({
  personas,
  elegida,
  alElegir,
  etiqueta,
  vacio = 'sin asignar',
  puedeDarDeAlta = true,
}: {
  personas: { id: string; nombre: string }[]
  elegida: string
  alElegir: (id: string) => void
  etiqueta: string
  vacio?: string
  puedeDarDeAlta?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('desarrollo')

  function guardar() {
    setError(null)
    empezar(async () => {
      const r = await altaRapidaPersona(nombre, email, [rol])
      if (!r.ok) return setError(r.error)
      /* Queda elegida al instante. Dar de alta a alguien acá es siempre
         para asignárselo: hacerlo buscar de nuevo en la lista sería
         pedirle que confirme lo que acaba de decidir. */
      alElegir(r.id)
      setAbierto(false)
      setNombre('')
      setEmail('')
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-0.5">
        <span className="rotulo">{etiqueta}</span>
        <span className="flex items-center gap-1.5">
          <select
            value={elegida}
            onChange={(e) => alElegir(e.target.value)}
            className="campo w-full cursor-pointer"
          >
            <option value="">{vacio}</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          {puedeDarDeAlta && (
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              aria-label={`Sumar a alguien a ${etiqueta.toLowerCase()}`}
              title="Dar de alta a alguien sin salir de acá"
              className="grid size-8 shrink-0 place-items-center rounded-md border border-linea
                         text-base leading-none text-gris-50 transition-colors duration-150
                         hover:border-azul hover:text-azul-hondo"
            >
              +
            </button>
          )}
        </span>
      </label>

      {abierto && (
        <div className="surge flex flex-col gap-2 rounded-md border border-azul bg-azul-aire p-2.5">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="rotulo">Nombre</span>
              <input
                value={nombre}
                autoFocus
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ana Pérez"
                className="campo w-44"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="rotulo">Correo</span>
              <input
                value={email}
                type="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ana@crossity.ar"
                className="campo w-52"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="rotulo">Qué hace</span>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                className="campo w-40 cursor-pointer"
              >
                {ROLES.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={guardar}
              disabled={pendiente || !nombre.trim()}
              className="boton boton-principal"
            >
              {pendiente ? 'Guardando…' : 'Sumar y asignar'}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="boton boton-sutil">
              Cancelar
            </button>
          </div>

          {error && (
            <span role="alert" className="text-2xs text-rojo">
              {error}
            </span>
          )}

          <span className="text-2xs text-gris-50">
            Queda con su ficha y se le puede asignar trabajo y plata. El acceso al sistema se da
            aparte, desde Usuarios y roles.
          </span>
        </div>
      )}
    </div>
  )
}
