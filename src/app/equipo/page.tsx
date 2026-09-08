import Shell, { Titulo } from '@/components/Shell'
import Permisos, { type Miembro, type Permiso } from '@/components/Permisos'
import { createClient } from '@/lib/supabase/server'

export default async function Equipo() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: cuenta } = await supabase
    .from('usuarios')
    .select('personas(roles)')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const roles = (cuenta?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []
  const esDireccion = roles.includes('direccion')
  const puedeConfigurar =
    esDireccion || roles.includes('administracion') || roles.includes('coordinacion')

  const [{ data: equipo }, { data: permisos }, { data: proyectos }] = await Promise.all([
    supabase.from('v_equipo').select('*').eq('activa', true).order('nombre'),
    supabase.from('permisos_proyecto').select('id, persona_id, proyecto_id, accion, motivo'),
    supabase
      .from('proyectos')
      .select('id, nombre, codigo')
      .in('color', ['verde', 'amarillo'])
      .order('nombre'),
  ])

  const gente = (equipo ?? []) as Miembro[]
  const sinCuenta = gente.filter((m) => !m.tiene_cuenta).length

  return (
    <Shell activo="/equipo">
      <Titulo
        seccion="Equipo"
        bajada={
          puedeConfigurar
            ? 'Quién es quién y qué puede ver cada uno. Los permisos se dan por proyecto y por acción, no en bloque.'
            : 'Quién es quién. Los permisos los configura dirección, administración o coordinación.'
        }
      >
        {gente.length} personas
        {sinCuenta > 0 && `, ${sinCuenta} sin cuenta`}
      </Titulo>

      {sinCuenta > 0 && (
        <p className="surge mb-6 rounded-lg border border-linea bg-superficie px-3.5 py-2.5 text-sm text-gris">
          Hay <span className="font-medium text-tinta">{sinCuenta}</span> sin cuenta en el sistema.
          No es un problema: participar y cobrar no exige entrar. Las cuentas se crean en Supabase
          con el mismo correo y se enlazan solas.
        </p>
      )}

      <Permisos
        equipo={gente}
        permisos={(permisos ?? []) as Permiso[]}
        proyectos={(proyectos ?? []) as { id: string; nombre: string; codigo: string }[]}
        puedeConfigurar={puedeConfigurar}
        esDireccion={esDireccion}
      />
    </Shell>
  )
}
