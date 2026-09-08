'use client'

import Image from 'next/image'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

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
            width={900}
            height={276}
            priority
            className="h-9 w-auto"
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
      </form>
    </main>
  )
}
