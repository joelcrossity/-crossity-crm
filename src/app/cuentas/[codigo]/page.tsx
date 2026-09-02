import Link from 'next/link'
import { notFound } from 'next/navigation'
import Shell from '@/components/Shell'
import { Marco, Barras, Cifra } from '@/components/Grafico'
import { createClient } from '@/lib/supabase/server'
import { plata, fechaCorta, SUBESTADO } from '@/lib/estados'

const PUNTO: Record<string, string> = {
  verde: 'bg-verde',
  amarillo: 'bg-amarillo',
  gris: 'bg-gris-50',
  naranja: 'bg-naranja',
  rojo: 'bg-rojo',
}

const GRUPO: Record<string, string> = {
  verde: 'En vivo',
  amarillo: 'A seguir',
  gris: 'Standby',
  naranja: 'Terminados',
  rojo: 'Perdidos',
}

const ORDEN = ['verde', 'amarillo', 'gris', 'naranja', 'rojo']

export default async function Cuenta(props: PageProps<'/cuentas/[codigo]'>) {
  const { codigo } = await props.params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizaciones')
    .select('id, codigo, nombre_canonico, alias, unidad')
    .eq('codigo', codigo)
    .maybeSingle()

  if (!org) notFound()

  const [{ data: proyectos }, { data: razones }, { data: marcas }, { data: contactos }] =
    await Promise.all([
      supabase
        .from('proyectos')
        .select(
          'id, codigo, nombre, color, subestado, motivo_gris, tipo, monto_neto, moneda, monto_mensual, fecha_comprometida, condicion, etapa, personas!proyectos_responsable_id_fkey(nombre)'
        )
        .eq('organizacion_id', org.id)
        .order('color'),
      supabase
        .from('razones_sociales')
        .select('razon_social, cuit, es_principal')
        .eq('organizacion_id', org.id),
      supabase.from('marcas').select('nombre, es_principal').eq('organizacion_id', org.id),
      supabase.from('contactos').select('nombre, rol, email, telefono').eq('organizacion_id', org.id),
    ])

  type P = {
    id: string
    codigo: string
    nombre: string
    color: string
    subestado: string | null
    motivo_gris: string | null
    tipo: string
    monto_neto: number | null
    moneda: string
    monto_mensual: number | null
    fecha_comprometida: string | null
    condicion: string
    etapa: string | null
    personas: { nombre: string } | null
  }

  const ps = (proyectos ?? []) as unknown as P[]
  const vivos = ps.filter((p) => p.color === 'verde')
  const abonos = ps.filter((p) => p.tipo === 'mantenimiento' && p.color === 'verde')
  const bonificados = ps.filter((p) => p.condicion === 'bonificado')

  const facturable = ps
    .filter((p) => p.color !== 'rojo' && p.condicion !== 'bonificado')
    .reduce((s, p) => s + (p.moneda === 'ARS' ? (p.monto_neto ?? 0) : 0), 0)
  const regalado = bonificados.reduce((s, p) => s + (p.monto_neto ?? 0), 0)
  const mensual = abonos.reduce((s, p) => s + (p.monto_mensual ?? 0), 0)

  const porProyecto = ps
    .filter((p) => (p.monto_neto ?? 0) > 0 && p.moneda === 'ARS')
    .map((p) => ({ nombre: p.nombre, valor: p.monto_neto ?? 0 }))
    .sort((a, b) => b.valor - a.valor)

  return (
    <Shell activo="/cuentas">
      <header className="mb-7 flex flex-col gap-3 border-b border-linea pb-5">
        <span className="cifra text-2xs text-gris-50">{org.codigo}</span>
        <h1 className="text-2xl font-bold tracking-tight text-balance">{org.nombre_canonico}</h1>

        <div className="flex flex-wrap gap-x-8 gap-y-2">
          {(marcas?.length ?? 0) > 0 && (
            <Dato titulo="Marcas">
              {marcas!.map((m: { nombre: string }) => m.nombre).join(' · ')}
            </Dato>
          )}
          {(razones?.length ?? 0) > 0 && (
            <Dato titulo={`Razones sociales (${razones!.length})`}>
              {razones!
                .map((r: { razon_social: string; es_principal: boolean }) =>
                  r.es_principal ? `${r.razon_social} ★` : r.razon_social
                )
                .join(' · ')}
            </Dato>
          )}
          {(org.alias?.length ?? 0) > 0 && (
            <Dato titulo="También aparece como">{org.alias.join(' · ')}</Dato>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-9">
        <section className="grid gap-6 sm:grid-cols-4">
          <Cifra valor={String(ps.length)} titulo="proyectos" nota="en toda la relación" />
          <Cifra
            valor={String(vivos.length)}
            titulo="en vivo"
            nota="se está trabajando ahora"
            tono={vivos.length > 0 ? 'verde' : 'tinta'}
          />
          <Cifra
            valor={plata(facturable)}
            titulo="facturable"
            nota="sin contar lo perdido ni lo bonificado"
          />
          <Cifra
            valor={mensual > 0 ? plata(mensual) : '—'}
            titulo="por mes"
            nota={abonos.length > 0 ? `${abonos.length} abono${abonos.length > 1 ? 's' : ''} vigente${abonos.length > 1 ? 's' : ''}` : 'sin mantenimiento'}
            tono={mensual > 0 ? 'verde' : 'tinta'}
          />
        </section>

        {regalado > 0 && (
          <p className="rounded-lg border border-linea bg-panel px-3.5 py-2.5 text-sm text-gris">
            <span className="font-bold text-tinta">{plata(regalado)} bonificados</span> en{' '}
            {bonificados.length} {bonificados.length === 1 ? 'proyecto' : 'proyectos'}. Aislado es
            una pérdida; dentro de la cuenta es el costo de haber ganado el resto.
          </p>
        )}

        <section className="flex flex-col gap-6">
          {ORDEN.map((color) => {
            const delGrupo = ps.filter((p) => p.color === color)
            if (delGrupo.length === 0) return null

            return (
              <div key={color} className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2.5">
                  <span className={`size-2 shrink-0 rounded-full ${PUNTO[color]}`} aria-hidden />
                  <h2 className="text-md font-bold tracking-tight">{GRUPO[color]}</h2>
                  <span className="cifra text-2xs text-gris-50">{delGrupo.length}</span>
                </div>

                <ul className="divide-y divide-linea overflow-hidden rounded-lg border border-linea bg-superficie">
                  {delGrupo.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/proyecto/${p.codigo}`}
                        className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1
                                   px-3.5 py-2.5 transition-colors duration-150 hover:bg-panel"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-2">
                            <span className="text-base font-medium text-tinta">{p.nombre}</span>
                            {p.tipo === 'mantenimiento' && (
                              <span className="rounded px-1 py-px text-2xs text-azul-hondo ring-1 ring-azul/40">
                                abono
                              </span>
                            )}
                            {p.condicion === 'bonificado' && (
                              <span className="rounded px-1 py-px text-2xs text-amarillo ring-1 ring-amarillo/40">
                                bonificado
                              </span>
                            )}
                          </span>
                          <span className="cifra block text-2xs text-gris-50">
                            {p.codigo}
                            {p.personas?.nombre ? ` · ${p.personas.nombre}` : ''}
                            {p.etapa ? ` · ${p.etapa.replace(/_/g, ' ')}` : ''}
                            {SUBESTADO[p.subestado ?? p.motivo_gris ?? '']
                              ? ` · ${SUBESTADO[p.subestado ?? p.motivo_gris ?? '']}`
                              : ''}
                          </span>
                        </span>
                        <span className="cifra shrink-0 text-right text-sm">
                          <span className="block text-tinta">
                            {p.tipo === 'mantenimiento'
                              ? `${plata(p.monto_mensual, p.moneda)} /mes`
                              : plata(p.monto_neto, p.moneda)}
                          </span>
                          <span className="block text-2xs text-gris-50">
                            {fechaCorta(p.fecha_comprometida) ?? 'sin fecha'}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Marco
            titulo="Peso de cada proyecto"
            detalle="Monto en pesos, de mayor a menor"
            hayDatos={porProyecto.length > 0}
            vacio="Todavía no hay montos cargados en esta cuenta."
          >
            <Barras datos={porProyecto} serie={1} />
          </Marco>

          <Marco
            titulo="Contactos"
            detalle="Quién decide y quién paga del otro lado"
            hayDatos={(contactos?.length ?? 0) > 0}
            vacio="Todavía no hay contactos cargados."
          >
            <ul className="flex flex-col gap-2">
              {(contactos ?? []).map(
                (c: { nombre: string; rol: string | null; email: string | null }, i: number) => (
                  <li key={i} className="flex flex-col">
                    <span className="text-sm font-medium text-tinta">{c.nombre}</span>
                    <span className="text-2xs text-gris-50">
                      {[c.rol, c.email].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                )
              )}
            </ul>
          </Marco>
        </section>
      </div>
    </Shell>
  )
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-2xs font-medium uppercase tracking-wider text-gris-50">{titulo}</dt>
      <dd className="text-sm text-tinta">{children}</dd>
    </div>
  )
}
