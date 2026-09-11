import { createClient as crearCliente } from '@supabase/supabase-js'
import { configSupabase } from './config'

/* ------------------------------------------------------------------
   El cliente de administración.

   Usa la clave de servicio, que se saltea TODA la seguridad por filas.
   Por eso vive solo acá y solo lo tocan las acciones del servidor que
   verifican antes quién está pidiendo: si esta clave llegara al
   navegador, cualquiera podría leer y escribir todo.

   Sirve para una sola cosa que la clave pública no puede hacer: crear
   cuentas y generar enlaces de acceso. Nada más.
   ------------------------------------------------------------------ */

export function clienteAdmin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!clave) {
    throw new Error(
      'Falta la clave de servicio. Cargala como SUPABASE_SERVICE_ROLE_KEY ' +
        'en las variables de entorno de Vercel y en .env.local.',
    )
  }

  return crearCliente(configSupabase().url, clave, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
