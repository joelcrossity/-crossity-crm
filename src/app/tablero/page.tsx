import Shell from '@/components/Shell'
import { Grupo, type Fila } from '@/components/TablaProyectos'
import { createClient } from '@/lib/supabase/server'
import { type Color } from '@/lib/estados'
import Link from 'next/link'

const ORDEN: Color[] = ['verde', 'amarillo', 'gris', 'naranja', 'rojo']

export default async function Tablero() {
  const supabase = await createClient()

  const [{ data: proyectos }, { data: sinCobrar }, { data: repartos }] = await Promise.all([
    supabase.from('v_tablero').select('*').order('prioridad', { nullsFirst: false }).order('cliente'),
    supabase.from('v_trabajando_sin_cobrar').select('codigo').limit(20),
    supabase.from('v_reparto_incompleto').select('codigo').limit(20),
  ])

  const filas = (proyectos ?? []) as Fila[]
  const enVivo = filas.filter((f) => f.color === 'verde')
  const frenados = enVivo.filter((f) => f.dias_sin_novedades > 7)
  const sinFecha = enVivo.filter((f) => !f.fecha_comprometida)

  const avisos = [
    frenados.length > 0 && {
      texto: `${frenados.length} en vivo sin novedades hace más de una semana`,
      href: null,
    },
    sinFecha.length > 0 && {
      texto: `${sinFecha.length} en vivo sin fecha comprometida`,
      href: null,
    },
    (sinCobrar?.length ?? 0) > 0 && {
      texto: `${sinCobrar!.length} trabajando sin haber cobrado el anticipo`,
      href: null,
    },
    (repartos?.length ?? 0) > 0 && {
      texto: `${repartos!.length} con el reparto sin cerrar en 100 %`,
      href: null,
    },
  ].filter(Boolean) as { texto: string; href: string | null }[]

  return (
    <Shell activo="/tablero">
      <div className="flex flex-col gap-9">
        <header className="flex flex-col gap-4 border-b border-linea pb-6">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-tinta-3">
              Tablero
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">
              {enVivo.length} {enVivo.length === 1 ? 'proyecto' : 'proyectos'} en vivo
            </h1>
          </div>

          {avisos.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
              {avisos.map((a) => (
                <li key={a.texto} className="flex items-center gap-2 text-[13px] text-tinta-2">
                  <span className="size-1.5 rounded-full bg-amarillo" aria-hidden />
                  {a.texto}
                </li>
              ))}
            </ul>
          )}
        </header>

        {filas.length === 0 && (
          <p className="text-tinta-2">
            No hay proyectos que puedas ver todavía.{' '}
            <Link href="/pipeline" className="text-violeta underline">
              Mirá el pipeline
            </Link>
            .
          </p>
        )}

        {ORDEN.map((color) => (
          <Grupo key={color} color={color} filas={filas.filter((f) => f.color === color)} />
        ))}
      </div>
    </Shell>
  )
}
