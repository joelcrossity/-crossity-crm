'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ------------------------------------------------------------------
   Poner o cambiar la propia contraseña.

   Acá había un error de bulto: el enlace de Supabase no trae la sesión
   hecha. Vuelve con un `code` en la URL que hay que canjear —o con un
   token que hay que verificar, según cómo esté armada la plantilla del
   correo— y esta pantalla no hacía ninguna de las dos cosas. Entonces
   no había sesión, el cambio fallaba, y el mensaje culpaba al enlace de
   estar vencido cuando el enlace estaba perfecto.

   La misma pantalla sirve para dos momentos distintos: entrar por
   primera vez y cambiar una contraseña que ya existe. A alguien que
   entra por primera vez decirle "cambiá tu contraseña" lo deja buscando
   cuál era la anterior.
   ------------------------------------------------------------------ */

type Estado = 'abriendo' | 'listo' | 'sin_sesion'

export default function Clave() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('abriendo')
  const [esAlta, setEsAlta] = useState(false)
  const [clave, setClave] = useState('')
  const [otraVez, setOtraVez] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  const [yendo, setYendo] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // El tipo viene en el fragmento o en la query según el flujo.
    const parametros = new URLSearchParams(
      window.location.hash.slice(1) + '&' + window.location.search.slice(1),
    )
    const tipo = parametros.get('type')
    const codigo = parametros.get('code')
    const token = parametros.get('token_hash')

    async function abrir() {
      if (tipo === 'invite' || tipo === 'signup') setEsAlta(true)

      if (codigo) {
        const { error } = await supabase.auth.exchangeCodeForSession(codigo)
        if (error) {
          setEstado('sin_sesion')
          return
        }
      } else if (token && tipo) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: tipo as 'invite' | 'recovery' | 'signup' | 'email',
        })
        if (error) {
          setEstado('sin_sesion')
          return
        }
      }

      // Con el enlace consumido, la URL se limpia: dejar el token a la
      // vista invita a copiarlo o a que quede en el historial.
      if (codigo || token) {
        window.history.replaceState({}, '', '/clave')
      }

      const { data } = await supabase.auth.getSession()
      setEstado(data.session ? 'listo' : 'sin_sesion')
    }

    void abrir()
  }, [])

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
    const { error } = await createClient().auth.updateUser({ password: clave })

    if (error) {
      setError(
        error.message.toLowerCase().includes('same')
          ? 'Es la misma que tenías.'
          : 'No se pudo guardar. Probá de nuevo.',
      )
      setYendo(false)
      return
    }

    setHecho(true)
    setYendo(false)
    setTimeout(() => {
      router.push('/hoy')
      router.refresh()
    }, 1400)
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
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
          {esAlta && estado === 'listo' && (
            <p className="text-sm text-gris">Es tu primera vez acá. Poné una contraseña y entrás.</p>
          )}
        </div>

        {estado === 'abriendo' && <p className="text-sm text-gris">Abriendo…</p>}

        {estado === 'sin_sesion' && (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg border border-amarillo bg-amarillo-aire px-3.5 py-3 text-sm text-tinta">
              Este enlace ya se usó o venció. Pedile uno nuevo a quien te lo mandó: duran un día.
            </p>
            <Link href="/login" className="boton boton-secundario w-fit">
              Ir a entrar
            </Link>
          </div>
        )}

        {estado === 'listo' && hecho && (
          <p className="rounded-lg border border-verde bg-verde-aire px-3.5 py-3 text-sm text-tinta">
            {esAlta ? 'Listo. Bienvenido, te llevo al sistema.' : 'Listo, quedó cambiada.'}
          </p>
        )}

        {estado === 'listo' && !hecho && (
          <form onSubmit={guardar} className="flex flex-col gap-6">
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
                  autoFocus
                  className="rounded-md border border-linea bg-superficie px-3 py-2 text-base
                             text-tinta transition-colors duration-150 hover:border-linea-fuerte
                             focus:border-azul"
                />
                <span className="text-2xs text-gris-50">Al menos ocho caracteres.</span>
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
          </form>
        )}
      </div>
    </main>
  )
}
