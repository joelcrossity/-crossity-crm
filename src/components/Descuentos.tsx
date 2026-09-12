'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { anotarGasto, anotarImpuesto, borrarDescuento } from '@/app/acciones'
import { plata, fechaCorta } from '@/lib/estados'

/* ------------------------------------------------------------------
   Lo que se va antes de repartir.

   Un gasto y una retención no son lo mismo contablemente, pero para la
   pregunta que se hace acá —qué se descuenta antes de que cada uno
   cobre— son la misma columna, y separarlos en dos pantallas obligaría
   a sumar de cabeza.

   El cálculo ya existía: gastos e impuestos se restaban de la base de
   reparto desde el principio. Lo que faltaba era la ventana. Un cálculo
   correcto e invisible es, en la práctica, uno que no está: si nadie
   puede cargar la retención, se descuenta a mano en otro lado y el
   sistema queda mintiendo.
   ------------------------------------------------------------------ */

export type Descuento = {
  clave: string
  id: string
  clase: string
  concepto: string
  detalle: string | null
  monto: number
  neto: number
  alicuota: number | null
  iva_discriminado: boolean
  fecha: string
  entrega: string | null
}

export type ConceptoImpuesto = {
  clave: string
  etiqueta: string
  alicuota: number | null
  jurisdiccion: string
  ayuda: string | null
}

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

const rotulo = 'text-2xs font-medium uppercase tracking-wider text-gris-50'

