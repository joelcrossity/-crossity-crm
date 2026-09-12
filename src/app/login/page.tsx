'use client'

import Image from 'next/image'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  /* Cuando un enlace de correo falla, Supabase manda de vuelta acá con
     el motivo en el fragmento de la URL. Sin esto la persona ve la
     pantalla de entrar como si nada y no entiende por qué su enlace no
     hizo nada: el error estaba escrito en la barra de direcciones, que
     es el último lugar donde alguien va a mirar.

     Se lee como una propiedad del entorno, no como un estado, para que
     el servidor y el cliente rindan lo mismo. */
  const falloElEnlace = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.hash.slice(1)).get('error_code'),
    () => null,
  )

  async function recuperar() {
    if (!email.trim()) {
      setError('Escribí tu correo y volvé a tocar acá.')
      return
    }
    setError(null)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/clave`,
    })
    /* Se contesta lo mismo exista o no la cuenta: decir "ese correo no
       está" le confirmaría a cualquiera quién tiene usuario. */
    setAviso('Si ese correo tiene cuenta, le va a llegar un enlace para cambiarla.')
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEntrando(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Ese usuario y contraseña no coinciden.')
      setEntrando(false)
      return
    }

    router.push('/tablero')
    router.refresh()
  }

  return (
    <main className="min-h-dvh grid place-items-center px-6">
      <form onSubmit={entrar} className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          {/* Acá el logo va con más aire: es la primera pantalla y no
              compite con nada. El manual pide zona de protección. */}
          <Image
            src="/marca/crossity.png"
            alt="Crossity"
            width={1060}
            height={300}
            priority
            className="h-9 w-auto self-start"
          />
          <h1 className="text-2xl font-bold tracking-tight text-tinta">Sistema operativo</h1>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gris">Correo</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="rounded-md border border-linea bg-superficie px-3 py-2 text-[15px]
                         outline-none focus-visible:ring-2 focus-visible:ring-azul-hondo"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gris">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="rounded-md border border-linea bg-superficie px-3 py-2 text-[15px]
                         outline-none focus-visible:ring-2 focus-visible:ring-azul-hondo"
            />
          </label>
        </div>

        {falloElEnlace && !error && (
          <p className="rounded-md border border-amarillo bg-amarillo-aire px-3 py-2 text-sm text-tinta">
            {falloElEnlace === 'otp_expired'
              ? 'Ese enlace ya venció o se usó una vez. Pedí uno nuevo: duran poco a propósito.'
              : 'Ese enlace no es válido. Pedí uno nuevo.'}
          </p>
        )}

        {aviso && (
          <p className="rounded-md border border-verde bg-verde-aire px-3 py-2 text-sm text-tinta">
            {aviso}
          </p>
        )}

        {error && (
          <p className="text-sm text-rojo" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={entrando}
          className="rounded-md bg-azul-hondo px-4 py-2.5 text-[15px] font-medium text-white
                     disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-azul-hondo
                     focus-visible:ring-offset-2"
        >
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
        <button
          type="button"
          onClick={recuperar}
          className="w-fit text-sm text-gris-50 transition-colors duration-150 hover:text-azul-hondo"
        >
          Me olvidé la contraseña
        </button>

      </form>
    </main>
  )
}
