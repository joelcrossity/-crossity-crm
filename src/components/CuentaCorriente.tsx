import Link from 'next/link'
import { plata, fechaCorta } from '@/lib/estados'

/* ------------------------------------------------------------------
   La cuenta corriente.

   Se arma de hechos que el sistema ya registra —se facturó, se cobró—,
   no de comprobantes cargados aparte. No hay nada nuevo que cargar.

   Dos cifras separadas a propósito: lo facturado sin cobrar ES deuda;
   lo entregado sin facturar todavía no lo es, pero se va a reclamar.
   Mezclarlas lleva a las dos confusiones típicas: reclamar lo que no se
   facturó, y olvidar lo que se entregó.
   ------------------------------------------------------------------ */

export type Saldo = {
  organizacion_id: string
  cliente_codigo: string
  cliente: string
  moneda: string
  facturado: number
  cobrado: number
  debe: number
  sin_facturar: number
  dias_del_mas_viejo: number | null
}

export type Movimiento = {
  clave: string
  fecha: string
  clase: string
  detalle: string
  debe: number
  haber: number
  moneda: string
  proyecto_codigo: string
  proyecto: string
}

export function Saldos({ saldos }: { saldos: Saldo[] }) {
  const conDeuda = saldos
    .filter((s) => Number(s.debe) > 0)
    .sort((a, b) => Number(b.debe) - Number(a.debe))
  const total = conDeuda
    .filter((s) => s.moneda === 'ARS')
    .reduce((s, x) => s + Number(x.debe), 0)
  const porFacturar = saldos
    .filter((s) => s.moneda === 'ARS')
    .reduce((s, x) => s + Number(x.sin_facturar), 0)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight">Cuentas corrientes</h2>
        <p className="max-w-[70ch] text-sm text-gris">
          Lo facturado y sin cobrar es deuda. Lo entregado y sin facturar todavía no lo es, pero se
          va a reclamar. Verlas separadas evita reclamar lo que no se facturó.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5 tarjeta p-3.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
            Nos deben
          </span>
          <span className={`cifra text-xl font-bold ${total > 0 ? 'text-rojo' : 'text-tinta'}`}>
            {plata(total)}
          </span>
          <span className="text-2xs text-gris-50">
            {conDeuda.length} cuenta{conDeuda.length === 1 ? '' : 's'} con saldo
          </span>
        </div>
        <div className="flex flex-col gap-0.5 tarjeta p-3.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
            Entregado y sin facturar
          </span>
          <span className="cifra text-xl font-bold text-amarillo">{plata(porFacturar)}</span>
          <span className="text-2xs text-gris-50">todavía no es deuda del cliente</span>
        </div>
      </div>

      {conDeuda.length === 0 ? (
        <p className="tarjeta px-3.5 py-3 text-sm text-gris">
          Ningún cliente tiene saldo pendiente.
        </p>
      ) : (
        <ul className="escalona flex flex-col gap-1.5">
          {conDeuda.map((s) => (
            <li key={`${s.organizacion_id}-${s.moneda}`}>
              <Link
                href={`/cuentas/${s.cliente_codigo}`}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border
                           border-linea bg-superficie px-3.5 py-2.5 transition-colors duration-150
                           hover:border-azul"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-tinta">
                    {s.cliente}
                  </span>
                  <span className="cifra block text-2xs text-gris-50">
                    facturado {plata(s.facturado, s.moneda)} · cobrado {plata(s.cobrado, s.moneda)}
                  </span>
                </span>

                {Number(s.sin_facturar) > 0 && (
                  <span className="cifra shrink-0 text-2xs text-amarillo">
                    +{plata(s.sin_facturar, s.moneda)} sin facturar
                  </span>
                )}

                <span className="shrink-0 text-right">
                  <span className="cifra block text-sm font-bold text-rojo">
                    {plata(s.debe, s.moneda)}
                  </span>
                  {s.dias_del_mas_viejo !== null && (
                    <span
                      className={`cifra block text-2xs ${
                        s.dias_del_mas_viejo > 45 ? 'font-medium text-rojo' : 'text-gris-50'
                      }`}
                    >
                      el más viejo, {s.dias_del_mas_viejo} días
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* La cuenta corriente de un cliente, para su propia ficha. */
export default function CuentaCorriente({
  saldos,
  movimientos,
}: {
  saldos: Saldo[]
  movimientos: Movimiento[]
}) {
  const orden = [...movimientos].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight">Cuenta corriente</h2>
        <p className="max-w-[65ch] text-sm text-gris">
          Se arma sola de lo que ya está cargado: cada factura suma y cada cobro resta.
        </p>
      </div>

      {saldos.length === 0 ? (
        <p className="tarjeta px-3.5 py-3 text-sm text-gris">
          Todavía no hay movimientos.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4">
            {saldos.map((s) => (
              <div
                key={s.moneda}
                className="flex flex-col gap-0.5 tarjeta p-3.5"
              >
                <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
                  Saldo {s.moneda !== 'ARS' && `en ${s.moneda}`}
                </span>
                <span
                  className={`cifra text-xl font-bold ${
                    Number(s.debe) > 0 ? 'text-rojo' : 'text-verde'
                  }`}
                >
                  {plata(s.debe, s.moneda)}
                </span>
                <span className="cifra text-2xs text-gris-50">
                  facturado {plata(s.facturado, s.moneda)} · cobrado {plata(s.cobrado, s.moneda)}
                  {Number(s.sin_facturar) > 0 && (
                    <span className="block text-amarillo">
                      {plata(s.sin_facturar, s.moneda)} entregado y sin facturar
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {orden.length > 0 && (
            <ul className="flex flex-col divide-y divide-linea overflow-hidden tarjeta">
              {orden.slice(0, 25).map((m) => (
                <li
                  key={m.clave}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-3.5 py-2"
                >
                  <span className="cifra w-16 shrink-0 text-2xs text-gris-50">
                    {fechaCorta(m.fecha)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-tinta">{m.detalle}</span>
                    <span className="cifra block truncate text-2xs text-gris-50">{m.proyecto}</span>
                  </span>
                  <span className="cifra w-28 shrink-0 text-right text-sm">
                    {Number(m.debe) > 0 ? (
                      <span className="text-tinta">{plata(m.debe, m.moneda)}</span>
                    ) : (
                      <span className="text-verde">−{plata(m.haber, m.moneda)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
