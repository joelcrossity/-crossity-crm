import Shell, { Titulo } from '@/components/Shell'
import SinAcceso from '@/components/SinAcceso'
import { puedeVer } from '@/lib/permisos'
import Permisos, { type Miembro, type Permiso } from '@/components/Permisos'
import { type Permiso as PermisoGeneral } from '@/components/Persona'
import Accesos from '@/components/Accesos'
import Pestanas from '@/components/Pestanas'
import { createClient } from '@/lib/supabase/server'

export default async function Equipo() {
  const supabase = await createClient()

  const { data: { user: quien } } = await supabase.auth.getUser()
  const { data: miFicha } = await supabase
    .from('usuarios')
    .select('personas(roles)')
    .eq('id', quien?.id ?? '')
    .maybeSingle()
  const misRoles = (miFicha?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []

  if (!puedeVer('/equipo', misRoles))
    return (
      <Shell activo="/equipo">
        <SinAcceso que="Usuarios y roles" />
      </Shell>
    )

  const { data: { user } } = await supabase.auth.getUser()
  const { data: cuenta } = await supabase
    .from('usuarios')
    .select('persona_id, personas(roles)')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const roles = (cuenta?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []
  const esDireccion = roles.includes('direccion')
  const puedeConfigurar =
    esDireccion || roles.includes('administracion') || roles.includes('coordinacion')

  const [
    { data: equipo },
    { data: permisos },
    { data: proyectos },
    { data: generales },
  ] = await Promise.all([
    supabase.from('v_equipo').select('*').order('activa', { ascending: false }).order('nombre'),
    supabase.from('permisos_proyecto').select('id, persona_id, proyecto_id, accion, motivo'),
    supabase
      .from('proyectos')
      .select('id, nombre, codigo')
      .in('color', ['verde', 'amarillo'])
      .order('nombre'),
    supabase.from('v_permisos').select('*').order('orden'),
  ])

  const gente = (equipo ?? []) as Miembro[]
  const sinCuenta = gente.filter((m) => !m.tiene_cuenta).length

  return (
    <Shell activo="/equipo">
      <Titulo
        seccion="Sistema"
        bajada={
          puedeConfigurar
            ? 'Quién es quién y qué puede ver cada uno. Los permisos se dan por proyecto y por acción, no en bloque.'
            : 'Quién es quién. Los permisos los configura dirección, administración o coordinación.'
        }
      >
        {gente.length} personas
        {sinCuenta > 0 && `, ${sinCuenta} sin cuenta`}
      </Titulo>

      <Pestanas
        solapas={[
          {
            clave: 'gente',
            texto: 'Personas y permisos',
            contenido: (
              <div className="flex flex-col gap-6">
                {sinCuenta > 0 && (
                  <p className="rounded-lg border border-linea bg-superficie px-3.5 py-2.5 text-sm text-gris">
                    Hay <span className="font-medium text-tinta">{sinCuenta}</span> sin cuenta. No
                    siempre es un problema: participar y cobrar no exige entrar. Para las que sí
                    tienen que entrar, el enlace se genera en su ficha.
                  </p>
                )}

                <Permisos
                  equipo={gente}
                  permisos={(permisos ?? []) as Permiso[]}
                  generales={(generales ?? []) as unknown as (PermisoGeneral & { persona_id: string })[]}
                  proyectos={(proyectos ?? []) as { id: string; nombre: string; codigo: string }[]}
                  puedeConfigurar={puedeConfigurar}
                  esDireccion={esDireccion}
                  yoSoy={(cuenta?.persona_id as string) ?? null}
                />
              </div>
            ),
          },
          {
            clave: 'accesos',
            texto: 'Accesos',
            señal: sinCuenta,
            contenido: (
              <Accesos
                personas={gente.map((g) => ({ id: g.id, nombre: g.nombre }))}
                yoSoy={user?.id ?? null}
              />
            ),
          },
        ]}
      />

    </Shell>
  )
}
