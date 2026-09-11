'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ------------------------------------------------------------------
   Cambiar la propia contraseña.

   La escribe la persona en su navegador y viaja directo a Supabase: no
   pasa por el servidor de la aplicación ni queda en ningún registro
   nuestro. Por eso no hay —ni va a haber— una pantalla donde alguien
   le ponga la contraseña a otro: para eso está el correo de
   recuperación, que llega al dueño de la cuenta y a nadie más.
   ------------------------------------------------------------------ */

export default function Clave() {
  const router = useRouter()
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
          : 'No se pudo cambiar. Probá de nuevo.',
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
          <h1 className="text-2xl font-bold tracking-tight text-tinta">Cambiar la contraseña</h1>
          <p className="text-sm text-gris">
            La escribís vos y viaja directo a Supabase: no pasa por el sistema ni queda guardada en
            ningún lado nuestro.
          </p>
        </div>

        {listo ? (
          <p className="rounded-lg border border-verde bg-verde-aire px-3.5 py-3 text-sm text-tinta">
            Listo, quedó cambiada. Te llevo al inicio.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
                  La nueva
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
                {yendo ? 'Guardando…' : 'Cambiarla'}
              </button>
              <Link href="/hoy" className="boton boton-sutil">
                Volver
              </Link>
            </div>
          </>
        )}
      </form>
    </main>
  )
}
