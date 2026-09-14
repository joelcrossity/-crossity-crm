import { redirect } from 'next/navigation'
import { clienteAdmin } from '@/lib/supabase/admin'
import { sitio } from '@/lib/sitio'

/* ------------------------------------------------------------------
   Canjear un código de invitación.

   Acá es donde el token de Supabase recién nace. La persona abre un
   link corto, se le genera el enlace real y se la manda para allá. El
   token existe el tiempo de esa redirección y nunca queda escrito en un
   chat, en una copia de seguridad ni en el historial de nadie.

   La página no tiene sesión: quien llega todavía no es nadie en el
   sistema, y ése es el punto. Por eso valida contra la clave de
   servicio y con cuidado: código que no existe, vencido, ya usado o
   anulado dan todos el mismo mensaje, sin decir cuál de las cuatro
   cosas pasó. Distinguirlas le serviría a alguien probando códigos y
   no le sirve a quien tiene uno bueno.
   ------------------------------------------------------------------ */

export const dynamic = 'force-dynamic'

export default async function Entrar({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params

  let admin
  try {
    admin = clienteAdmin()
  } catch {
    return <Aviso titulo="El sistema no está configurado del todo" texto="Falta la clave de servicio. Avisale a quien te mandó el enlace." />
  }

  const { data: inv } = await admin
    .from('invitaciones')
    .select('codigo, email, vence_at, usada_at, anulada_at')
    .eq('codigo', codigo)
    .maybeSingle()

  const sirve =
    inv && !inv.usada_at && !inv.anulada_at && new Date(inv.vence_at as string) > new Date()

  if (!sirve) {
    return (
      <Aviso
        titulo="Este enlace ya no sirve"
        texto="Puede haberse usado, vencido o cancelado. Pedile uno nuevo a quien te lo mandó: se genera en el momento."
      />
    )
  }

  const { data: cuentas } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existe = cuentas?.users.find(
    (u) => u.email?.toLowerCase() === (inv.email as string).toLowerCase(),
  )

  const { data, error } = await admin.auth.admin.generateLink({
    type: existe ? 'recovery' : 'invite',
    email: inv.email as string,
    options: { redirectTo: `${sitio()}/clave` },
  })

  if (error || !data?.properties?.action_link) {
    return <Aviso titulo="No se pudo abrir tu acceso" texto="Probá de nuevo en un minuto, o pedile otro enlace a quien te invitó." />
  }

  /* Se marca usada antes de redirigir. Si alguien abre el mismo código
     dos veces, el segundo intento no sirve: es la diferencia entre un
     enlace que caduca y uno que queda vivo en un chat. */
  await admin.from('invitaciones').update({ usada_at: new Date().toISOString() }).eq('codigo', codigo)

  redirect(data.properties.action_link)
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-lienzo px-5">
      <div className="tarjeta flex max-w-md flex-col gap-2 p-6 text-center">
        <h1 className="text-base font-bold tracking-tight text-tinta">{titulo}</h1>
        <p className="text-sm text-gris">{texto}</p>
      </div>
    </main>
  )
}