export default function Descuentos({
  proyectoId,
  descuentos,
  conceptos,
  hitos,
  bruto,
  moneda,
  hoy,
  puedeEditar,
}: {
  proyectoId: string
  descuentos: Descuento[]
  conceptos: ConceptoImpuesto[]
  hitos: { id: string; titulo: string; monto: number }[]
  bruto: number
  moneda: string
  hoy: string
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<'impuesto' | 'gasto' | null>(null)
  const [elegido, setElegido] = useState(conceptos[0]?.clave ?? 'otro')
  const [hito, setHito] = useState('')

  const concepto = conceptos.find((c) => c.clave === elegido)
  const total = descuentos.reduce((s, d) => s + Number(d.monto), 0)
  const queda = bruto - total

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>, luego?: () => void) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo guardar.')
      else {
        luego?.()
        router.refresh()
      }
    })
  }

  // La base sugerida: la entrega elegida, o el proyecto entero.
  const base = hito ? (hitos.find((h) => h.id === hito)?.monto ?? 0) : bruto

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-md font-bold tracking-tight">Qué se descuenta antes de repartir</h2>
          <p className="max-w-[70ch] text-sm text-gris">
            Retenciones, impuesto al cheque, comisiones y gastos del proyecto. Todo esto se resta
            del total antes de calcular la parte de cada uno.
          </p>
        </div>
        {puedeEditar && !abierto && (
          <span className="flex shrink-0 gap-1.5">
            <button type="button" onClick={() => setAbierto('impuesto')} className="boton boton-secundario boton-chico">
              Retención o impuesto
            </button>
            <button type="button" onClick={() => setAbierto('gasto')} className="boton boton-secundario boton-chico">
              Gasto
            </button>
          </span>
        )}
      </div>

      {error && <p className="text-sm font-medium text-rojo">{error}</p>}

      {abierto === 'impuesto' && (
        <form
          action={(fd) => correr(() => anotarImpuesto(fd), () => setAbierto(null))}
          className="surge flex flex-wrap items-end gap-2 rounded-lg border border-azul bg-azul-aire p-3"
        >
          <input type="hidden" name="proyecto_id" value={proyectoId} />
          <input type="hidden" name="jurisdiccion" value={concepto?.jurisdiccion ?? 'nacional'} />

          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Qué es</span>
            <select
              value={elegido}
              onChange={(e) => setElegido(e.target.value)}
              className={`${campo} w-56`}
            >
              {conceptos.map((c) => (
                <option key={c.clave} value={c.clave}>
                  {c.etiqueta}
                </option>
              ))}
            </select>
            <input type="hidden" name="concepto" value={concepto?.etiqueta ?? 'Otro'} />
          </label>

          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Sobre qué entrega</span>
            <select
              name="hito_id"
              value={hito}
              onChange={(e) => setHito(e.target.value)}
              className={`${campo} w-52`}
            >
              <option value="">Todo el proyecto</option>
              {hitos.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.titulo}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Alícuota</span>
            <span className="flex items-center gap-1">
              <input
                name="alicuota"
                inputMode="decimal"
                defaultValue={concepto?.alicuota ?? ''}
                key={elegido}
                placeholder="0,6"
                className={`${campo} cifra w-20`}
              />
              <span className="text-sm text-gris-50">%</span>
            </span>
          </label>

          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Sobre cuánto</span>
            <input
              name="base"
              inputMode="decimal"
              defaultValue={base || ''}
              key={`b${hito}`}
              className={`${campo} cifra w-32`}
            />
          </label>

          <span className="text-sm text-gris-50">o</span>

          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Monto exacto</span>
            <input name="monto" inputMode="decimal" placeholder="dejalo vacío" className={`${campo} cifra w-32`} />
          </label>

          <button type="submit" disabled={pendiente} className="boton boton-principal">
            {pendiente ? 'Guardando…' : 'Descontarlo'}
          </button>
          <button type="button" onClick={() => setAbierto(null)} className="boton boton-sutil">
            Cancelar
          </button>

          {concepto?.ayuda && <p className="w-full text-2xs text-gris-50">{concepto.ayuda}.</p>}
        </form>
      )}

      {abierto === 'gasto' && (
        <form
          action={(fd) => correr(() => anotarGasto(fd), () => setAbierto(null))}
          className="surge flex flex-wrap items-end gap-2 rounded-lg border border-azul bg-azul-aire p-3"
        >
          <input type="hidden" name="proyecto_id" value={proyectoId} />

          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Qué se gastó</span>
            <input name="descripcion" required placeholder="Licencia del servidor" className={`${campo} w-56`} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>A quién</span>
            <input name="proveedor" placeholder="Proveedor" className={`${campo} w-44`} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Neto</span>
            <input name="neto" required inputMode="decimal" className={`${campo} cifra w-32`} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>IVA</span>
            <select name="alicuota" defaultValue="21" className={`${campo} w-24`}>
              <option value="21">21 %</option>
              <option value="10.5">10,5 %</option>
              <option value="27">27 %</option>
              <option value="0">Sin IVA</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Fecha</span>
            <input name="fecha" type="date" defaultValue={hoy} className={`${campo} cifra w-40`} />
          </label>
          <label className="flex items-center gap-1.5 px-1 pb-1.5 text-sm text-gris">
            <input
              name="discriminado"
              type="checkbox"
              defaultChecked
              className="size-3.5 accent-[var(--color-azul-hondo)]"
            />
            IVA discriminado
          </label>

          <button type="submit" disabled={pendiente} className="boton boton-principal">
            {pendiente ? 'Guardando…' : 'Cargarlo'}
          </button>
          <button type="button" onClick={() => setAbierto(null)} className="boton boton-sutil">
            Cancelar
          </button>

          <p className="w-full text-2xs text-gris-50">
            Con el IVA discriminado se descuenta solo el neto, porque el IVA es crédito fiscal. Sin
            discriminar —un monotributista— se descuenta el total, porque ése es el costo real.
          </p>
        </form>
      )}

      {descuentos.length === 0 ? (
        <p className="tarjeta px-3.5 py-3 text-sm text-gris">
          No hay nada descontado. Todo lo que entra se reparte tal cual.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {descuentos.map((d) => (
              <li
                key={d.clave}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border
                           border-linea bg-superficie px-3.5 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-base font-medium text-tinta">{d.concepto}</span>
                    <span className={rotulo}>{d.clase === 'gasto' ? 'gasto' : 'retención'}</span>
                  </span>
                  <span className="cifra block truncate text-2xs text-gris-50">
                    {d.detalle ?? '—'}
                    {d.alicuota ? ` · ${Number(d.alicuota)} %` : ''}
                    {d.entrega ? ` · ${d.entrega}` : ' · todo el proyecto'}
                    {d.fecha ? ` · ${fechaCorta(d.fecha)}` : ''}
                  </span>
                </span>

                <span className="cifra shrink-0 text-sm font-medium text-naranja">
                  − {plata(d.monto, moneda)}
                </span>

                {puedeEditar && (
                  <button
                    type="button"
                    aria-label={`Sacar ${d.concepto}`}
                    disabled={pendiente}
                    onClick={() => correr(() => borrarDescuento(d.clase, d.id))}
                    className="shrink-0 text-sm leading-none text-gris-50 transition-colors duration-150 hover:text-rojo"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg
                          border border-linea bg-panel px-3.5 py-2.5">
            <span className="text-sm text-gris">
              De {plata(bruto, moneda)} se descuentan {plata(total, moneda)}
            </span>
            <span className="cifra text-base font-bold text-tinta">
              {plata(queda, moneda)} para repartir
            </span>
          </div>
        </>
      )}
    </section>
  )
}
