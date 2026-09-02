// Si faltan las variables, conviene decirlo claro y no reventar con un
// error de librería tres capas más abajo.
export function configSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'En Vercel se cargan en Settings → Environment Variables; en local, en .env.local.'
    )
  }

  return { url, key }
}
