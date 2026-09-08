import Link from 'next/link'
import Shell from '@/components/Shell'
import Asistente from '@/components/Asistente'
import Charla from '@/components/Charla'
import { createClient } from '@/lib/supabase/server'
import { ETAPAS, plata } from '@/lib/estados'

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
  const [{ data }, { data: recontactar }] = await Promise.all([
    supabase.from('v_pipeline').select('*'),
    supabase.from('v_para_recontactar').select('codigo, nombre, cliente, origen'),
  ])
  const ops = (data ?? []) as Op[]

  const total = ops.reduce((s, o) => s + (o.moneda === 'ARS' ? 0 : o.monto_neto ?? 0), 0)
  const enPesos = ops.reduce((s, o) => s + (o.moneda === 'ARS' ? o.monto_neto ?? 0 : 0), 0)

  return (
    <Shell activo="/pipeline">
      <div className="flex flex-col gap-9">
        <header className="flex flex-col gap-4 border-b border-linea pb-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-gris-50">
            Pipeline
          </span>
          <h1 className="text-3xl font-bold tracking-tight">
            {ops.length} oportunidades abiertas
          </h1>
          <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[13px] text-gris">
            {enPesos > 0 && <span>{plata(enPesos, 'ARS')} cotizados</span>}
            {total > 0 && <span>{plata(total, 'USD')} cotizados</span>}
            <span className="text-gris-50">
              {ops.filter((o) => o.sin_agendar).length} sin seguimiento agendado
            </span>
          </div>
        </header>

        <div className="flex flex-wrap items-start gap-2">
          <Charla clientes={clientes} />
          <Asistente clientes={clientes} personas={personas ?? []} arrancaComo="oportunidad" />
        </div>

        <div className="flex flex-col gap-8">
          {ETAPAS.map((etapa) => {
            const deEtapa = ops.filter((o) => o.etapa === etapa.valor)
            if (deEtapa.length === 0) return null

            return (
              <section key={etapa.valor} className="flex flex-col gap-3">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-base font-bold tracking-tight">{etapa.etiqueta}</h2>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-gris-50">
                    {deEtapa.length}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {deEtapa.map((o) => (
                    <Link
                      key={o.id}
                      href={`/proyecto/${o.codigo}`}
                      className="flex flex-col gap-2.5 rounded-lg border border-linea bg-white p-4
                                 transition-colors hover:border-azul"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold leading-snug tracking-tight">
                          {o.nombre}
                        </span>
                        <span className="font-mono text-[11px] text-gris-50">{o.cliente}</span>
                      </div>

                      {o.monto_neto !== null ? (
                        <span className="font-mono text-sm tabular-nums">
                          {plata(o.monto_neto, o.moneda)}
                        </span>
                      ) : o.cotizado_sin_monto ? (
                        <span className="font-mono text-[11px] text-amarillo">cotizado sin monto</span>
                      ) : null}

                      {o.proxima_accion && (
                        <p className="text-[13px] leading-snug text-gris">{o.proxima_accion}</p>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {o.sin_agendar && <Chip tono="amarillo">sin agendar</Chip>}
                        {o.seguimiento_vencido && <Chip tono="rojo">seguimiento vencido</Chip>}
                        {o.negocia_sin_base && <Chip tono="amarillo">nurturing pendiente</Chip>}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {(recontactar?.length ?? 0) > 0 && (
          <section className="flex flex-col gap-3 border-t border-linea pt-8">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold tracking-tight">Para recontactar</h2>
              <p className="text-[13px] text-gris">
                No se perdieron: se apagaron sin que nadie decidiera nada.
              </p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {recontactar!.map((r: { codigo: string; nombre: string; cliente: string }) => (
                <li key={r.codigo} className="text-sm text-gris">
                  <span className="font-medium text-tinta">{r.nombre}</span>
                  <span className="font-mono text-[11px] text-gris-50"> · {r.cliente}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Shell>
  )
}

function Chip({ tono, children }: { tono: 'amarillo' | 'rojo'; children: React.ReactNode }) {
  const color = tono === 'rojo' ? 'border-rojo text-rojo' : 'border-amarillo text-amarillo'
  return (
    <span className={`rounded-full border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${color}`}>
      {children}
    </span>
  )
}
