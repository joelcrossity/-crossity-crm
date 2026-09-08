import Link from 'next/link'
import Shell from '@/components/Shell'
import { NuevoCliente } from '@/components/Alta'
import { createClient } from '@/lib/supabase/server'

type Cuenta = {
  id: string
  codigo: string
  cuenta: string
  razones_sociales: number
  marcas: string | null
  en_vivo: number
  en_pipeline: number
  abonos: number
  bonificados: number
  proyectos_totales: number
}

export default async function Cuentas() {
  const supabase = await createClient()
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
  type Chip = { codigo: string; nombre: string; color: string }
  const porCuenta = new Map<string, Chip[]>()
  for (const x of (proyectos ?? []) as Record<string, unknown>[]) {
    const k = x.cliente_codigo as string
    const lista = porCuenta.get(k) ?? []
    lista.push({ codigo: x.codigo as string, nombre: x.nombre as string, color: x.color as string })
    porCuenta.set(k, lista)
  }
  const conVarias = cuentas.filter((c) => c.razones_sociales > 1)

  return (
    <Shell activo="/cuentas">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3 border-b border-linea pb-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-gris-50">
            Cuentas
          </span>
          <h1 className="text-3xl font-bold tracking-tight">{cuentas.length} clientes</h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-gris">
            La cuenta es la relación, no la razón social. Un cliente puede facturar por varias
            empresas y tener varias marcas: la economía cierra acá, no proyecto por proyecto.
            {conVarias.length > 0 && ` Hoy ${conVarias.length} factura por más de una.`}
          </p>
          <NuevoCliente />
        </header>

        <ul className="flex flex-col gap-2">
          {cuentas.map((c) => {
            const suyos = porCuenta.get(c.codigo) ?? []
            return (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-lg border border-linea bg-superficie p-3.5
                           transition-colors duration-150 hover:border-linea-fuerte"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                  <Link href={`/cuentas/${c.codigo}`} className="group min-w-0">
                    <span className="text-base font-bold tracking-tight text-tinta group-hover:text-azul-hondo">
                      {c.cuenta}
                    </span>
                    <span className="cifra block text-2xs text-gris-50">
                      {c.codigo}
                      {c.razones_sociales > 1 && ` · ${c.razones_sociales} razones sociales`}
                      {c.marcas && c.marcas !== c.cuenta && ` · ${c.marcas}`}
                    </span>
                  </Link>

                  <span className="cifra flex shrink-0 flex-wrap gap-x-4 text-2xs">
                    {c.en_vivo > 0 && <span className="font-bold text-verde">{c.en_vivo} en vivo</span>}
                    {c.en_pipeline > 0 && <span className="text-amarillo">{c.en_pipeline} en pipeline</span>}
                    {c.abonos > 0 && (
                      <span className="text-azul-hondo">
                        {c.abonos} abono{c.abonos > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-gris-50">{c.proyectos_totales} en total</span>
                  </span>
                </div>

                {suyos.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 border-t border-linea pt-2">
                    {suyos.map((x: Chip) => (
                      <li key={x.codigo}>
                        <Link
                          href={`/proyecto/${x.codigo}`}
                          className="flex items-center gap-1.5 rounded-md border border-linea px-2 py-1
                                     text-2xs text-gris transition-colors duration-150
                                     hover:border-azul hover:text-azul-hondo"
                        >
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${
                              x.color === 'verde' ? 'bg-verde' : 'bg-amarillo'
                            }`}
                            aria-hidden
                          />
                          {x.nombre}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </Shell>
  )
}
