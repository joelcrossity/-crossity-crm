import { notFound } from 'next/navigation'
import Shell from '@/components/Shell'
import { createClient } from '@/lib/supabase/server'
import { COLORES, SUBESTADO, plata, fechaCorta, type Color } from '@/lib/estados'

export default async function Proyecto(props: PageProps<'/proyecto/[codigo]'>) {
  const { codigo } = await props.params
  const supabase = await createClient()

  const { data: p } = await supabase
    .from('proyectos')
    .select(`
      id, codigo, nombre, descripcion, color, subestado, motivo_gris, motivo_rojo,
      tipo, etapa, prioridad, fecha_comprometida, fecha_inicio, monto_neto, moneda,
      condicion, motivo_condicion, es_producto_propio, esquema_cobro, requiere_anticipo,
      monto_mensual, vigencia_desde,
      organizaciones ( codigo, nombre_canonico ),
      personas!proyectos_responsable_id_fkey ( nombre )
    `)
    .eq('codigo', codigo)
    .maybeSingle()

  if (!p) notFound()

  const [{ data: hitos }, { data: equipo }, { data: linea }, { data: miParte }] = await Promise.all([
    supabase.from('hitos').select('*').eq('proyecto_id', p.id).order('orden'),
    supabase.from('asignaciones').select('rol, desde, hasta, personas(nombre)').eq('proyecto_id', p.id).is('hasta', null),
    supabase.from('actualizaciones').select('tipo, texto, ocurrido_at, personas(nombre)').eq('proyecto_id', p.id).order('ocurrido_at', { ascending: false }).limit(40),
    supabase.from('participaciones').select('concepto, porcentaje, apertura').eq('proyecto_id', p.id),
  ])

  const cliente = p.organizaciones as unknown as { codigo: string; nombre_canonico: string }
  const responsable = p.personas as unknown as { nombre: string } | null
  const c = COLORES[p.color as Color]
  const esAbono = p.tipo === 'mantenimiento'

  return (
    <Shell activo="/tablero">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-linea pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`size-2 rounded-full ${c.punto}`} aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-tinta-3">
              {p.codigo} · {cliente.nombre_canonico}
            </span>
            {esAbono && (
              <span className="rounded-full border border-violeta px-2 py-px font-mono text-[9px] uppercase tracking-wider text-violeta">
                mantenimiento
              </span>
            )}
            {p.condicion !== 'normal' && (
              <span className="rounded-full border border-amarillo px-2 py-px font-mono text-[9px] uppercase tracking-wider text-amarillo">
                {p.condicion}
              </span>
            )}
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-balance">{p.nombre}</h1>

          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <Dato titulo="Estado">
              {c.etiqueta}
              {(p.subestado || p.motivo_gris) && (
                <span className="text-tinta-2"> · {SUBESTADO[p.subestado ?? p.motivo_gris!]}</span>
              )}
            </Dato>
            <Dato titulo="Responsable">{responsable?.nombre ?? '—'}</Dato>
            <Dato titulo={esAbono ? 'Desde' : 'Entrega'}>
              {esAbono
                ? fechaCorta(p.vigencia_desde) ?? '—'
                : fechaCorta(p.fecha_comprometida) ?? <span className="text-rojo">sin fecha</span>}
            </Dato>
            <Dato titulo={esAbono ? 'Abono mensual' : 'Monto'}>
              {esAbono ? plata(p.monto_mensual, p.moneda) : plata(p.monto_neto, p.moneda)}
            </Dato>
          </dl>

          {p.motivo_condicion && (
            <p className="text-[13px] text-tinta-2">{p.motivo_condicion}</p>
          )}
        </header>

        {(miParte?.length ?? 0) > 0 && (
          <Bloque titulo="Tu participación">
            <ul className="flex flex-col gap-1.5">
              {miParte!.map((m: { concepto: string; porcentaje: number }, i: number) => (
                <li key={i} className="flex items-baseline gap-3 text-sm">
                  <span className="font-mono tabular-nums text-violeta">{m.porcentaje} %</span>
                  <span className="text-tinta-2">{m.concepto}</span>
                </li>
              ))}
            </ul>
          </Bloque>
        )}

        {(hitos?.length ?? 0) > 0 && (
          <Bloque titulo={esAbono ? 'Cuotas' : 'Entregas'}>
            <div className="overflow-x-auto rounded-lg border border-linea bg-white">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-linea">
                    {['', 'Entregable', 'Monto', 'Comprometida', 'Estado'].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-tinta-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hitos!.map((h: Record<string, string | number | boolean | null>) => (
                    <tr key={h.id as string} className="border-b border-linea last:border-0">
                      <td className="px-4 py-3 font-mono text-[11px] text-tinta-3">
                        {h.orden as number}{h.es_anticipo ? ' · anticipo' : ''}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium">{h.titulo as string}</span>
                        {h.entregable && (
                          <span className="block text-[12px] leading-snug text-tinta-3">
                            {h.entregable as string}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px] tabular-nums text-tinta-2">
                        {plata(h.monto_neto as number, h.moneda as string)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px] tabular-nums text-tinta-2">
                        {fechaCorta(h.fecha_comprometida as string) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[13px]">
                        {h.cobrado_at ? (
                          <span className="text-verde">cobrado</span>
                        ) : h.facturado_at ? (
                          <span className="text-amarillo">facturado</span>
                        ) : h.entregado_at ? (
                          <span className="text-tinta-2">entregado</span>
                        ) : (
                          <span className="text-tinta-3">pendiente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Bloque>
        )}

        {(equipo?.length ?? 0) > 0 && (
          <Bloque titulo="Equipo">
            <ul className="flex flex-wrap gap-x-8 gap-y-2">
              {equipo!.map((a: { rol: string; personas: unknown }, i: number) => (
                <li key={i} className="flex flex-col">
                  <span className="text-sm font-medium">
                    {(a.personas as { nombre: string }).nombre}
                  </span>
                  <span className="font-mono text-[11px] text-tinta-3">
                    {a.rol.replace(/_/g, ' ')}
                  </span>
                </li>
              ))}
            </ul>
          </Bloque>
        )}

        <Bloque titulo="Qué pasó">
          {(linea?.length ?? 0) === 0 ? (
            <p className="text-[13px] text-tinta-2">Todavía no hay novedades cargadas.</p>
          ) : (
            <ul className="flex flex-col">
              {linea!.map((a: { tipo: string; texto: string; ocurrido_at: string; personas: unknown }, i: number) => (
                <li key={i} className="flex gap-4 border-b border-linea py-3 last:border-0">
                  <span className="w-24 shrink-0 font-mono text-[11px] text-tinta-3">
                    {new Date(a.ocurrido_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm leading-snug">{a.texto}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-tinta-3">
                      {a.tipo}
                      {(a.personas as { nombre: string } | null)?.nombre &&
                        ` · ${(a.personas as { nombre: string }).nombre}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Bloque>
      </div>
    </Shell>
  )
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-tinta-3">{titulo}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold tracking-tight">{titulo}</h2>
      {children}
    </section>
  )
}
