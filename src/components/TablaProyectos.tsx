import Link from 'next/link'
import { COLORES, SUBESTADO, fechaCorta, type Color } from '@/lib/estados'

export type Fila = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  color: Color
  subestado: string | null
  motivo_gris: string | null
  prioridad: number | null
  fecha_comprometida: string | null
  es_producto_propio: boolean
  responsable: string | null
  dias_sin_novedades: number
}

export default function TablaProyectos({ filas }: { filas: Fila[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-linea bg-white">
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="border-b border-linea">
            {['Proyecto', 'Estado', 'Responsable', 'Entrega', 'Sin novedades'].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-tinta-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-b border-linea last:border-0 hover:bg-fondo">
              <td className="px-4 py-3">
                <Link href={`/proyecto/${f.codigo}`} className="group flex flex-col gap-0.5">
                  <span className="text-sm font-semibold tracking-tight group-hover:text-violeta">
                    {f.nombre}
                    {f.es_producto_propio && (
                      <span className="ml-2 rounded-full border border-violeta px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-violeta">
                        producto propio
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-tinta-3">
                    {f.codigo} · {f.cliente}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-tinta-2">
                {SUBESTADO[f.subestado ?? f.motivo_gris ?? ''] ?? '—'}
              </td>
              <td className="px-4 py-3 text-sm text-tinta-2">
                {f.responsable ?? <span className="text-tinta-3">sin asignar</span>}
              </td>
              <td className="px-4 py-3 font-mono text-[13px] tabular-nums text-tinta-2">
                {fechaCorta(f.fecha_comprometida) ?? <span className="text-rojo">sin fecha</span>}
              </td>
              <td className="px-4 py-3 font-mono text-[13px] tabular-nums">
                <span className={f.dias_sin_novedades > 7 ? 'font-semibold text-rojo' : 'text-tinta-2'}>
                  {f.dias_sin_novedades} {f.dias_sin_novedades === 1 ? 'día' : 'días'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Grupo({
  color,
  filas,
}: {
  color: Color
  filas: Fila[]
}) {
  if (filas.length === 0) return null
  const c = COLORES[color]

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className={`size-2 rounded-full ${c.punto}`} aria-hidden />
        <h2 className="text-base font-semibold tracking-tight">{c.etiqueta}</h2>
        <span className="font-mono text-[11px] uppercase tracking-wider text-tinta-3">
          {filas.length} · {c.ayuda}
        </span>
      </div>
      <TablaProyectos filas={filas} />
    </section>
  )
}
