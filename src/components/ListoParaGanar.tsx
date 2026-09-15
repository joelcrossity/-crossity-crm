'use client'

/* ------------------------------------------------------------------
   Lo que falta antes de convertir una oportunidad en proyecto.

   Ganar no es un tilde: genera entregas, reparte plata y le pone
   fechas a gente. Hacerlo con datos a medias deja un proyecto que hay
   que corregir después, y corregir después es cómo se pierden montos
   —ya nos pasó— porque para entonces hay porciones repartidas encima.

   Se muestran las tres condiciones siempre, no solo las que faltan.
   Una lista que aparece con un renglón no dice si es lo único que
   había que hacer; con las tres a la vista se entiende de una qué es
   estar listo, y el que ya cumplió dos ve que le falta una sola.

   El botón no desaparece: se apaga. Un botón que no está obliga a
   buscarlo; uno apagado con la lista al lado dice qué hacer para
   prenderlo.
   ------------------------------------------------------------------ */

export type Requisito = { texto: string; cumple: boolean; comoSeArregla: string }

export function requisitosParaGanar(d: {
  entregas: number
  moneda: string | null
  casa: string | null
  responsable: string | null
}): Requisito[] {
  return [
    {
      texto: 'Al menos una entrega cargada',
      cumple: d.entregas > 0,
      comoSeArregla: 'Cargalas desde el lápiz, en la cotización.',
    },
    {
      /* En pesos no hay tipo de cambio que definir, así que pedirlo
         sería inventar un requisito que no existe. */
      texto:
        d.moneda && d.moneda !== 'ARS'
          ? 'Moneda y a qué dólar se valúa'
          : 'Moneda definida',
      cumple: Boolean(d.moneda) && (d.moneda === 'ARS' || Boolean(d.casa)),
      comoSeArregla: 'Se elige en el lápiz, arriba de la cotización.',
    },
    {
      texto: 'Un responsable del proyecto',
      cumple: Boolean(d.responsable),
      comoSeArregla: 'Se asigna en el lápiz. Es quien va a responder por esto.',
    },
  ]
}

export default function ListoParaGanar({ requisitos }: { requisitos: Requisito[] }) {
  const faltan = requisitos.filter((r) => !r.cumple)
  if (faltan.length === 0) return null

  return (
    <div
      role="status"
      className="surge flex flex-col gap-2 rounded-md border border-amarillo bg-amarillo-aire
                 px-3.5 py-3"
    >
      <span className="text-sm font-medium text-tinta">
        {faltan.length === 1
          ? 'Falta una cosa para poder convertirla en proyecto.'
          : `Faltan ${faltan.length} cosas para poder convertirla en proyecto.`}
      </span>

      <ul className="flex flex-col gap-1">
        {requisitos.map((r) => (
          <li key={r.texto} className="flex items-start gap-2 text-2xs">
            <span
              aria-hidden
              className={`mt-[3px] grid size-3.5 shrink-0 place-items-center rounded-full ${
                r.cumple ? 'bg-verde' : 'bg-rojo'
              }`}
            >
              <svg viewBox="0 0 12 12" fill="none" className="size-2.5 text-white">
                {r.cumple ? (
                  <path
                    d="M2.5 6.2 4.8 8.5 9.5 3.8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path
                    d="M3.5 3.5l5 5M8.5 3.5l-5 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </span>

            <span className={r.cumple ? 'text-gris-50' : 'text-tinta'}>
              {r.texto}
              {!r.cumple && <span className="text-gris"> — {r.comoSeArregla}</span>}
            </span>

            <span className="sr-only">{r.cumple ? 'cumplido' : 'pendiente'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
