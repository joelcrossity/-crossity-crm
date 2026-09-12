'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ICONOS } from '@/components/Iconos'

/* ------------------------------------------------------------------
   La navegación.

   En pantalla ancha es una barra lateral y no hace falta nada más. En
   pantalla chica se apilaba entera arriba del contenido y ocupaba
   doscientos treinta píxeles antes de que se viera el primer dato: en
   un teléfono, eso es casi toda la primera pantalla gastada en un menú
   que ya sabés usar.

   Ahí se pliega. Queda la sección donde estás —que es la que ubica— y
   el resto aparece al tocar.
   ------------------------------------------------------------------ */

type Grupo = {
  grupo: string | null
  items: { href: string; nombre: string; detalle: string }[]
}

export default function Navegacion({
  grupos,
  activo,
}: {
  grupos: Grupo[]
  activo: string
}) {
  const [abierto, setAbierto] = useState(false)
  const aqui = grupos.flatMap((g) => g.items).find((i) => i.href === activo)

  return (
    <>
      {/* El pliegue solo existe en pantalla chica. */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex items-center justify-between gap-3 rounded-[var(--radius-control)]
                   border border-linea bg-superficie px-3 py-2 text-base lg:hidden"
      >
        <span className="flex items-center gap-2.5 text-tinta">
          <span className="text-azul-hondo">{ICONOS[activo]}</span>
          <span className="font-semibold">{aqui?.nombre ?? 'Menú'}</span>
        </span>
        <svg
          viewBox="0 0 16 16"
          className={`size-4 shrink-0 text-gris-50 transition-transform duration-200 ${
            abierto ? 'rotate-180' : ''
          }`}
          fill="none"
          aria-hidden
        >
          <path
            d="M4 6.2 8 10l4-3.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <nav
        className={`flex-1 flex-col gap-4 lg:flex ${abierto ? 'surge flex' : 'hidden'}`}
        aria-label="Secciones"
      >
        {grupos.map((g) => (
          <div key={g.grupo ?? 'raiz'} className="flex flex-col gap-0.5">
            {g.grupo && (
              <span className="px-2.5 pb-0.5 text-2xs font-medium uppercase tracking-wider text-gris-50">
                {g.grupo}
              </span>
            )}
            {g.items.map((item) => {
              const aca = activo === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.detalle}
                  onClick={() => setAbierto(false)}
                  aria-current={aca ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2
                              text-base transition-colors duration-150 ${
                                aca
                                  ? 'bg-azul-aire font-semibold text-azul-hondo'
                                  : 'text-gris hover:bg-superficie hover:text-tinta'
                              }`}
                >
                  <span className={aca ? 'text-azul-hondo' : 'text-gris-50'}>
                    {ICONOS[item.href]}
                  </span>
                  {item.nombre}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </>
  )
}
