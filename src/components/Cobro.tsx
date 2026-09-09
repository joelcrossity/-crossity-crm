'use client'

import { useState, useTransition } from 'react'
import { registrarCobro, borrarCobro } from '@/app/acciones'
import { plata } from '@/lib/estados'

/* Registrar el cobro, no tildarlo. La diferencia es que después se puede
   responder cuándo entró y por qué medio, que es la mitad de lo que se
   le pregunta a administración. */
export function RegistrarCobro({
  hitoId,
  sugerido,
  moneda,
  yaCobrado,
}: {
  hitoId: string
  sugerido: number
  moneda: string
  /* La entrega figura cobrada pero nadie registró el pago: pasa con lo
     migrado de las planillas, donde había un tilde y ninguna fecha. */
  yaCobrado?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [monto, setMonto] = useState(sugerido.toString())
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [medio, setMedio] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`rounded-md border px-2.5 py-1 text-xs transition-colors duration-150
                    hover:border-azul hover:text-azul-hondo ${
                      yaCobrado ? 'border-amarillo text-amarillo' : 'border-linea text-gris'
                    }`}
        title={
          yaCobrado
            ? 'Figura cobrada pero no hay pago registrado: falta la fecha y el medio'
            : undefined
        }
      >
        {yaCobrado ? 'Falta el registro del pago' : 'Registrar cobro'}
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        empezar(async () => {
          const r = await registrarCobro(hitoId, monto, fecha, medio, moneda)
          if (r.ok) setAbierto(false)
          else setError(r.error)
        })
      }}
      className="flex flex-wrap items-end gap-2 rounded-md border border-azul bg-azul-aire p-2"
    >
      <label className="flex flex-col gap-0.5">
        <span className="text-2xs uppercase tracking-wider text-gris-50">Monto</span>
        <input
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="cifra w-28 rounded border border-linea bg-superficie px-2 py-1 text-sm text-right"
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-2xs uppercase tracking-wider text-gris-50">Fecha</span>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="cifra rounded border border-linea bg-superficie px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-2xs uppercase tracking-wider text-gris-50">Medio</span>
        <input
          value={medio}
          placeholder="transferencia"
          onChange={(e) => setMedio(e.target.value)}
          className="w-32 rounded border border-linea bg-superficie px-2 py-1 text-sm
                     placeholder:text-gris-50"
        />
      </label>
      <button
        type="submit"
        disabled={pendiente}
        className="boton boton-principal"
      >
        {pendiente ? 'Guardando…' : 'Guardar'}
      </button>
      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="boton boton-sutil"
      >
        Cancelar
      </button>
      {error && <span className="w-full text-2xs text-rojo">{error}</span>}
    </form>
  )
}

export function BorrarCobro({ cobroId }: { cobroId: string }) {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <button
      type="button"
      title={error ?? 'Borrar este cobro'}
      disabled={pendiente}
      onClick={() =>
        empezar(async () => {
          const r = await borrarCobro(cobroId)
          if (!r.ok) setError(r.error)
        })
      }
      className={`text-2xs transition-colors duration-150 ${
        error ? 'text-rojo' : 'text-gris-50 hover:text-rojo'
      }`}
    >
      {pendiente ? '…' : 'borrar'}
    </button>
  )
}

/* Cuánto del proyecto está hecho, ponderado por monto y no por cantidad:
   una entrega que vale el 50 % no pesa igual que una que vale el 13 %. */
export function Avance({
  entregado,
  facturado,
  cobrado,
  total,
  moneda,
}: {
  entregado: number
  facturado: number
  cobrado: number
  total: number
  moneda: string
}) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  const tramos = [
    { texto: 'cobrado', valor: cobrado, color: 'var(--color-verde)' },
    { texto: 'facturado sin cobrar', valor: facturado - cobrado, color: 'var(--color-amarillo)' },
    { texto: 'entregado sin facturar', valor: entregado - facturado, color: 'var(--color-serie-1)' },
  ].filter((t) => t.valor > 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <span className="flex items-baseline gap-2">
          <span className="cifra text-2xl font-bold text-tinta">{pct(entregado)} %</span>
          <span className="text-sm text-gris">entregado</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="cifra text-lg font-bold text-verde">{pct(cobrado)} %</span>
          <span className="text-sm text-gris">cobrado</span>
        </span>
      </div>

      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-sm bg-panel">
        {tramos.map((t) => (
          <span
            key={t.texto}
            style={{ width: `${(t.valor / total) * 100}%`, background: t.color }}
            title={`${t.texto}: ${plata(t.valor, moneda)}`}
          />
        ))}
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        <Linea titulo="Del proyecto" valor={plata(total, moneda)} />
        <Linea titulo="Entregado" valor={plata(entregado, moneda)} />
        <Linea titulo="Facturado" valor={plata(facturado, moneda)} tono="text-amarillo" />
        <Linea titulo="Cobrado" valor={plata(cobrado, moneda)} tono="text-verde" />
        <Linea
          titulo="Falta cobrar"
          valor={plata(total - cobrado, moneda)}
          tono={total - cobrado > 0 ? 'text-rojo' : 'text-verde'}
        />
      </dl>
    </div>
  )
}

function Linea({ titulo, valor, tono }: { titulo: string; valor: string; tono?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-2xs font-medium uppercase tracking-wider text-gris-50">{titulo}</dt>
      <dd className={`cifra text-sm font-bold ${tono ?? 'text-tinta'}`}>{valor}</dd>
    </div>
  )
}
