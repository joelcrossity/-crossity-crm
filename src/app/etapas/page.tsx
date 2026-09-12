import Shell, { Titulo } from '@/components/Shell'
import SinAcceso from '@/components/SinAcceso'
import { puedeVer } from '@/lib/permisos'
import Etapas, { type Etapa, type Estado } from '@/components/Etapas'
import Columnas from '@/components/Columnas'
import { type Columna } from '@/components/TableroEstados'
import { createClient } from '@/lib/supabase/server'

export default async function Configuracion() {
  const supabase = await createClient()

  const { data: { user: quien } } = await supabase.auth.getUser()
  const { data: miFicha } = await supabase
    .from('usuarios')
    .select('personas(roles)')
    .eq('id', quien?.id ?? '')
    .maybeSingle()
  const misRoles = (miFicha?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []

  if (!puedeVer('/etapas', misRoles))
    return (
      <Shell activo="/etapas">
        <SinAcceso que="Etapas y estados" />
      </Shell>
    )

  const { data: { user } } = await supabase.auth.getUser()
  const { data: cuenta } = await supabase
    .from('usuarios')
    .select('personas(roles)')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const roles = (cuenta?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []
  const esDireccion = roles.includes('direccion')

  const [{ data: etapas }, { data: estados }, { data: columnas }] = await Promise.all([
    supabase.from('v_etapas').select('*'),
    supabase.from('estados_proyecto').select('*'),
    supabase.from('columnas_tablero').select('*').order('orden'),
  ])

  return (
    <Shell activo="/etapas">
      <Titulo
        seccion="Sistema"
        bajada="Cómo vende la agencia y en qué estados vive un proyecto. Lo primero se ajusta con el tiempo; lo segundo casi nunca."
      >
        Etapas y estados
      </Titulo>

      <div className="flex flex-col gap-10">
        <Etapas
          etapas={(etapas ?? []) as Etapa[]}
          estados={(estados ?? []) as Estado[]}
          esDireccion={esDireccion}
        />

        <div className="border-t border-linea pt-8">
          <Columnas columnas={(columnas ?? []) as Columna[]} esDireccion={esDireccion} />
        </div>
      </div>
    </Shell>
  )
}
