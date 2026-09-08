import Link from 'next/link'
import { plata, fechaCorta, type EtapaViva } from '@/lib/estados'
import type { Op } from '@/components/Tablero'

/* Las mismas oportunidades en renglones: el tablero dice dónde se traba,
   la lista deja comparar montos y fechas de corrido. */

export default function ListaPipeline({
  ops,
  seguimientos,
  etapas,
}: {
  ops: Op[]
  seguimientos: Map<string, string | null>
  etapas: EtapaViva[]
}) {
  const ETIQUETA = new Map<string, string>(etapas.map((e) => [e.valor, e.etiqueta]))
  const orden = new Map<string, number>(etapas.map((e, i) => [e.valor, i]))
  const filas = [...ops].sort(
    (a, b) => (orden.get(b.etapa) ?? 0) - (orden.get(a.etapa) ?? 0),
  )

  return (
    <ul className="escalona flex flex-col gap-1.5">
      {filas.map((o) => (
        <li key={o.id}>
          <Link
            href={`/proyecto/${o.codigo}`}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-linea
                       bg-superficie px-3.5 py-2.5 transition-colors duration-150 hover:border-azul"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium text-tinta">{o.nombre}</span>
              <span className="cifra block truncate text-2xs text-gris-50">
                {o.cliente}
                {o.referente && ` · por ${o.referente}`}
              </span>
            </span>

            <span className="w-28 shrink-0 text-2xs text-gris">
              {ETIQUETA.get(o.etapa) ?? o.etapa}
            </span>

            <span className="cifra w-32 shrink-0 text-right text-sm text-tinta">
              {o.monto_neto !== null ? plata(o.monto_neto, o.moneda) : (
                <span className="text-2xs text-gris-50">sin monto</span>
              )}
            </span>

            <span className="cifra w-24 shrink-0 text-right text-2xs">
              {o.seguimiento_vencido ? (
                <span className="font-medium text-rojo">vencido</span>
              ) : o.sin_agendar ? (
                <span className="text-amarillo">sin agendar</span>
              ) : (
                <span className="text-gris-50">
                  {fechaCorta(seguimientos.get(o.id) ?? null) ?? '—'}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
