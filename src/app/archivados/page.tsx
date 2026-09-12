import Shell, { Titulo } from '@/components/Shell'
import Historial, { type Archivado } from '@/components/Historial'
import { createClient } from '@/lib/supabase/server'

export default async function Archivados() {
  const supabase = await createClient()

  const { data: { user: quien } } = await supabase.auth.getUser()
  const { data: miFicha } = await supabase
    .from('usuarios')
    .select('personas(roles)')
    .eq('id', quien?.id ?? '')
    .maybeSingle()
  const misRoles = (miFicha?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []
  const puedeBarrer =
    misRoles.includes('direccion') ||
    misRoles.includes('administracion') ||
    misRoles.includes('coordinacion')

  const [{ data }, { data: candidatos }] = await Promise.all([
    supabase.from('v_archivados').select('*').order('archivado_at', { ascending: false }),
    supabase.from('v_para_archivar').select('id'),
  ])

  const filas = (data ?? []) as Archivado[]

  return (
    <Shell activo="/archivados">
      <Titulo
        seccion="Historial"
        bajada="Lo que salió del escritorio pero sigue entero: su plata, su historia y su reparto. Se puede traer de vuelta cuando haga falta."
      >
        {filas.length === 0 ? 'Nada archivado todavía' : `${filas.length} archivados`}
      </Titulo>

      <Historial
        filas={filas}
        candidatos={(candidatos ?? []).length}
        puedeBarrer={puedeBarrer}
      />
    </Shell>
  )
}
