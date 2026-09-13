import Shell, { Titulo } from '@/components/Shell'
import SinAcceso from '@/components/SinAcceso'
import { puedeVer } from '@/lib/permisos'
import Etapas, { type Etapa } from '@/components/Etapas'
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

  const [{ data: etapas }, { data: columnas }] = await Promise.all([
    supabase.from('v_etapas').select('*'),
    supabase.from('columnas_tablero').select('*').order('orden'),
  ])

  return (
    <Shell activo="/etapas">
      <Titulo
        seccion="Sistema"
        bajada="Las etapas por las que pasa una venta y las columnas del tablero de proyectos. Son las dos listas que el sistema efectivamente lee."
      >
        Etapas y estados
      </Titulo>

      <div className="flex flex-col gap-10">
        <Etapas
          etapas={(etapas ?? []) as Etapa[]}
          esDireccion={esDireccion}
        />

        <div className="border-t border-linea pt-8">
          <Columnas columnas={(columnas ?? []) as Columna[]} esDireccion={esDireccion} />
        </div>
      </div>
    </Shell>
  )
}
