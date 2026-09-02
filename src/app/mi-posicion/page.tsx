import Shell from '@/components/Shell'
import { createClient } from '@/lib/supabase/server'
import { plata } from '@/lib/estados'

type Pos = {
  moneda: string
  comprometido: number | null
  devengado: number | null
  a_liquidar: number | null
  liquidado: number | null
  proyectos: number
}

const ESTADOS = [
  { campo: 'comprometido', titulo: 'Comprometido', nota: 'hitos que todavía no se entregaron', tono: 'text-tinta-2' },
  { campo: 'devengado',    titulo: 'Devengado',    nota: 'entregado, esperando que pague el cliente', tono: 'text-amarillo' },
  { campo: 'a_liquidar',   titulo: 'A liquidar',   nota: 'disponible, entra en la próxima liquidación', tono: 'text-violeta' },
  { campo: 'liquidado',    titulo: 'Liquidado',    nota: 'ya cobrado', tono: 'text-verde' },
] as const

export default async function MiPosicion() {
  const supabase = await createClient()
  const { data } = await supabase.from('v_mi_posicion').select('*')
  const filas = (data ?? []) as Pos[]

  return (
    <Shell activo="/mi-posicion">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3 border-b border-linea pb-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-tinta-3">
            Mi posición
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Tu plata</h1>
        </header>

        {filas.length === 0 ? (
          <p className="text-tinta-2">Todavía no tenés participaciones cargadas.</p>
        ) : (
          filas.map((f) => (
            <section key={f.moneda} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-3">
                <h2 className="font-mono text-sm font-medium tracking-wider text-tinta-2">{f.moneda}</h2>
                <span className="font-mono text-[11px] uppercase tracking-wider text-tinta-3">
                  {f.proyectos} {f.proyectos === 1 ? 'proyecto' : 'proyectos'}
                </span>
              </div>

              <div className="grid gap-px overflow-hidden rounded-lg border border-linea bg-linea sm:grid-cols-2 lg:grid-cols-4">
                {ESTADOS.map((e) => (
                  <div key={e.campo} className="flex flex-col gap-1.5 bg-white p-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-tinta-3">
                      {e.titulo}
                    </span>
                    <span className={`font-mono text-lg tabular-nums ${e.tono}`}>
                      {plata(f[e.campo] ?? 0, f.moneda)}
                    </span>
                    <span className="text-[12px] leading-snug text-tinta-3">{e.nota}</span>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        <p className="max-w-2xl border-t border-linea pt-5 text-[13px] leading-relaxed text-tinta-2">
          Sólo ves lo tuyo. Cuánto detalle ves del lado del cliente depende de lo que se acordó
          para cada proyecto.
        </p>
      </div>
    </Shell>
  )
}
