import { createServerClient } from '@supabase/ssr'
import { configSupabase } from '@/lib/supabase/config'
import { NextResponse, type NextRequest } from 'next/server'

// En Next 16 middleware.ts pasó a llamarse proxy.ts y la función, proxy.
export async function proxy(request: NextRequest) {
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
