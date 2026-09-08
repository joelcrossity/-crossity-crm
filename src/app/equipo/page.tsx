import Shell, { Titulo } from '@/components/Shell'
import Permisos, { type Miembro, type Permiso } from '@/components/Permisos'
import Etapas, { type Etapa, type Estado } from '@/components/Etapas'
import { type Permiso as PermisoGeneral } from '@/components/Persona'
import Pestanas from '@/components/Pestanas'
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

  const [
    { data: equipo },
    { data: permisos },
    { data: proyectos },
    { data: etapas },
    { data: estados },
    { data: generales },
  ] = await Promise.all([
    supabase.from('v_equipo').select('*').order('activa', { ascending: false }).order('nombre'),
    supabase.from('permisos_proyecto').select('id, persona_id, proyecto_id, accion, motivo'),
    supabase
      .from('proyectos')
      .select('id, nombre, codigo')
      .in('color', ['verde', 'amarillo'])
      .order('nombre'),
    supabase.from('v_etapas').select('*'),
    supabase.from('estados_proyecto').select('*'),
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
            texto: 'Usuarios y roles',
            señal: sinCuenta,
            contenido: (
              <div className="flex flex-col gap-6">
                {sinCuenta > 0 && (
                  <p className="rounded-lg border border-linea bg-superficie px-3.5 py-2.5 text-sm text-gris">
                    Hay <span className="font-medium text-tinta">{sinCuenta}</span> sin cuenta en el
                    sistema. No es un problema: participar y cobrar no exige entrar. Las cuentas se
                    crean en Supabase con el mismo correo y se enlazan solas.
                  </p>
                )}

                <Permisos
                  equipo={gente}
                  permisos={(permisos ?? []) as Permiso[]}
                  generales={
                    (generales ?? []) as unknown as (PermisoGeneral & { persona_id: string })[]
                  }
                  proyectos={(proyectos ?? []) as { id: string; nombre: string; codigo: string }[]}
                  puedeConfigurar={puedeConfigurar}
                  esDireccion={esDireccion}
                />
              </div>
            ),
          },
          {
            clave: 'etapas',
            texto: 'Etapas y estados',
            contenido: (
              <Etapas
                etapas={(etapas ?? []) as Etapa[]}
                estados={(estados ?? []) as Estado[]}
                esDireccion={esDireccion}
              />
            ),
          },
        ]}
      />

    </Shell>
  )
}
