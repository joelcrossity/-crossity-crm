import { notFound } from 'next/navigation'
import Shell from '@/components/Shell'
import Novedad from '@/components/Novedad'
import Estado from '@/components/Estado'
import { Fecha, Numero, Select, Casilla } from '@/components/Campo'
import { createClient } from '@/lib/supabase/server'
import { cambiarFecha, cambiarPrioridad, cambiarResponsable, marcarHito } from '@/app/acciones'
import { plata, fechaCorta } from '@/lib/estados'

const ETIQUETA_TIPO: Record<string, string> = {
  entrega: 'Entrega',
  comercial: 'Comercial',
  administrativo: 'Administrativo',
  decision: 'Decisión',
}

export default async function Proyecto(props: PageProps<'/proyecto/[codigo]'>) {
  const { codigo } = await props.params
  const supabase = await createClient()

  const { data: p } = await supabase
    .from('proyectos')
    .select(`
      id, codigo, nombre, color, subestado, motivo_gris, motivo_rojo, tipo, etapa,
      prioridad, fecha_comprometida, monto_neto, moneda, condicion, motivo_condicion,
      es_producto_propio, monto_mensual, vigencia_desde, responsable_id,
      organizaciones ( codigo, nombre_canonico )
    `)
    .eq('codigo', codigo)
    .maybeSingle()

  if (!p) notFound()

  const [{ data: hitos }, { data: equipo }, { data: linea }, { data: miParte }, { data: personas }] =
    await Promise.all([
      supabase.from('hitos').select('*').eq('proyecto_id', p.id).order('orden'),
      supabase
        .from('asignaciones')
        .select('rol, personas(nombre)')
        .eq('proyecto_id', p.id)
        .is('hasta', null),
      supabase
        .from('actualizaciones')
        .select('tipo, texto, ocurrido_at, personas(nombre)')
        .eq('proyecto_id', p.id)
        .order('ocurrido_at', { ascending: false })
        .limit(50),
      supabase.from('participaciones').select('concepto, porcentaje').eq('proyecto_id', p.id),
      supabase.from('personas').select('id, nombre').eq('activa', true).order('nombre'),
    ])

  const cliente = p.organizaciones as unknown as { codigo: string; nombre_canonico: string }
  const esAbono = p.tipo === 'mantenimiento'
  const detalle = p.subestado ?? p.motivo_gris ?? p.motivo_rojo

  return (
    <Shell activo="/tablero">
      <header className="mb-7 flex flex-col gap-2 border-b border-linea pb-5">
        <span className="cifra flex flex-wrap items-center gap-2 text-2xs text-tinta-3">
          <span>{p.codigo}</span>
          <span aria-hidden>·</span>
          <span>{cliente.nombre_canonico}</span>
          {esAbono && (
            <span className="rounded px-1.5 py-px text-violeta ring-1 ring-violeta/30">
              mantenimiento
            </span>
          )}
          {p.condicion !== 'normal' && (
            <span className="rounded px-1.5 py-px text-amarillo ring-1 ring-amarillo/40">
              {p.condicion}
            </span>
          )}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{p.nombre}</h1>
        {p.motivo_condicion && <p className="max-w-[65ch] text-sm text-tinta-2">{p.motivo_condicion}</p>}
      </header>

      <div className="flex flex-col gap-9">
        <section className="flex flex-col gap-5 rounded-lg border border-linea bg-superficie p-4">
          <Estado proyectoId={p.id} color={p.color} detalle={detalle} />

          <div className="grid gap-4 sm:grid-cols-3">
            <Fecha
              etiqueta={esAbono ? 'Vigente desde' : 'Entrega comprometida'}
              valor={esAbono ? p.vigencia_desde : p.fecha_comprometida}
              alCambiar={async (v) => {
                'use server'
                return cambiarFecha(p.id, v)
              }}
            />
            <Select
              etiqueta="Responsable"
              valor={p.responsable_id}
              vacio="sin asignar"
              opciones={(personas ?? []).map((x: { id: string; nombre: string }) => ({
                valor: x.id,
                texto: x.nombre,
              }))}
              alCambiar={async (v) => {
                'use server'
                return cambiarResponsable(p.id, v)
              }}
            />
            <Numero
              etiqueta="Prioridad"
              valor={p.prioridad}
              ayuda="1 es lo más importante"
              alCambiar={async (v) => {
                'use server'
                return cambiarPrioridad(p.id, v)
              }}
            />
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-linea pt-3.5">
            <Dato titulo={esAbono ? 'Abono mensual' : 'Monto del proyecto'}>
              {esAbono ? plata(p.monto_mensual, p.moneda) : plata(p.monto_neto, p.moneda)}
            </Dato>
            {(miParte?.length ?? 0) > 0 && (
              <Dato titulo="Tu participación">
                {miParte!
                  .map((m: { concepto: string; porcentaje: number }) => `${m.porcentaje} % ${m.concepto}`)
                  .join(' · ')}
              </Dato>
            )}
            {(equipo?.length ?? 0) > 0 && (
              <Dato titulo="Equipo">
                {equipo!
                  .map((a: { personas: unknown }) => (a.personas as { nombre: string }).nombre)
                  .join(' · ')}
              </Dato>
            )}
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-md font-semibold tracking-tight">Contar qué pasó</h2>
            <p className="text-sm text-tinta-2">
              Lo que escribas acá es lo que le evita a alguien tener que preguntarte.
            </p>
          </div>
          <Novedad proyectoId={p.id} />
        </section>

        {(hitos?.length ?? 0) > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-md font-semibold tracking-tight">
              {esAbono ? 'Cuotas' : 'Entregas'}
            </h2>
            <ul className="divide-y divide-linea overflow-hidden rounded-lg border border-linea bg-superficie">
              {hitos!.map((h: Record<string, string | number | boolean | null>) => (
                <li key={h.id as string} className="flex flex-wrap gap-x-6 gap-y-2 px-3.5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="cifra text-2xs text-tinta-3">{h.orden as number}</span>
                      <span className="text-base font-medium">{h.titulo as string}</span>
                      {h.es_anticipo ? (
                        <span className="rounded px-1 py-px text-2xs text-violeta ring-1 ring-violeta/30">
                          anticipo
                        </span>
                      ) : null}
                    </span>
                    {h.entregable ? (
                      <span className="mt-0.5 block text-sm leading-snug text-tinta-2">
                        {h.entregable as string}
                      </span>
                    ) : null}
                  </span>

                  <span className="cifra shrink-0 text-sm text-tinta-2">
                    {plata(h.monto_neto as number, h.moneda as string)}
                    {h.fecha_comprometida ? (
                      <span className="block text-2xs text-tinta-3">
                        {fechaCorta(h.fecha_comprometida as string)}
                      </span>
                    ) : null}
                  </span>

                  <span className="flex shrink-0 flex-col gap-1">
                    <Casilla
                      etiqueta="entregado"
                      marcado={!!h.entregado_at}
                      alCambiar={async (v) => {
                        'use server'
                        return marcarHito(h.id as string, 'entregado_at', v)
                      }}
                    />
                    <Casilla
                      etiqueta="facturado"
                      marcado={!!h.facturado_at}
                      alCambiar={async (v) => {
                        'use server'
                        return marcarHito(h.id as string, 'facturado_at', v)
                      }}
                    />
                    <Casilla
                      etiqueta="cobrado"
                      marcado={!!h.cobrado_at}
                      alCambiar={async (v) => {
                        'use server'
                        return marcarHito(h.id as string, 'cobrado_at', v)
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-2xs text-tinta-3">
              Cobrar el anticipo pasa el proyecto a en curso y le avisa al equipo.
            </p>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-md font-semibold tracking-tight">Qué viene pasando</h2>
          {(linea?.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-linea bg-superficie px-3.5 py-3 text-sm text-tinta-2">
              Todavía no hay novedades. La primera que cargues arranca la historia del proyecto.
            </p>
          ) : (
            <ol className="flex flex-col">
              {linea!.map(
                (
                  a: { tipo: string; texto: string; ocurrido_at: string; personas: unknown },
                  i: number
                ) => (
                  <li key={i} className="flex gap-4 border-b border-linea py-2.5 last:border-0">
                    <span className="cifra w-16 shrink-0 pt-0.5 text-2xs text-tinta-3">
                      {new Date(a.ocurrido_at).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base leading-snug">{a.texto}</span>
                      <span className="block text-2xs text-tinta-3">
                        {ETIQUETA_TIPO[a.tipo] ?? a.tipo}
                        {(a.personas as { nombre: string } | null)?.nombre &&
                          ` · ${(a.personas as { nombre: string }).nombre}`}
                      </span>
                    </span>
                  </li>
                )
              )}
            </ol>
          )}
        </section>
      </div>
    </Shell>
  )
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-2xs font-medium uppercase tracking-wider text-tinta-3">{titulo}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  )
}
