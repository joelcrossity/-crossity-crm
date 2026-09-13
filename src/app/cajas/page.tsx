import Shell, { Titulo } from '@/components/Shell'
import SinAcceso from '@/components/SinAcceso'
import Cajas, { type Caja } from '@/components/Cajas'
import { createClient } from '@/lib/supabase/server'
import { puedeVer } from '@/lib/permisos'

export default async function PaginaCajas() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: ficha } = await supabase
    .from('usuarios').select('personas(roles)').eq('id', user?.id ?? '').maybeSingle()
  const misRoles = (ficha?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []

  if (!puedeVer('/cajas', misRoles))
    return (
      <Shell activo="/cajas">
        <SinAcceso que="Las cajas" />
      </Shell>
    )

  const { data } = await supabase.from('v_cajas').select('*').order('orden').order('nombre')
  const cajas = (data ?? []) as Caja[]

  /* Administrar es de dirección y administración, igual que la política
     de escritura de la tabla. Acá solo decide si se dibuja el botón: si
     alguien llega igual, la base lo frena. */
  const puedeAdministrar =
    misRoles.includes('direccion') || misRoles.includes('administracion')

  return (
    <Shell activo="/cajas">
      <Titulo
        seccion="Finanzas"
        bajada="Lo que hay en cada lado. El saldo se cuenta solo: es lo que había al empezar, más lo que entró, menos lo que salió."
      >
        {cajas.filter((c) => c.activa).length === 0
          ? 'Todavía no hay cajas'
          : `${cajas.filter((c) => c.activa).length} cajas`}
      </Titulo>

      <Cajas cajas={cajas} puedeAdministrar={puedeAdministrar} />
    </Shell>
  )
}
