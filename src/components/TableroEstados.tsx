import Link from 'next/link'
import { SUBESTADO, fechaCorta } from '@/lib/estados'
import type { Fila } from '@/components/TablaProyectos'

/* ------------------------------------------------------------------
   Los proyectos como tablero, por estado.

   A diferencia del pipeline, acá las tarjetas no se arrastran, y es a
   propósito: pasar algo a standby o darlo por perdido exige un motivo,
   y un motivo no se elige arrastrando. El cambio de estado se hace en
   la ficha, donde se puede decir por qué.

   Este tablero es para ver, no para tocar: cuánto hay en cada estado y
   qué se está quedando atrás dentro de cada uno.
   ------------------------------------------------------------------ */

const COLUMNAS: { color: string; texto: string; ayuda: string; punto: string }[] = [
  { color: 'verde',    texto: 'En vivo',   ayuda: 'se trabaja ahora',        punto: 'bg-verde' },
  { color: 'amarillo', texto: 'A seguir',  ayuda: 'la pelota está del otro lado', punto: 'bg-amarillo' },
  { color: 'gris',     texto: 'Standby',   ayuda: 'ni muerto ni vivo',       punto: 'bg-gris-50' },
  { color: 'naranja',  texto: 'Terminado', ayuda: 'no hay más que hacer',    punto: 'bg-naranja' },
  { color: 'rojo',     texto: 'Perdido',   ayuda: 'salió mal o se descartó', punto: 'bg-rojo' },
]

export default function TableroEstados({ filas }: { filas: Fila[] }) {
  return (
    <div className="riel -mx-5 flex gap-3 overflow-x-auto px-5 pb-3 lg:-mx-10 lg:px-10">
      {COLUMNAS.map((c) => {
        const suyas = filas.filter((f) => f.color === c.color)
        const frenados = suyas.filter((f) => f.dias_sin_novedades > 7).length

        return (
          <section
            key={c.color}
            className="flex w-[16.5rem] shrink-0 flex-col gap-2.5 rounded-lg border border-linea
                       bg-panel p-2.5 [scroll-snap-align:start]"
          >
            <header className="flex flex-col gap-0.5 px-1 pt-0.5">
              <span className="flex items-baseline gap-2">
                <span className={`size-2 shrink-0 rounded-full ${c.punto}`} aria-hidden />
                <h2 className="text-sm font-bold tracking-tight text-tinta">{c.texto}</h2>
                <span className="cifra ml-auto text-2xs text-gris-50">{suyas.length}</span>
              </span>
              <span className="text-2xs text-gris-50">
                {c.color === 'verde' && frenados > 0 ? (
                  <span className="font-medium text-rojo">{frenados} sin novedades hace una semana</span>
                ) : (
                  c.ayuda
                )}
              </span>
            </header>

            <ul className="escalona flex flex-col gap-2">
              {suyas.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/proyecto/${f.codigo}`}
                    className="flex flex-col gap-2 rounded-md border border-linea bg-superficie p-3
                               transition-[border-color,box-shadow] duration-150 hover:border-azul
                               hover:shadow-[0_2px_8px_-4px_oklch(0.232_0.003_106/0.25)]"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold leading-snug tracking-tight text-tinta">
                        {f.nombre}
                      </span>
                      <span className="truncate text-2xs text-gris-50">{f.cliente}</span>
                    </span>

                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xs">
                      {f.subestado && (
                        <span className="text-gris">{SUBESTADO[f.subestado] ?? f.subestado}</span>
                      )}
                      {f.fecha_comprometida && (
                        <span className="cifra text-gris-50">{fechaCorta(f.fecha_comprometida)}</span>
                      )}
                    </span>

                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-2xs">
                      <span className={f.responsable ? 'text-gris' : 'text-amarillo'}>
                        {f.responsable ?? 'sin responsable'}
                      </span>
                      {f.color === 'verde' && f.dias_sin_novedades > 7 && (
                        <span className="cifra shrink-0 font-medium text-rojo">
                          {f.dias_sin_novedades} d
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}

              {suyas.length === 0 && (
                <li className="rounded-md border border-dashed border-linea-fuerte px-3 py-6
                               text-center text-2xs text-gris-50">
                  Ninguno
                </li>
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
