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
  const { data } = await supabase.from('v_cuenta').select('*').order('cuenta')
  const cuentas = (data ?? []) as Cuenta[]
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

        <div className="overflow-x-auto rounded-lg border border-linea bg-white">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-linea">
                {['Cuenta', 'Marcas', 'En vivo', 'Pipeline', 'Abonos', 'Bonificados', 'Total'].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-gris-50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <tr key={c.id} className="border-b border-linea last:border-0 hover:bg-fondo">
                  <td className="px-4 py-3">
                    <Link href={`/cuentas/${c.codigo}`} className="block hover:text-azul-hondo">
                    <span className="text-sm font-bold tracking-tight">{c.cuenta}</span>
                    <span className="cifra block text-2xs text-gris-50">
                      {c.codigo}
                      {c.razones_sociales > 1 && ` · ${c.razones_sociales} razones sociales`}
                    </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gris">{c.marcas ?? '—'}</td>
                  <Num n={c.en_vivo} destacar />
                  <Num n={c.en_pipeline} />
                  <Num n={c.abonos} />
                  <Num n={c.bonificados} />
                  <Num n={c.proyectos_totales} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  )
}

function Num({ n, destacar }: { n: number; destacar?: boolean }) {
  return (
    <td className="px-4 py-3 font-mono text-[13px] tabular-nums">
      <span className={n === 0 ? 'text-gris-50' : destacar ? 'font-bold text-verde' : 'text-gris'}>
        {n}
      </span>
    </td>
  )
}
