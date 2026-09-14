import { createServerClient } from '@supabase/ssr'
import { configSupabase } from '@/lib/supabase/config'
import { NextResponse, type NextRequest } from 'next/server'

/* ------------------------------------------------------------------
   Una sola dirección para el sistema.

   La dirección larga de Vercel sigue funcionando y eso no es gratis:
   hay enlaces de acceso ya mandados que apuntan ahí, y cada persona que
   guarde el sistema en favoritos lo guarda con la dirección con la que
   entró. Con el tiempo la mitad del equipo entra por una y la otra
   mitad por otra, y basta que una se caiga o cambie para que nadie
   entienda qué pasó.

   Así que todo lo que llega por otra dirección se manda a la de verdad,
   conservando el camino: un enlace de invitación viejo termina en la
   misma invitación, con la dirección nueva.

   Las vistas previas quedan afuera. Cada despliegue de prueba tiene su
   propia dirección y mandarlas a producción haría imposible revisar
   nada antes de publicarlo.
   ------------------------------------------------------------------ */
function aDondeDeVerdad(request: NextRequest): URL | null {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return null

  const oficial = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL)?.replace(/\/+$/, '')
  if (!oficial) return null

  let host: string
  try {
    host = new URL(oficial).host
  } catch {
    return null
  }

  const vino = request.headers.get('host')
  if (!vino || vino === host) return null

  const destino = new URL(request.nextUrl.pathname + request.nextUrl.search, oficial)
  return destino
}

// En Next 16 middleware.ts pasó a llamarse proxy.ts y la función, proxy.
export async function proxy(request: NextRequest) {
  /* Antes que nada, y antes de mirar la sesión: la cookie de sesión
     pertenece a un dominio, así que seguir con la del dominio viejo
     para después redirigir sería trabajo tirado. */
  const oficial = aDondeDeVerdad(request)
  if (oficial) return NextResponse.redirect(oficial, 308)

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    configSupabase().url,
    configSupabase().key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  /* Las que se abren sin sesión, y las dos por la misma razón: quien
     llega ahí todavía no es nadie en el sistema.

     /clave recibe al que viene del correo de recuperación: el token
     viaja en el fragmento de la URL y lo procesa el navegador, así que
     cuando esto corre todavía no hay sesión.

     /entrar recibe al que abre un código de invitación. Mandarlo al
     login sería pedirle que entre con la contraseña que justamente
     viene a crear. */
  const abiertas = ['/login', '/clave']
  const abiertaPorPrefijo = pathname.startsWith('/entrar/')

  if (!user && !abiertas.includes(pathname) && !abiertaPorPrefijo) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/hoy'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
