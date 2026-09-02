'use client'

import { useState, useTransition } from 'react'
import { cambiarEstado } from '@/app/acciones'

const COLORES = [
  { valor: 'verde',    texto: 'En vivo',   punto: 'bg-verde' },
  { valor: 'amarillo', texto: 'A seguir',  punto: 'bg-amarillo' },
  { valor: 'gris',     texto: 'Standby',   punto: 'bg-gris-50' },
  { valor: 'naranja',  texto: 'Terminado', punto: 'bg-naranja' },
  { valor: 'rojo',     texto: 'Perdido',   punto: 'bg-rojo' },
]

const DETALLES: Record<string, { valor: string; texto: string }[]> = {
  verde: [
    { valor: 'en_curso',          texto: 'en curso' },
    { valor: 'bloqueado',         texto: 'bloqueado' },
    { valor: 'esperando_cliente', texto: 'esperando al cliente' },
  ],
  gris: [
    { valor: 'esperando_anticipo', texto: 'esperando el anticipo' },
    { valor: 'pausado_cliente',    texto: 'pausado por el cliente' },
    { valor: 'no_se_dio',          texto: 'no se dio' },
    { valor: 'dormido',            texto: 'dormido' },
  ],
  rojo: [
    { valor: 'perdido',    texto: 'perdido' },
    { valor: 'descartado', texto: 'descartado' },
  ],
}

export default function Estado({
  proyectoId,
  color,
  detalle,
}: {
  proyectoId: string
  color: string
  detalle: string | null
}) {
  const [actual, setActual] = useState(color)
  const [sub, setSub] = useState(detalle)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  const opciones = DETALLES[actual]

  function aplicar(nuevoColor: string, nuevoDetalle: string | null) {
    const anteriorColor = actual
    const anteriorSub = sub
    setActual(nuevoColor)
    setSub(nuevoDetalle)
    setError(null)

    empezar(async () => {
      const r = await cambiarEstado(proyectoId, nuevoColor, nuevoDetalle)
      if (!r.ok) {
        setActual(anteriorColor)
        setSub(anteriorSub)
        setError(r.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline gap-2">
        <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">Estado</span>
        {pendiente && <span className="text-2xs text-gris-50">guardando…</span>}
        {error && <span className="text-2xs text-rojo">{error}</span>}
      </span>

      <div
        role="radiogroup"
        aria-label="Estado del proyecto"
        className="inline-flex flex-wrap gap-1 rounded-lg border border-linea bg-superficie p-1"
      >
        {COLORES.map((c) => {
          const elegido = actual === c.valor
          return (
            <button
              key={c.valor}
              type="button"
              role="radio"
              aria-checked={elegido}
              disabled={pendiente}
              onClick={() => aplicar(c.valor, DETALLES[c.valor]?.[0].valor ?? null)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs
                          transition-colors duration-150 disabled:opacity-50 ${
                            elegido
                              ? 'bg-tinta text-white'
                              : 'text-gris hover:bg-panel hover:text-tinta'
                          }`}
            >
              <span className={`size-1.5 rounded-full ${c.punto}`} aria-hidden />
              {c.texto}
            </button>
          )
        })}
      </div>

      {opciones && (
        <div className="flex flex-wrap gap-1">
          {opciones.map((o) => (
            <button
              key={o.valor}
              type="button"
              disabled={pendiente}
              onClick={() => aplicar(actual, o.valor)}
              className={`rounded-md px-2 py-0.5 text-xs transition-colors duration-150
                          disabled:opacity-50 ${
                            sub === o.valor
                              ? 'bg-azul-aire font-medium text-azul-hondo'
                              : 'text-gris-50 hover:text-tinta'
                          }`}
            >
              {o.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
