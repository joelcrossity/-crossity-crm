import Shell, { Titulo } from '@/components/Shell'
import SinAcceso from '@/components/SinAcceso'
import { puedeVer } from '@/lib/permisos'
import { NuevoCliente } from '@/components/Alta'
import { createClient } from '@/lib/supabase/server'
import { type Cuenta, type Chip } from '@/components/GrillaClientes'
import VistaClientes from '@/components/VistaClientes'

export default async function Cuentas() {
  const supabase = await createClient()

  const { data: { user: quien } } = await supabase.auth.getUser()
  const { data: miFicha } = await supabase
    .from('usuarios')
    .select('personas(roles)')
    .eq('id', quien?.id ?? '')
    .maybeSingle()
  const misRoles = (miFicha?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []

  if (!puedeVer('/cuentas', misRoles))
    return (
      <Shell activo="/cuentas">
        <SinAcceso que="Clientes" />
      </Shell>
    )
  const [{ data }, { data: proyectos }] = await Promise.all([
    supabase.from('v_cuenta').select('*').order('cuenta'),
    supabase
      .from('v_tablero')
      .select('codigo, nombre, cliente_codigo, color')
      .in('color', ['verde', 'amarillo']),
  ])
  const cuentas = (data ?? []) as Cuenta[]

  /* Los proyectos vivos de cada cuenta, a la vista. Entrar y volver para
     saber en qué anda un cliente es lo que hace que no se mire nunca. */
  const porCuenta = new Map<string, Chip[]>()
  for (const x of (proyectos ?? []) as Record<string, unknown>[]) {
    const k = x.cliente_codigo as string
    const lista = porCuenta.get(k) ?? []
    lista.push({ codigo: x.codigo as string, nombre: x.nombre as string, color: x.color as string })
    porCuenta.set(k, lista)
  }
  const conVarias = cuentas.filter((c) => c.razones_sociales > 1)

  const activas = cuentas.filter((c) => c.en_vivo + c.abonos > 0).length
  const dormidas = cuentas.filter(
    (c) => c.en_vivo + c.abonos + c.en_pipeline === 0 && c.proyectos_totales > 0,
  ).length

  return (
    <Shell activo="/cuentas">
      <Titulo
        seccion="Clientes"
        bajada={
          <>
            La cuenta es la relación, no la razón social. Un cliente puede facturar por varias
            empresas y tener varias marcas: la economía cierra acá, no proyecto por proyecto.
            {conVarias.length > 0 && ` Hoy ${conVarias.length} factura por más de una.`}
          </>
        }
      >
        {activas} con trabajo abierto, {cuentas.length} en total
      </Titulo>

      <div className="flex flex-col gap-8">
        {dormidas > 0 && (
          <p className="surge rounded-lg border border-linea bg-superficie px-3.5 py-2.5 text-sm text-gris">
            <span className="font-medium text-tinta">{dormidas}</span> trabajaron con nosotros y hoy
            no tienen nada abierto ni en pipeline. Van al final de la grilla.
          </p>
        )}

        <VistaClientes
          cuentas={cuentas}
          proyectos={[...porCuenta.entries()]}
          alta={<NuevoCliente />}
        />
      </div>
    </Shell>
  )
}
