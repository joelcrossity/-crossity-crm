import Shell, { Titulo } from '@/components/Shell'
import Etapas, { type Etapa, type Estado } from '@/components/Etapas'
import { createClient } from '@/lib/supabase/server'

export default async function Configuracion() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: cuenta } = await supabase
    .from('usuarios')
    .select('personas(roles)')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const roles = (cuenta?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []
  const esDireccion = roles.includes('direccion')

  const [{ data: etapas }, { data: estados }] = await Promise.all([
    supabase.from('v_etapas').select('*'),
    supabase.from('estados_proyecto').select('*'),
  ])

  return (
    <Shell activo="/etapas">
      <Titulo
        seccion="Sistema"
        bajada="Cómo vende la agencia y en qué estados vive un proyecto. Lo primero se ajusta con el tiempo; lo segundo casi nunca."
      >
        Etapas y estados
      </Titulo>

      <Etapas
        etapas={(etapas ?? []) as Etapa[]}
        estados={(estados ?? []) as Estado[]}
        esDireccion={esDireccion}
      />
    </Shell>
  )
}
