import Shell, { Titulo } from '@/components/Shell'
import Asistente from '@/components/Asistente'
import Charla from '@/components/Charla'
import { createClient } from '@/lib/supabase/server'
import { type Op as Tarjeta } from '@/components/Tablero'
import VistaPipeline from '@/components/VistaPipeline'
import { plata } from '@/lib/estados'

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
}

export default async function Pipeline() {
  const supabase = await createClient()
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
  const [{ data }, { data: recontactar }, { data: referidos }] = await Promise.all([
    supabase.from('v_pipeline').select('*'),
    supabase.from('v_para_recontactar').select('codigo, nombre, cliente, origen'),
    supabase.from('proyectos').select('id, personas!proyectos_referido_por_fkey(nombre)'),
  ])
  const ops = (data ?? []) as Op[]

  const total = ops.reduce((s, o) => s + (o.moneda === 'ARS' ? 0 : o.monto_neto ?? 0), 0)
  const enPesos = ops.reduce((s, o) => s + (o.moneda === 'ARS' ? o.monto_neto ?? 0 : 0), 0)

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
  }))

  const seguimientos: [string, string | null][] = ops.map((o) => [o.id, o.proximo_seguimiento])
  const vencidos = ops.filter((o) => o.seguimiento_vencido).length
  const sinAgendar = ops.filter((o) => o.sin_agendar).length

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
        {ops.length} oportunidades abiertas
      </Titulo>

      <div className="flex flex-col gap-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <Dato valor={plata(enPesos, 'ARS')} titulo="cotizado en pesos" />
          {total > 0 && <Dato valor={plata(total, 'USD')} titulo="cotizado en dólares" />}
          <Dato
            valor={String(vencidos)}
            titulo="con seguimiento vencido"
            tono={vencidos > 0 ? 'rojo' : 'verde'}
          />
        </section>

        <VistaPipeline
          ops={tarjetas}
          seguimientos={seguimientos}
          alta={
            <span className="flex flex-wrap items-start gap-2">
              <Charla clientes={clientes} />
              <Asistente clientes={clientes} personas={personas ?? []} arrancaComo="oportunidad" />
            </span>
          }
        />

        {(recontactar?.length ?? 0) > 0 && (
          <section className="flex flex-col gap-3 border-t border-linea pt-8">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold tracking-tight">Para recontactar</h2>
              <p className="max-w-[65ch] text-sm text-gris">
                No se perdieron: se apagaron sin que nadie decidiera nada.
              </p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {recontactar!.map((r: { codigo: string; nombre: string; cliente: string }) => (
                <li key={r.codigo} className="text-sm text-gris">
                  <span className="font-medium text-tinta">{r.nombre}</span>
                  <span className="cifra text-2xs text-gris-50"> · {r.cliente}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Shell>
  )
}

function Dato({
  valor,
  titulo,
  tono = 'tinta',
}: {
  valor: string
  titulo: string
  tono?: 'tinta' | 'rojo' | 'verde'
}) {
  const color = tono === 'rojo' ? 'text-rojo' : tono === 'verde' ? 'text-verde' : 'text-tinta'
  return (
    <div className="surge flex flex-col gap-0.5 rounded-lg border border-linea bg-superficie p-3.5">
      <span className={`cifra text-xl font-bold ${color}`}>{valor}</span>
      <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">{titulo}</span>
    </div>
  )
}
