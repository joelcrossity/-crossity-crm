'use client'

import { useSyncExternalStore } from 'react'

/* ------------------------------------------------------------------
   Tablero o lista, y que se acuerde.

   Son dos preguntas distintas sobre lo mismo. El tablero contesta
   "dónde se está trabando"; la lista contesta "qué hay y en qué orden".
   Nadie usa una sola: se mira el tablero para entender y la lista para
   trabajar.

   La elección queda guardada en el navegador de cada uno. Es una
   preferencia de cómo mirar, no un dato de la empresa: no tiene por qué
   viajar a la base ni ser igual para todos.
   ------------------------------------------------------------------ */

const oyentes = new Set<() => void>()

function suscribir(avisar: () => void) {
  oyentes.add(avisar)
  return () => {
    oyentes.delete(avisar)
  }
}

function leer(clave: string) {
  try {
    return localStorage.getItem(clave) === 'lista' ? 'lista' : 'tablero'
  } catch {
    // Navegación privada o cookies bloqueadas: se mira el tablero y listo.
    return 'tablero'
  }
}

function elegir(clave: string, cual: string) {
  try {
    localStorage.setItem(clave, cual)
  } catch {}
  oyentes.forEach((f) => f())
}

export default function Vistas({
  clave,
  tablero,
  lista,
  acciones,
}: {
  clave: string
  tablero: React.ReactNode
  lista: React.ReactNode
  acciones?: React.ReactNode
}) {
  const vista = useSyncExternalStore(
    suscribir,
    () => leer(clave),
    () => 'tablero',
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Cómo mirar"
          className="flex gap-0.5 rounded-md border border-linea bg-panel p-0.5"
        >
          {(
            [
              ['tablero', 'Tablero', <Columnas key="t" />],
              ['lista', 'Lista', <Renglones key="l" />],
            ] as const
          ).map(([valor, texto, icono]) => (
            <button
              key={valor}
              type="button"
              onClick={() => elegir(clave, valor)}
              aria-pressed={vista === valor}
              className={`flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-sm
                          transition-colors duration-150 ${
                            vista === valor
                              ? 'bg-superficie font-medium text-tinta shadow-[0_1px_2px_oklch(0.232_0.003_106/0.08)]'
                              : 'text-gris-50 hover:text-gris'
                          }`}
            >
              {icono}
              {texto}
            </button>
          ))}
        </div>
        {acciones}
      </div>

      <div key={vista} className="surge">
        {vista === 'lista' ? lista : tablero}
      </div>
    </div>
  )
}

function Columnas() {
  return (
    <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden fill="none">
      <rect x="1.5" y="2" width="3.4" height="10" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9.1" y="2" width="3.4" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function Renglones() {
  return (
    <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden fill="none">
      <path
        d="M2 3.5h10M2 7h10M2 10.5h10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}
