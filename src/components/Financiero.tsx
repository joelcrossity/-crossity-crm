'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { marcarFacturaRecibida, sumarCostoFijo, borrarCostoFijo } from '@/app/acciones'
import { plata, fechaCorta } from '@/lib/estados'

/* ------------------------------------------------------------------
   Las cuatro caras de la administración que faltaban.

   No son cálculos nuevos: son datos que hasta ahora no existían en
   ningún lado y por eso no se podían mostrar.
   ------------------------------------------------------------------ */

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

const rotulo = 'text-2xs font-medium uppercase tracking-wider text-gris-50'

export type PorFacturar = {
  id: string
  titulo: string
  monto_neto: number
  moneda: string
  con_iva: number
  dias_desde_la_entrega: number
  proyecto_codigo: string
  proyecto: string
  cliente: string
  razon_social: string | null
  cuit: string | null
}

export function PorFacturar({ filas }: { filas: PorFacturar[] }) {
  const viejas = filas.filter((f) => f.dias_desde_la_entrega > 15)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight">Hay que facturarle al cliente</h2>
        <p className="max-w-[70ch] text-sm text-gris">
          Se entregó y todavía no salió la factura. Cada día acá es un día que la plata no empieza
          a correr.
          {viejas.length > 0 && (
            <span className="font-medium text-rojo"> {viejas.length} llevan más de 15 días.</span>
          )}
        </p>
      </div>

      {filas.length === 0 ? (
        <p className="rounded-lg border border-linea bg-superficie px-3.5 py-3 text-sm text-gris">
          Nada pendiente: todo lo entregado está facturado.
        </p>
      ) : (
        <ul className="escalona flex flex-col gap-1.5">
          {filas.map((f) => (
            <li key={f.id}>
              <Link
                href={`/proyecto/${f.proyecto_codigo}`}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border
                           border-linea bg-superficie px-3.5 py-2.5 transition-colors duration-150
                           hover:border-azul"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-tinta">
                    {f.titulo}
                  </span>
                  <span className="cifra block truncate text-2xs text-gris-50">
                    {f.proyecto} · {f.razon_social ?? f.cliente}
                    {f.cuit && ` · ${f.cuit}`}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="cifra block text-sm font-medium text-tinta">
                    {plata(f.con_iva, f.moneda)}
                  </span>
                  <span className="cifra block text-2xs text-gris-50">
                    {plata(f.monto_neto, f.moneda)} neto
                  </span>
                </span>

                <span
                  className={`cifra w-20 shrink-0 text-right text-2xs ${
                    f.dias_desde_la_entrega > 15 ? 'font-bold text-rojo' : 'text-gris-50'
                  }`}
                >
                  {f.dias_desde_la_entrega} días
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export type PorRecibir = {
  id: string
  persona: string
  monto: number
  moneda: string
  entrega: string
  proyecto: string
  proyecto_codigo: string
  concepto: string
}

export function FacturasARecibir({ filas }: { filas: PorRecibir[] }) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Se agrupa por persona: se le pide una factura a alguien, no a una entrega.
  const porPersona = new Map<string, PorRecibir[]>()
  for (const f of filas) {
    const l = porPersona.get(f.persona) ?? []
    l.push(f)
    porPersona.set(f.persona, l)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight">Nos tienen que facturar</h2>
        <p className="max-w-[70ch] text-sm text-gris">
          La plata del cliente ya entró y no se puede transferir hasta que facturen. Es el paso que
          nadie se acuerda de pedir, y el que después demora el pago.
        </p>
      </div>

      {error && <p className="text-sm text-rojo">{error}</p>}

      {porPersona.size === 0 ? (
        <p className="rounded-lg border border-linea bg-superficie px-3.5 py-3 text-sm text-gris">
          No hay facturas pendientes de nadie.
        </p>
      ) : (
        <ul className="escalona flex flex-col gap-2">
          {[...porPersona.entries()].map(([persona, suyas]) => {
            const total = suyas.reduce((s, f) => s + Number(f.monto), 0)
            return (
              <li
                key={persona}
                className="flex flex-col gap-2 rounded-lg border border-linea bg-superficie p-3.5"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-base font-bold tracking-tight text-tinta">{persona}</span>
                  <span className="cifra text-sm font-medium text-azul-hondo">
                    {plata(total, suyas[0].moneda)}
                  </span>
                </span>

                <ul className="flex flex-col gap-1">
                  {suyas.map((f) => (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
                    >
                      <Link
                        href={`/proyecto/${f.proyecto_codigo}`}
                        className="min-w-0 text-sm text-gris transition-colors duration-150 hover:text-azul-hondo"
                      >
                        {f.entrega}
                        <span className="cifra block text-2xs text-gris-50">
                          {f.proyecto} · {f.concepto}
                        </span>
                      </Link>

                      <span className="flex shrink-0 items-center gap-2">
                        <span className="cifra text-2xs text-gris">
                          {plata(f.monto, f.moneda)}
                        </span>
                        <input
                          type="date"
                          aria-label={`Cuándo facturó ${persona}`}
                          disabled={pendiente}
                          onChange={(e) => {
                            setError(null)
                            empezar(async () => {
                              const r = await marcarFacturaRecibida(f.id, e.target.value, '')
                              if (!r.ok) setError(r.error)
                              else router.refresh()
                            })
                          }}
                          className={`${campo} cifra w-36`}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export type Recurrente = {
  lado: string
  concepto: string
  quien: string
  mensual: number
  moneda: string
  codigo: string | null
}

export type CostoFijo = {
  id: string
  concepto: string
  proveedor: string | null
  monto: number
  moneda: string
  cada: string
  hasta: string | null
}

const CADA: [string, string][] = [
  ['mensual', 'Por mes'],
  ['bimestral', 'Cada 2 meses'],
  ['trimestral', 'Cada 3 meses'],
  ['semestral', 'Cada 6 meses'],
  ['anual', 'Por año'],
]

export function Recurrentes({
  recurrentes,
  costos,
}: {
  recurrentes: Recurrente[]
  costos: CostoFijo[]
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entra = recurrentes.filter((r) => r.lado === 'entra')
  const sale = recurrentes.filter((r) => r.lado === 'sale')

  /* Separado por moneda: un abono en dólares es una cobertura, y meterlo
     dentro de un total en pesos borra la información por la que se cobra
     en dólares. La comparación con los costos se hace en pesos, que es
     donde se pagan. */
  const sumar = (filas: Recurrente[]) => {
    const m = new Map<string, number>()
    for (const r of filas) m.set(r.moneda, (m.get(r.moneda) ?? 0) + Number(r.mensual))
    return [...m.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => (a[0] === 'ARS' ? -1 : b[0] === 'ARS' ? 1 : a[0].localeCompare(b[0])))
  }
  const entraPorMoneda = sumar(entra)
  const salePorMoneda = sumar(sale)
  const totalEntra = entra.filter((r) => r.moneda === 'ARS').reduce((s, r) => s + Number(r.mensual), 0)
  const totalSale = sale.filter((r) => r.moneda === 'ARS').reduce((s, r) => s + Number(r.mensual), 0)

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

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight">Todos los meses</h2>
        <p className="max-w-[70ch] text-sm text-gris">
          Lo que pasa sin que nadie haga nada. Es el piso sobre el que se apoya todo lo demás: si
          los abonos cubren los costos fijos, un mes flojo de proyectos no duele.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5 rounded-lg border border-linea bg-superficie p-3.5">
          <span className={rotulo}>Entra por mes</span>
          <span className="cifra flex flex-wrap items-baseline gap-x-3 text-xl font-bold text-verde">
            {entraPorMoneda.length === 0
              ? plata(0)
              : entraPorMoneda.map(([m, v]) => <span key={m}>{plata(v, m)}</span>)}
          </span>
          <span className="text-2xs text-gris-50">{entra.length} abonos vigentes</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-lg border border-linea bg-superficie p-3.5">
          <span className={rotulo}>Sale por mes</span>
          <span className="cifra flex flex-wrap items-baseline gap-x-3 text-xl font-bold text-tinta">
            {salePorMoneda.length === 0
              ? plata(0)
              : salePorMoneda.map(([m, v]) => <span key={m}>{plata(v, m)}</span>)}
          </span>
          <span
            className={`text-2xs ${totalSale > totalEntra ? 'font-medium text-rojo' : 'text-gris-50'}`}
          >
            {totalSale > totalEntra
              ? `en pesos los abonos no lo cubren, faltan ${plata(totalSale - totalEntra)}`
              : `en pesos está cubierto, sobran ${plata(totalEntra - totalSale)}`}
          </span>
        </div>
      </div>

      {entra.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className={rotulo}>Abonos</h3>
          <ul className="flex flex-col gap-1">
            {entra.map((r) => (
              <li
                key={r.codigo ?? r.concepto}
                className="flex flex-wrap items-baseline justify-between gap-x-4 rounded-lg
                           border border-linea bg-superficie px-3.5 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base text-tinta">{r.concepto}</span>
                  <span className="block truncate text-2xs text-gris-50">{r.quien}</span>
                </span>
                <span className="cifra shrink-0 text-sm font-medium text-verde">
                  {plata(r.mensual, r.moneda)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className={rotulo}>Costos fijos</h3>
          {!abierto && (
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="boton boton-secundario boton-chico"
            >
              Sumar un costo
            </button>
          )}
        </div>

        {abierto && (
          <form
            action={(fd) => correr(() => sumarCostoFijo(fd), () => setAbierto(false))}
            className="surge flex flex-wrap items-end gap-2 rounded-lg border border-azul bg-azul-aire p-3"
          >
            <input name="concepto" required placeholder="Qué es" className={`${campo} w-52`} autoFocus />
            <input name="proveedor" placeholder="A quién" className={`${campo} w-44`} />
            <input name="monto" required inputMode="decimal" placeholder="Monto" className={`${campo} cifra w-32`} />
            <select name="cada" defaultValue="mensual" className={`${campo} w-40`} aria-label="Cada cuánto">
              {CADA.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pendiente}
              className="boton boton-principal"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="boton boton-sutil"
            >
              Cancelar
            </button>
          </form>
        )}

        {error && <p className="text-sm text-rojo">{error}</p>}

        {costos.length === 0 ? (
          <p className="rounded-lg border border-linea bg-superficie px-3.5 py-3 text-sm text-gris">
            No hay ninguno cargado. Sin esto el cashflow miente por optimista: muestra lo que entra
            y solo una parte de lo que sale.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {costos.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 rounded-lg
                           border border-linea bg-superficie px-3.5 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base text-tinta">{c.concepto}</span>
                  <span className="block truncate text-2xs text-gris-50">
                    {c.proveedor ?? 'sin proveedor'}
                    {c.hasta && ` · hasta ${fechaCorta(c.hasta)}`}
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  <span className="cifra text-sm text-tinta">
                    {plata(c.monto, c.moneda)}
                    <span className="text-2xs text-gris-50">
                      {' '}
                      {CADA.find(([v]) => v === c.cada)?.[1].toLowerCase()}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Borrar ${c.concepto}`}
                    disabled={pendiente}
                    onClick={() => correr(() => borrarCostoFijo(c.id))}
                    className="text-sm leading-none text-gris-50 transition-colors duration-150 hover:text-rojo"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
