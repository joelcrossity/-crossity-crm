'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { marcarLeido } from '@/app/acciones'

/* ------------------------------------------------------------------
   La campanita.

   Dos cosas distintas conviven acá y por eso se marcan distinto:
   lo que pasó mientras no mirabas, y lo que va a pasar si nadie hace
   nada. Lo segundo es lo que hoy Joel recuerda de memoria.
   ------------------------------------------------------------------ */

export type Aviso = {
  clave: string
  clase: string
  momento: string | null
  titulo: string
  proyecto: string | null
  codigo: string | null
  es_mi_plata: boolean
  urgencia: string
  nuevo: boolean
}

const CLASES: Record<string, { texto: string; color: string }> = {
  paso:        { texto: 'Pasó',        color: 'text-gris-50' },
  fecha:       { texto: 'Entrega',     color: 'text-azul-hondo' },
  seguimiento: { texto: 'Seguimiento', color: 'text-amarillo' },
  frenado:     { texto: 'Frenado',     color: 'text-amarillo' },
  anticipo:    { texto: 'Anticipo',    color: 'text-rojo' },
  comision:    { texto: 'Comisión',    color: 'text-violeta-50' },
  abono:       { texto: 'Abono',       color: 'text-verde' },
  sin_cliente: { texto: 'Sin cliente', color: 'text-amarillo' },
}

function cuando(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function Campanita({ avisos }: { avisos: Aviso[] }) {
  const [abierta, setAbierta] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const sinLeer = avisos.filter((a) => a.nuevo).length

  useEffect(() => {
    if (!abierta) return
    function afuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierta(false)
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierta(false)
    }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierta])

  function abrir() {
    setAbierta((v) => !v)
    // Se marca al abrir, no al cerrar: si mirás y te vas, ya lo viste.
    if (!abierta && sinLeer > 0) void marcarLeido()
  }

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={abrir}
        aria-expanded={abierta}
        aria-label={sinLeer > 0 ? `${sinLeer} avisos sin leer` : 'Avisos'}
        className={`relative flex size-8 items-center justify-center rounded-md
                    transition-colors duration-150 ${
                      abierta ? 'bg-azul-aire text-azul-hondo' : 'text-gris hover:bg-superficie hover:text-tinta'
                    }`}
      >
        <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" aria-hidden>
          <path
            d="M6 8a4 4 0 1 1 8 0c0 3 .8 4.3 1.4 5H4.6C5.2 12.3 6 11 6 8Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M8.4 15.5a1.8 1.8 0 0 0 3.2 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {sinLeer > 0 && (
          <span
            className="cifra absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full
                       bg-rojo px-1 text-[10px] font-bold leading-4 text-white"
          >
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {abierta && (
        <div
          className="surge absolute right-0 z-(--z-desplegable) mt-2 flex max-h-[26rem] w-80 flex-col
                     overflow-hidden tarjeta
                     shadow-[0_6px_24px_-8px_oklch(0.232_0.003_106/0.22)]"
        >
          <div className="flex items-baseline justify-between gap-3 border-b border-linea px-3.5 py-2.5">
            <span className="text-sm font-bold text-tinta">Avisos</span>
            <span className="cifra text-2xs text-gris-50">últimos 21 días</span>
          </div>

          {avisos.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-sm text-gris">
              Nada pendiente. Ninguna fecha encima y ningún proyecto frenado.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-linea overflow-y-auto">
              {avisos.map((a) => {
                const c = CLASES[a.clase] ?? CLASES.paso
                const cuerpo = (
                  <>
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`text-2xs font-medium uppercase tracking-wider ${c.color}`}>
                        {c.texto}
                      </span>
                      <span className="cifra shrink-0 text-2xs text-gris-50">{cuando(a.momento)}</span>
                    </span>
                    <span
                      className={`block text-sm leading-snug ${
                        a.urgencia === 'alta' ? 'font-medium text-tinta' : 'text-gris'
                      }`}
                    >
                      {a.titulo}
                    </span>
                    {a.proyecto && (
                      <span className="block truncate text-2xs text-gris-50">
                        {a.proyecto}
                        {a.es_mi_plata && <span className="text-azul-hondo"> · toca tu plata</span>}
                      </span>
                    )}
                  </>
                )

                return (
                  <li key={a.clave} className={a.nuevo ? 'bg-azul-aire/60' : ''}>
                    {a.codigo ? (
                      <Link
                        href={`/proyecto/${a.codigo}`}
                        onClick={() => setAbierta(false)}
                        className="flex flex-col gap-0.5 px-3.5 py-2.5 transition-colors duration-150 hover:bg-panel"
                      >
                        {cuerpo}
                      </Link>
                    ) : (
                      <span className="flex flex-col gap-0.5 px-3.5 py-2.5">{cuerpo}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
