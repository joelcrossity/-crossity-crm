'use client'

import { useState, useTransition, useRef } from 'react'
import { cargarNovedad } from '@/app/acciones'

const TIPOS = [
  { valor: 'entrega',        texto: 'Entrega',       ayuda: 'avanzó el trabajo' },
  { valor: 'comercial',      texto: 'Comercial',     ayuda: 'negociación con el cliente' },
  { valor: 'administrativo', texto: 'Administrativo', ayuda: 'factura, cobro, contrato' },
  { valor: 'decision',       texto: 'Decisión',      ayuda: 'algo que se resolvió' },
]

export default function Novedad({ proyectoId }: { proyectoId: string }) {
  const [texto, setTexto] = useState('')
  const [tipo, setTipo] = useState('entrega')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  const caja = useRef<HTMLTextAreaElement>(null)

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    empezar(async () => {
      const r = await cargarNovedad(proyectoId, tipo, texto)
      if (r.ok) {
        setTexto('')
        caja.current?.focus()
      } else {
        setError(r.error)
      }
    })
  }

  const elegido = TIPOS.find((t) => t.valor === tipo)!

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <textarea
        ref={caja}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) enviar(e)
        }}
        rows={2}
        placeholder="Qué pasó. Una línea alcanza."
        disabled={pendiente}
        className="w-full resize-y rounded-md border border-linea bg-superficie px-3 py-2.5
                   text-base leading-relaxed text-tinta transition-colors duration-150
                   placeholder:text-gris-50 hover:border-linea-fuerte focus:border-azul
                   disabled:opacity-50"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTipo(t.valor)}
              title={t.ayuda}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors duration-150 ${
                tipo === t.valor
                  ? 'bg-azul-hondo text-white'
                  : 'text-gris hover:bg-panel hover:text-tinta'
              }`}
            >
              {t.texto}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-rojo">{error}</span>}
          <button
            type="submit"
            disabled={pendiente || !texto.trim()}
            className="rounded-md bg-azul-hondo px-3.5 py-1.5 text-sm font-medium text-white
                       transition-colors duration-150 hover:bg-azul
                       disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pendiente ? 'Guardando…' : 'Agregar novedad'}
          </button>
        </div>
      </div>

      <p className="text-2xs text-gris-50">
        Queda como {elegido.texto.toLowerCase()}: {elegido.ayuda}. Reinicia el contador de días sin
        novedades.
      </p>
    </form>
  )
}
