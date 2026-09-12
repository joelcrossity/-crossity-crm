'use client'

import { useSyncExternalStore } from 'react'

/* ------------------------------------------------------------------
   Claro, oscuro, o lo que diga el sistema.

   Las tres opciones importan y la tercera es la que la mayoría quiere:
   que la pantalla siga a la Mac, que a la noche se pone oscura sola.
   Por eso "Automático" es el valor por defecto y no una opción más.

   La elección vive en el navegador de cada uno: es una preferencia de
   cómo mirar, no un dato de la empresa.
   ------------------------------------------------------------------ */

const CLAVE = 'crossity.tema'
const oyentes = new Set<() => void>()

function suscribir(avisar: () => void) {
  oyentes.add(avisar)
  return () => {
    oyentes.delete(avisar)
  }
}

function leer(): string {
  try {
    return localStorage.getItem(CLAVE) ?? 'auto'
  } catch {
    return 'auto'
  }
}

export function aplicarTema(cual: string) {
  const raiz = document.documentElement
  if (cual === 'auto') raiz.removeAttribute('data-tema')
  else raiz.setAttribute('data-tema', cual)
  try {
    localStorage.setItem(CLAVE, cual)
  } catch {}
  oyentes.forEach((f) => f())
}

const OPCIONES: [string, string, React.ReactNode][] = [
  [
    'claro',
    'Claro',
    <svg key="c" viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.4v1.5M8 13.1v1.5M14.6 8h-1.5M2.9 8H1.4M12.7 3.3l-1 1M4.3 11.7l-1 1M12.7 12.7l-1-1M4.3 4.3l-1-1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>,
  ],
  [
    'auto',
    'Auto',
    <svg key="a" viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <rect x="1.8" y="2.8" width="12.4" height="8.6" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.6 13.8h4.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>,
  ],
  [
    'oscuro',
    'Oscuro',
    <svg key="o" viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <path
        d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>,
  ],
]

export default function Tema() {
  const tema = useSyncExternalStore(suscribir, leer, () => 'auto')

  return (
    <div
      role="group"
      aria-label="Tema"
      className="flex gap-0.5 rounded-[var(--radius-control)] border border-linea bg-panel p-0.5"
    >
      {OPCIONES.map(([valor, texto, icono]) => (
        <button
          key={valor}
          type="button"
          aria-pressed={tema === valor}
          title={texto}
          onClick={() => aplicarTema(valor)}
          className={`flex items-center justify-center rounded-[7px] px-2 py-1 text-2xs
                      transition-colors duration-150 ${
                        tema === valor
                          ? 'bg-superficie font-medium text-tinta shadow-[var(--sombra-apoyada)]'
                          : 'text-gris-50 hover:text-gris'
                      }`}
        >
          {icono}
          <span className="sr-only">{texto}</span>
        </button>
      ))}
    </div>
  )
}

/* El tema se aplica antes de pintar para que no haya un parpadeo blanco
   en quien eligió oscuro. Va como script en el head, sin esperar a que
   React arranque. */
export const guionTema = `
try {
  var t = localStorage.getItem('${CLAVE}');
  if (t && t !== 'auto') document.documentElement.setAttribute('data-tema', t);
} catch (e) {}
`
