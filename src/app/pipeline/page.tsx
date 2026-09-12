import Shell, { Titulo } from '@/components/Shell'
import { Cifra } from '@/components/Grafico'
import SinAcceso from '@/components/SinAcceso'
import { puedeVer } from '@/lib/permisos'
import Asistente from '@/components/Asistente'
import Charla from '@/components/Charla'
import { createClient } from '@/lib/supabase/server'
import { type Op as Tarjeta } from '@/components/Tablero'
import VistaPipeline from '@/components/VistaPipeline'
import { ETAPAS, plata, type EtapaViva } from '@/lib/estados'

type Op = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  etapa: string
  nurturing: string
  origen: string | null
  monto_neto: number | null
  moneda: string
  proxima_accion: string | null
  proximo_seguimiento: string | null
  vendedor: string | null
  sin_agendar: boolean
  seguimiento_vencido: boolean
  negocia_sin_base: boolean
  cotizado_sin_monto: boolean
  enfriada: boolean
}

export default async function Pipeline() {
  const supabase = await createClient()

  const { data: { user: quien } } = await supabase.auth.getUser()
  const { data: miFicha } = await supabase
    .from('usuarios')
    .select('personas(roles)')
    .eq('id', quien?.id ?? '')
    .maybeSingle()
  const misRoles = (miFicha?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []

  if (!puedeVer('/pipeline', misRoles))
    return (
      <Shell activo="/pipeline">
        <SinAcceso que="El pipeline" />
      </Shell>
    )
  const { data: cuentas } = await supabase
    .from('v_cuenta')
    .select('id, cuenta, proyectos_totales, en_vivo')
    .order('cuenta')
  const { data: personas } = await supabase
    .from('personas').select('id, nombre').eq('activa', true).order('nombre')
  const clientes = ((cuentas ?? []) as Record<string, unknown>[]).map((c) => ({
    id: c.id as string,
    nombre: c.cuenta as string,
    proyectos: (c.proyectos_totales as number) ?? 0,
    enVivo: (c.en_vivo as number) ?? 0,
  }))
  const [{ data }, { data: referidos }, { data: filas }] = await Promise.all([
    supabase.from('v_pipeline').select('*'),
    supabase.from('proyectos').select('id, personas!proyectos_referido_por_fkey(nombre)'),
    supabase.from('etapas').select('clave, etiqueta').eq('activa', true).eq('es_final', false).order('orden'),
  ])
  const ops = (data ?? []) as Op[]

  /* Las enfriadas siguen en el tablero pero no suman al pipeline: contar
     como cotizado algo que nadie contesta hace parecer que hay más de lo
     que hay. */
  const vivas = ops.filter((o) => !o.enfriada)
  const frias = ops.length - vivas.length
  const total = vivas.reduce((s, o) => s + (o.moneda === 'ARS' ? 0 : o.monto_neto ?? 0), 0)
  const enPesos = vivas.reduce((s, o) => s + (o.moneda === 'ARS' ? o.monto_neto ?? 0 : 0), 0)

  const porReferente = new Map(
    ((referidos ?? []) as Record<string, unknown>[]).map((r) => [
      r.id as string,
      ((r.personas as { nombre: string } | null)?.nombre ?? null) as string | null,
    ]),
  )
  const tarjetas: Tarjeta[] = ops.map((o) => ({
    id: o.id,
    codigo: o.codigo,
    nombre: o.nombre,
    cliente: o.cliente,
    etapa: o.etapa,
    monto_neto: o.monto_neto,
    moneda: o.moneda,
    proxima_accion: o.proxima_accion,
    sin_agendar: o.sin_agendar,
    seguimiento_vencido: o.seguimiento_vencido,
    negocia_sin_base: o.negocia_sin_base,
    cotizado_sin_monto: o.cotizado_sin_monto,
    referente: porReferente.get(o.id) ?? null,
    enfriada: !!o.enfriada,
  }))

  const seguimientos: [string, string | null][] = ops.map((o) => [o.id, o.proximo_seguimiento])
  /* Si la consulta falla, se dibuja con la lista de respaldo en vez de
     mostrar un pipeline vacío, que parecería que no hay nada. */
  const etapas: EtapaViva[] =
    (filas ?? []).length > 0
      ? (filas as { clave: string; etiqueta: string }[]).map((e) => ({
          valor: e.clave,
          etiqueta: e.etiqueta,
        }))
      : ETAPAS.map((e) => ({ valor: e.valor, etiqueta: e.etiqueta }))

  const vencidos = vivas.filter((o) => o.seguimiento_vencido).length
  const sinAgendar = vivas.filter((o) => o.sin_agendar).length

  return (
    <Shell activo="/pipeline">
      <Titulo
        seccion="Pipeline"
        bajada={
          vencidos > 0
            ? `${vencidos} con el seguimiento vencido. Ésas se caen solas si nadie las toca.`
            : sinAgendar > 0
              ? `${sinAgendar} sin próximo seguimiento agendado: figuran activas pero nadie las está siguiendo.`
              : 'Todas con su próximo paso agendado.'
        }
      >
        {vivas.length} oportunidades abiertas
      </Titulo>

      <div className="flex flex-col gap-8">
        <section className="escalona grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra valor={plata(enPesos, 'ARS')} titulo="cotizado en pesos" nota="lo abierto, sin las enfriadas" />
          {total > 0 && <Cifra valor={plata(total, 'USD')} titulo="cotizado en dólares" />}
          <Cifra
            valor={String(vencidos)}
            titulo="con seguimiento vencido"
            nota="se caen solas si nadie las toca"
            tono={vencidos > 0 ? 'rojo' : 'verde'}
          />
          {frias > 0 && (
            <Cifra valor={String(frias)} titulo="enfriadas" nota="siguen ahí, para reflotar" />
          )}
        </section>

        <VistaPipeline
          ops={tarjetas}
          seguimientos={seguimientos}
          etapas={etapas}
          alta={
            <span className="flex flex-wrap items-start gap-2">
              <Charla clientes={clientes} />
              <Asistente clientes={clientes} personas={personas ?? []} arrancaComo="oportunidad" />
            </span>
          }
        />

      </div>
    </Shell>
  )
}
