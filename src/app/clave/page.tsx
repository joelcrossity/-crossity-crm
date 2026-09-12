'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Portada, { Campo, Nota } from '@/components/Portada'

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

    const acceso = parametros.get('access_token')
    const refresco = parametros.get('refresh_token')

    async function abrir() {
      if (tipo === 'invite' || tipo === 'signup') setEsAlta(true)

      /* Tres formas de llegar, y hay que aceptar las tres.

         La primera es la que me faltaba y la que se estaba usando: un
         enlace generado desde el servidor no arranca un intercambio en
         este navegador, así que Supabase devuelve el token hecho en el
         fragmento de la URL. No hay nada que canjear, hay que tomarlo.

         La segunda es el código, que sí requiere que el intercambio
         haya empezado acá —por ejemplo, pidiendo el enlace desde la
         pantalla de entrar—.

         La tercera es el token de un solo uso, según cómo esté armada
         la plantilla del correo. */
      if (acceso && refresco) {
        const { error } = await supabase.auth.setSession({
          access_token: acceso,
          refresh_token: refresco,
        })
        if (error) {
          setEstado('sin_sesion')
          return
        }
      } else if (codigo) {
        const { error } = await supabase.auth.exchangeCodeForSession(codigo)
        if (error) {
          // Puede fallar legítimamente si el enlace no nació acá; lo que
          // decide es si quedó sesión, no si este canje puntual anduvo.
          const { data } = await supabase.auth.getSession()
          if (!data.session) {
            setEstado('sin_sesion')
            return
          }
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
      if (codigo || token || acceso) {
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
    <Portada
      titulo={esAlta ? 'Elegí tu contraseña' : 'Cambiar la contraseña'}
      bajada={
        estado === 'listo' && esAlta
          ? 'Es tu primera vez acá. Poné una contraseña y entrás.'
          : undefined
      }
    >
      {estado === 'abriendo' && (
        <div className="flex items-center gap-2.5 py-4 text-sm text-gris-50">
          <span
            className="size-3.5 rounded-full border-2 border-linea border-t-azul-hondo"
            style={{ animation: 'girar 0.7s linear infinite' }}
            aria-hidden
          />
          Abriendo el enlace…
        </div>
      )}

      {estado === 'sin_sesion' && (
        <div className="flex flex-col gap-4">
          <Nota tono="aviso">
            Este enlace ya se usó o venció. Pedile uno nuevo a quien te lo mandó: duran un día.
          </Nota>
          <Link href="/login" className="boton boton-secundario w-full justify-center">
            Ir a entrar
          </Link>
        </div>
      )}

      {estado === 'listo' && hecho && (
        <Nota tono="bien">
          {esAlta ? 'Listo. Bienvenido, te llevo al sistema.' : 'Listo, quedó cambiada.'}
        </Nota>
      )}

      {estado === 'listo' && !hecho && (
        <form onSubmit={guardar} className="flex flex-col gap-5">
          <div className="flex flex-col gap-3.5">
            <Campo
              etiqueta={esAlta ? 'Tu contraseña' : 'La nueva'}
              ayuda="Al menos ocho caracteres."
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoComplete="new-password"
              required
              autoFocus
            />
            <Campo
              etiqueta="Otra vez, para estar seguros"
              type="password"
              value={otraVez}
              onChange={(e) => setOtraVez(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          {error && <Nota tono="mal">{error}</Nota>}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={yendo}
              className="boton boton-principal flex-1 justify-center"
            >
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
    </Portada>
  )
}
