import Shell, { Titulo } from '@/components/Shell'
import FilaCarga, { type Proyecto } from '@/components/FilaCarga'
import { Marco, Barras } from '@/components/Grafico'
import { createClient } from '@/lib/supabase/server'
import { Cotizaciones, type Cotizacion } from '@/components/Plata'
import Pestanas from '@/components/Pestanas'
import Cashflow, { type Mes } from '@/components/Cashflow'
import Posiciones, { type Posicion } from '@/components/Posiciones'
import { Saldos, type Saldo } from '@/components/CuentaCorriente'
import {
  PorFacturar,
  FacturasARecibir,
  Recurrentes,
  type PorFacturar as Factura,
  type PorRecibir,
  type Recurrente,
  type CostoFijo,
} from '@/components/Financiero'

export default async function Admin(props: {
  searchParams: Promise<{ ver?: string }>
}) {
  const { ver } = await props.searchParams
  const soloIncompletos = ver !== 'todos'
  const supabase = await createClient()

  const [
    { data: proyectos },
    { data: personas },
    { data: hitos },
    { data: repartos },
    { data: monedas },
    { data: porFacturarFilas },
    { data: aRecibir },
    { data: cashflow },
    { data: posiciones },
    { data: saldos },
    { data: recurrentes },
    { data: costos },
  ] = await Promise.all([
      supabase
        .from('proyectos')
        .select(
          'id, codigo, nombre, color, monto_neto, moneda, fecha_comprometida, responsable_id, prioridad, organizaciones(nombre_canonico)'
        )
        .order('color')
        .order('prioridad', { nullsFirst: false }),
      supabase.from('personas').select('id, nombre').eq('activa', true).order('nombre'),
      supabase
        .from('hitos')
        .select('monto_neto, moneda, facturado_at, cobrado_at, proyectos(organizaciones(nombre_canonico))'),
      supabase.from('v_reparto_incompleto').select('codigo, nombre, cliente, suma_porcentajes'),
      supabase.from('v_cotizaciones').select('codigo, nombre, valor, fecha, dias_de_atraso'),
      supabase.from('v_por_facturar').select('*').order('dias_desde_la_entrega', { ascending: false }),
      supabase.from('v_facturas_a_recibir').select('*'),
      supabase.from('v_cashflow').select('*'),
      supabase.from('v_posicion_proyecto').select('*'),
      supabase.from('v_cuenta_corriente').select('*'),
      supabase.from('v_recurrente').select('*'),
      supabase.from('costos_fijos').select('id, concepto, proveedor, monto, moneda, cada, hasta').order('concepto'),
    ])

  const todos: Proyecto[] = (proyectos ?? []).map(
    (p: Record<string, unknown>): Proyecto => ({
      id: p.id as string,
      codigo: p.codigo as string,
      nombre: p.nombre as string,
      cliente: (p.organizaciones as { nombre_canonico: string })?.nombre_canonico ?? '—',
      color: p.color as string,
      monto_neto: p.monto_neto as number | null,
      moneda: p.moneda as string,
      fecha_comprometida: p.fecha_comprometida as string | null,
      responsable_id: p.responsable_id as string | null,
      prioridad: p.prioridad as number | null,
    })
  )

  const incompletos = todos.filter((p) => !p.monto_neto || !p.fecha_comprometida || !p.responsable_id)
  const filas = soloIncompletos ? incompletos : todos

  // Facturado sin cobrar, por cliente. La deuda que hay que ir a buscar.
  const deuda = new Map<string, number>()
  for (const h of (hitos ?? []) as Record<string, unknown>[]) {
    const monto = (h.monto_neto as number) ?? 0
    if (h.facturado_at && !h.cobrado_at) {
      const org = (h.proyectos as { organizaciones: { nombre_canonico: string } } | null)
        ?.organizaciones?.nombre_canonico
      if (org) deuda.set(org, (deuda.get(org) ?? 0) + monto)
    }
  }
  const porCobrar = [...deuda.entries()]
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor)

  return (
    <Shell activo="/admin">
      <Titulo
        seccion="Administración"
        bajada="Completar monto, fecha y responsable de corrido. Cada campo guarda al salir, no hay botón de guardar."
      >
        Carga y cobranza
      </Titulo>

      <Pestanas
        solapas={[
          {
            clave: 'facturar',
            texto: 'Por facturar',
            señal: (porFacturarFilas ?? []).length,
            contenido: (
              <div className="flex flex-col gap-9">
                <PorFacturar filas={(porFacturarFilas ?? []) as Factura[]} />
                <FacturasARecibir filas={(aRecibir ?? []) as PorRecibir[]} />
              </div>
            ),
          },
          {
            clave: 'cobranza',
            texto: 'Cobranza',
            contenido: <Saldos saldos={(saldos ?? []) as Saldo[]} />,
          },
          {
            clave: 'caja',
            texto: 'Caja',
            contenido: (
              <div className="flex flex-col gap-9">
                <Cashflow meses={(cashflow ?? []) as Mes[]} />
                <Recurrentes
                  recurrentes={(recurrentes ?? []) as Recurrente[]}
                  costos={(costos ?? []) as CostoFijo[]}
                />
              </div>
            ),
          },
          {
            clave: 'proyectos',
            texto: 'Posición',
            contenido: <Posiciones filas={(posiciones ?? []) as Posicion[]} />,
          },
          {
            clave: 'carga',
            texto: 'Carga',
            señal: incompletos.length,
            contenido: (
              <div className="flex flex-col gap-9">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-md font-bold tracking-tight">Carga rápida</h2>
              <p className="text-sm text-gris">
                {soloIncompletos
                  ? `${incompletos.length} proyectos a los que les falta algo.`
                  : `Los ${todos.length} proyectos.`}
              </p>
            </div>
            <a
              href={soloIncompletos ? '/admin?ver=todos' : '/admin'}
              className="rounded-md border border-linea px-2.5 py-1 text-sm text-gris
                         transition-colors duration-150 hover:border-linea-fuerte hover:text-tinta"
            >
              {soloIncompletos ? 'Ver todos' : 'Ver sólo incompletos'}
            </a>
          </div>

          {filas.length === 0 ? (
            <p className="rounded-lg border border-linea bg-superficie px-4 py-6 text-center text-sm text-gris">
              No falta nada. Los {todos.length} proyectos tienen monto, fecha y responsable.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-linea bg-superficie">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-linea bg-panel">
                    {['Proyecto', 'Monto', 'Entrega', 'Responsable', 'Prio', ''].map((h, i) => (
                      <th
                        key={i}
                        className="px-2 py-2 text-left text-2xs font-medium uppercase tracking-wider text-gris-50"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((p) => (
                    <FilaCarga key={p.id} p={p} personas={personas ?? []} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Marco
            titulo="Quién debe y cuánto"
            detalle="Facturado sin cobrar, por cliente"
            hayDatos={porCobrar.length > 0}
            vacio="No hay nada facturado sin cobrar. O todavía no se cargó ninguna factura."
          >
            <Barras datos={porCobrar} serie={4} />
          </Marco>

          <Marco
            titulo="Repartos sin cerrar"
            detalle="Proyectos donde las participaciones no suman 100 %"
            hayDatos={(repartos?.length ?? 0) > 0}
            vacio="Todos los repartos cierran en 100 %."
          >
            <Barras
              serie={3}
              sufijo="%"
              datos={(repartos ?? []).map(
                (r: { nombre: string; cliente: string; suma_porcentajes: number }) => ({
                  nombre: `${r.nombre} · ${r.cliente}`,
                  valor: Number(r.suma_porcentajes),
                })
              )}
            />
          </Marco>
        </section>
              </div>
            ),
          },
        ]}
      />

      <div className="mt-9 border-t border-linea pt-8">
        <Cotizaciones monedas={(monedas ?? []) as Cotizacion[]} />
      </div>
    </Shell>
  )
}
