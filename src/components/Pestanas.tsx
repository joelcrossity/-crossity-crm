'use client'

import { useState } from 'react'
import { BarraSolapas } from '@/components/ui'

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
      <BarraSolapas
        solapas={solapas.map((s) => ({ clave: s.clave, texto: s.texto, señal: s.señal }))}
        activa={activa}
        alElegir={setActiva}
      />

      <div key={activa} className="surge">
        {actual?.contenido}
      </div>
    </div>
  )
}
