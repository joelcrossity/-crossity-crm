import Link from 'next/link'

/* ------------------------------------------------------------------
   Lo que el sistema propone.

   Se ve distinto del resto a propósito. Todas las demás pantallas
   afirman hechos —esto se entregó, esto se cobró—; esto propone. El
   borde degradado avisa que es una hipótesis sin tener que escribirlo
   en cada tarjeta.

   Y hay que decir qué es: no hay ningún modelo detrás. Son reglas
   escritas sobre lo que ya está cargado, más lo que alguien del equipo
   anotó a mano. Llamarlo de otra forma sería vender humo, y cuando una
   sugerencia falla conviene poder decir por qué falló.
   ------------------------------------------------------------------ */

export type Sugerencia = {
  clave: string
  titulo: string
  porque: string
  adonde: string
  accion: string
}

export default function Sugerencias({ lista }: { lista: Sugerencia[] }) {
  if (lista.length === 0) return null

  return (
    <section className="sugerencia flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" className="size-4 text-azul-hondo" fill="none" aria-hidden>
            <path
              d="M8 1.6l1.5 3.9 3.9 1.5-3.9 1.5L8 12.4 6.5 8.5 2.6 7l3.9-1.5L8 1.6Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path d="M12.9 10.8l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z" fill="currentColor" />
          </svg>
          <h2 className="text-md font-bold tracking-tight">Podrías hacer esto</h2>
        </span>
        <span className="text-2xs text-gris-50">
          sale de lo que ya está cargado, no de un modelo
        </span>
      </div>

      <ul className="escalona flex flex-col gap-2">
        {lista.map((s) => (
          <li key={s.clave}>
            <Link
              href={s.adonde}
              className="group flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-tarjeta)]
                         border border-linea bg-panel px-3.5 py-3 transition-colors duration-150
                         hover:border-azul-hondo"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-tinta">{s.titulo}</span>
                <span className="block text-2xs leading-snug text-gris">{s.porque}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-2xs font-medium text-azul-hondo">
                {s.accion}
                <svg
                  viewBox="0 0 12 12"
                  className="size-3 transition-transform duration-150 group-hover:translate-x-0.5"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M3.5 2 7.5 6l-4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
