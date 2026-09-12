'use client'

import { useState, useTransition } from 'react'
import { invitarPersona } from '@/app/acciones'

/* ------------------------------------------------------------------
   El enlace para que alguien entre la primera vez.

   Es mejor que asignarle una contraseña, y no por purismo: una
   contraseña que vos elegís y le mandás pasa por tu pantalla, por el
   chat, y se queda ahí para siempre. Un enlace se usa una vez y se
   vence.

   Se muestra para copiar en vez de solo mandarlo por correo porque el
   correo se pierde: cae en spam, o la persona usa un mail que no mira.
   Copiarlo y pegarlo en el WhatsApp del equipo funciona siempre.
   ------------------------------------------------------------------ */

export default function Invitar({
  personaId,
  nombre,
  tieneCuenta,
  tieneCorreo,
}: {
  personaId: string
  nombre: string
  tieneCuenta: boolean
  tieneCorreo: boolean
}) {
  const [pendiente, empezar] = useTransition()
  const [enlace, setEnlace] = useState<string | null>(null)
  const [nueva, setNueva] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  function pedir() {
    setError(null)
    empezar(async () => {
      const r = await invitarPersona(personaId)
      if (r.ok) {
        setEnlace(r.enlace)
        setNueva(r.nueva)
      } else setError(r.error)
    })
  }

  async function copiar() {
    if (!enlace) return
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setError('No se pudo copiar solo. Seleccioná el texto y copialo a mano.')
    }
  }

  const paraWhatsapp = enlace
    ? `https://wa.me/?text=${encodeURIComponent(
        `Hola ${nombre.split(' ')[0]}, te dejo el acceso al sistema de Crossity. ` +
          `Entrá acá y poné tu contraseña: ${enlace}`,
      )}`
    : '#'

  if (!tieneCorreo)
    return (
      <span className="text-2xs text-amarillo">
        Sin correo cargado no se le puede dar acceso.
      </span>
    )

  return (
    <div className="flex flex-col gap-2">
      {!enlace ? (
        <button type="button" disabled={pendiente} onClick={pedir} className="boton boton-secundario boton-chico w-fit">
          {pendiente
            ? 'Generando…'
            : tieneCuenta
              ? 'Generar enlace para que la cambie'
              : 'Generar enlace de acceso'}
        </button>
      ) : (
        <div className="surge flex flex-col gap-2 rounded-lg border border-verde bg-verde-aire p-3">
          <span className="text-sm text-tinta">
            {nueva
              ? `Listo. Con este enlace ${nombre.split(' ')[0]} entra por primera vez y pone su contraseña.`
              : `Listo. Con este enlace ${nombre.split(' ')[0]} cambia su contraseña.`}
          </span>

          <input
            readOnly
            value={enlace}
            onFocus={(e) => e.currentTarget.select()}
            className="campo w-full text-2xs"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copiar} className="boton boton-principal boton-chico">
              {copiado ? 'Copiado' : 'Copiar el enlace'}
            </button>
            <a
              href={paraWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="boton boton-secundario boton-chico"
            >
              Mandarlo por WhatsApp
            </a>
            <button type="button" onClick={() => setEnlace(null)} className="boton boton-sutil boton-chico">
              Listo
            </button>
          </div>

          <p className="text-2xs text-gris">
            Sirve una sola vez y vence a las 24 horas. Si se pasa, generás otro.
          </p>
        </div>
      )}

      {error && <p className="text-2xs text-rojo">{error}</p>}
    </div>
  )
}
