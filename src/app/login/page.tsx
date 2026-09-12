'use client'


import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Portada, { Campo, Nota } from '@/components/Portada'

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
    <Portada
      titulo="Sistema operativo"
      bajada="Clientes, proyectos y liquidaciones de Crossity."
      pie={
        <button
          type="button"
          onClick={recuperar}
          className="text-2xs text-gris-50 transition-colors duration-150 hover:text-azul-hondo"
        >
          Me olvidé la contraseña
        </button>
      }
    >
      <form onSubmit={entrar} className="flex flex-col gap-5">
        <div className="flex flex-col gap-3.5">
          <Campo
            etiqueta="Correo"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
          <Campo
            etiqueta="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {falloElEnlace && !error && (
          <Nota tono="aviso">
            {falloElEnlace === 'otp_expired'
              ? 'Ese enlace ya venció o se usó una vez. Pedí uno nuevo: duran poco a propósito.'
              : 'Ese enlace no es válido. Pedí uno nuevo.'}
          </Nota>
        )}

        {aviso && <Nota tono="bien">{aviso}</Nota>}
        {error && <Nota tono="mal">{error}</Nota>}

        <button type="submit" disabled={entrando} className="boton boton-principal w-full justify-center">
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </Portada>
  )
}
