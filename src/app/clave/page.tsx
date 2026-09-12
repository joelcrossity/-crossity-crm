'use client'

import { useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ------------------------------------------------------------------
   Poner o cambiar la propia contraseña.

   La misma pantalla sirve para dos momentos que se sienten distintos:
   entrar por primera vez y cambiar una que ya existe. Supabase los
   distingue en el enlace —invite contra recovery— y se nota en la URL,
   así que la pantalla lo lee y habla de lo que la persona está
   haciendo. A alguien que entra por primera vez decirle "cambiá tu
   contraseña" lo deja buscando cuál era la anterior.

   La escribe la persona en su navegador y viaja directo a Supabase: no
   pasa por el servidor de la aplicación ni queda en ningún registro
   nuestro. Por eso no hay —ni va a haber— una pantalla donde alguien
   le ponga la contraseña a otro: para eso está el correo de
   recuperación, que llega al dueño de la cuenta y a nadie más.
   ------------------------------------------------------------------ */

/* Supabase deja el tipo en el fragmento de la URL (o en la query,
   según el flujo). Se lee como lo que es —una propiedad del entorno—
   para que el servidor y el cliente rindan lo mismo. */
function tipoDeEnlace() {
  if (typeof window === 'undefined') return 'cambio'
  const texto = window.location.hash.slice(1) + '&' + window.location.search.slice(1)
  return new URLSearchParams(texto).get('type') === 'invite' ? 'alta' : 'cambio'
}

export default function Clave() {
  const router = useRouter()
  const tipo = useSyncExternalStore(
    () => () => {},
    tipoDeEnlace,
    () => 'cambio',
  )
  const esAlta = tipo === 'alta'
  const [clave, setClave] = useState('')
  const [otraVez, setOtraVez] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const [yendo, setYendo] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (clave.length < 8) {
      setError('Que tenga al menos ocho caracteres.')
      return
    }
    if (clave !== otraVez) {
      setError('Las dos no coinciden.')
      return
    }

    setYendo(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: clave })

    if (error) {
      setError(
        error.message.includes('same')
          ? 'Es la misma que tenías.'
          : error.message.includes('session') || error.message.includes('Auth')
            ? 'El enlace venció o ya se usó. Pedile uno nuevo a quien te lo mandó.'
            : 'No se pudo guardar. Probá de nuevo.',
      )
      setYendo(false)
      return
    }

    setListo(true)
    setYendo(false)
    setTimeout(() => router.push('/hoy'), 1600)
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <form onSubmit={guardar} className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Image
            src="/marca/crossity.png"
            alt="Crossity"
            width={1060}
            height={300}
            priority
            className="h-8 w-auto self-start"
          />
          <h1 className="text-2xl font-bold tracking-tight text-tinta">
            {esAlta ? 'Elegí tu contraseña' : 'Cambiar la contraseña'}
          </h1>
          {esAlta && (
            <p className="text-sm text-gris">
              Es tu primera vez acá. Poné una contraseña y entrás.
            </p>
          )}
        </div>

        {listo ? (
          <p className="rounded-lg border border-verde bg-verde-aire px-3.5 py-3 text-sm text-tinta">
            {esAlta ? 'Listo. Bienvenido, te llevo al sistema.' : 'Listo, quedó cambiada. Te llevo al inicio.'}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
                  {esAlta ? 'Tu contraseña' : 'La nueva'}
                </span>
                <input
                  type="password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="rounded-md border border-linea bg-superficie px-3 py-2 text-base
                             text-tinta transition-colors duration-150 hover:border-linea-fuerte
                             focus:border-azul"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
                  Otra vez, para estar seguros
                </span>
                <input
                  type="password"
                  value={otraVez}
                  onChange={(e) => setOtraVez(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="rounded-md border border-linea bg-superficie px-3 py-2 text-base
                             text-tinta transition-colors duration-150 hover:border-linea-fuerte
                             focus:border-azul"
                />
              </label>
            </div>

            {error && <p className="text-sm font-medium text-rojo">{error}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={yendo} className="boton boton-principal">
                {yendo ? 'Guardando…' : esAlta ? 'Entrar' : 'Cambiarla'}
              </button>
              {!esAlta && (
                <Link href="/hoy" className="boton boton-sutil">
                  Volver
                </Link>
              )}
            </div>
          </>
        )}
      </form>
    </main>
  )
}
