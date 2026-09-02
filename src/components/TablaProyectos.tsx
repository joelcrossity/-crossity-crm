import Link from 'next/link'
import { SUBESTADO, fechaCorta } from '@/lib/estados'

export type Fila = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  color: string
  subestado: string | null
  motivo_gris: string | null
  prioridad: number | null
  fecha_comprometida: string | null
  es_producto_propio: boolean
  responsable: string | null
  dias_sin_novedades: number
}

const PUNTO: Record<string, string> = {
  verde: 'bg-verde',
  amarillo: 'bg-amarillo',
  gris: 'bg-gris-50',
  naranja: 'bg-naranja',
  rojo: 'bg-rojo',
}

const TITULO: Record<string, { texto: string; ayuda: string }> = {
  verde:    { texto: 'En vivo',   ayuda: 'se está trabajando ahora' },
  amarillo: { texto: 'A seguir',  ayuda: 'la pelota está del otro lado' },
  gris:     { texto: 'Standby',   ayuda: 'ni muerto ni vivo' },
  naranja:  { texto: 'Terminado', ayuda: 'no hay nada más que hacer' },
  rojo:     { texto: 'Perdido',   ayuda: 'salió mal o se descartó' },
}

export function Grupo({ color, filas }: { color: string; filas: Fila[] }) {
  if (filas.length === 0) return null
  const t = TITULO[color]

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className={`size-2 shrink-0 rounded-full ${PUNTO[color]}`} aria-hidden />
        <h2 className="text-md font-bold tracking-tight">{t.texto}</h2>
        <span className="cifra text-2xs text-gris-50">{filas.length}</span>
        <span className="text-2xs text-gris-50">· {t.ayuda}</span>
      </div>

      <ul className="divide-y divide-linea overflow-hidden rounded-lg border border-linea bg-superficie">
        {filas.map((f) => (
          <li key={f.id}>
            <Link
              href={`/proyecto/${f.codigo}`}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-5 gap-y-1 px-3.5 py-2.5
                         transition-colors duration-150 hover:bg-panel
                         sm:grid-cols-[1fr_9rem_5.5rem_5.5rem]"
            >
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  {f.prioridad && (
                    <span className="cifra shrink-0 text-2xs font-bold text-azul-hondo">
                      P{f.prioridad}
                    </span>
                  )}
                  <span className="truncate text-base font-medium text-tinta">{f.nombre}</span>
                  {f.es_producto_propio && (
                    <span className="shrink-0 rounded px-1 py-px text-2xs text-azul-hondo ring-1 ring-azul/40">
                      propio
                    </span>
                  )}
                </span>
                <span className="cifra block truncate text-2xs text-gris-50">
                  {f.codigo} · {f.cliente}
                </span>
              </span>

              <span className="hidden truncate text-sm text-gris sm:block">
                {f.responsable ?? <span className="text-gris-50">sin responsable</span>}
              </span>

              <span className="cifra hidden text-sm text-gris sm:block">
                {fechaCorta(f.fecha_comprometida) ?? <span className="text-rojo">sin fecha</span>}
              </span>

              <span className="flex shrink-0 flex-col items-end">
                <span className="text-2xs text-gris">
                  {SUBESTADO[f.subestado ?? f.motivo_gris ?? ''] ?? ''}
                </span>
                <span
                  className={`cifra text-2xs ${
                    f.dias_sin_novedades > 7 ? 'font-bold text-rojo' : 'text-gris-50'
                  }`}
                >
                  {f.dias_sin_novedades}d sin novedades
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
