'use client'

import { useState } from 'react'

/* Varias preguntas sobre lo mismo, una pantalla. Tomado de cómo lo
   resuelve SUINO en Estadísticas: separar en pantallas distintas
   obligaría a recordar en cuál estaba cada cosa. */

export default function Pestanas({
  solapas,
}: {
  solapas: { clave: string; texto: string; señal?: number; contenido: React.ReactNode }[]
}) {
  const [activa, setActiva] = useState(solapas[0]?.clave ?? '')
  const actual = solapas.find((s) => s.clave === activa) ?? solapas[0]

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Qué mirar"
        className="riel flex gap-1 overflow-x-auto border-b border-linea"
      >
        {solapas.map((s) => {
          const aca = s.clave === activa
          return (
            <button
              key={s.clave}
              type="button"
              role="tab"
              aria-selected={aca}
              onClick={() => setActiva(s.clave)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm
                          transition-colors duration-150 ${
                            aca
                              ? 'border-azul-hondo font-medium text-tinta'
                              : 'border-transparent text-gris hover:text-tinta'
                          }`}
            >
              {s.texto}
              {s.señal !== undefined && s.señal > 0 && (
                <span
                  className={`cifra rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    aca ? 'bg-azul-aire text-azul-hondo' : 'bg-panel text-gris-50'
                  }`}
                >
                  {s.señal}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div key={activa} className="surge">
        {actual?.contenido}
      </div>
    </div>
  )
}
