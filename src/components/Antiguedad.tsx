import Link from 'next/link'
import { plata } from '@/lib/estados'
import { Seccion } from '@/components/ui'

/* ------------------------------------------------------------------
   Antigüedad de deuda.

   Tomado de SUINO, que lo tiene al lado de la cuenta corriente. Es la
   diferencia entre saber cuánto te deben y saber qué tan mal está: un
   millón en facturas de esta semana es una empresa sana, el mismo
   millón con noventa días encima es un problema. El total solo no
   distingue las dos cosas, y por eso mirarlo tranquiliza de más.
   ------------------------------------------------------------------ */

export type Tramo = {
  organizacion_id: string
  cliente_codigo: string
  cliente: string
  moneda: string
  al_dia: number
  d31_60: number
  d61_90: number
  mas_de_90: number
  total: number
}

const COLUMNAS: { campo: keyof Tramo; texto: string; color: string }[] = [
  { campo: 'al_dia', texto: 'Hasta 30', color: 'var(--color-verde)' },
  { campo: 'd31_60', texto: '31 a 60', color: 'var(--color-serie-1)' },
  { campo: 'd61_90', texto: '61 a 90', color: 'var(--color-serie-4)' },
  { campo: 'mas_de_90', texto: 'Más de 90', color: 'var(--color-rojo)' },
]

export default function Antiguedad({ filas }: { filas: Tramo[] }) {
  const orden = [...filas].sort((a, b) => Number(b.mas_de_90) - Number(a.mas_de_90) || Number(b.total) - Number(a.total))
  const suma = (c: keyof Tramo) => orden.reduce((s, f) => s + Number(f[c] ?? 0), 0)
  const total = suma('total')
  const viejo = suma('d61_90') + suma('mas_de_90')

  if (orden.length === 0)
    return (
      <p className="tarjeta px-3.5 py-3 text-sm text-gris">
        No hay facturas pendientes de cobro.
      </p>
    )

  return (
    <Seccion
      titulo="Antigüedad de la deuda"
      ayuda={
        <>
          Cuánto hace que está sin cobrar cada peso. Un millón en facturas de esta semana es una
          empresa sana; el mismo millón con noventa días encima es un problema.
          {viejo > 0 && (
            <span className="font-medium text-rojo"> {plata(viejo)} lleva más de sesenta días.</span>
          )}
        </>
      }
    >

      {/* La barra total primero: la proporción se lee antes que los
          números, y es la proporción lo que dice si hay que preocuparse. */}
      <span className="flex h-3 gap-px overflow-hidden rounded-sm bg-panel" aria-hidden>
        {COLUMNAS.map((c) => {
          const v = suma(c.campo)
          return v > 0 ? (
            <span key={c.campo} style={{ width: `${(v / total) * 100}%`, background: c.color }} />
          ) : null
        })}
      </span>

      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {COLUMNAS.map((c) => (
          <span key={c.campo} className="flex items-baseline gap-1.5 text-2xs">
            <span className="size-2 shrink-0 self-center rounded-sm" style={{ background: c.color }} aria-hidden />
            <span className="text-gris-50">{c.texto} días</span>
            <span className="cifra font-medium text-tinta">{plata(suma(c.campo))}</span>
          </span>
        ))}
      </div>

      <div className="riel overflow-x-auto tarjeta">
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="border-b border-linea">
              <th className="px-3.5 py-2 text-left text-2xs font-medium uppercase tracking-wider text-gris-50">
                Cliente
              </th>
              {COLUMNAS.map((c) => (
                <th
                  key={c.campo}
                  className="px-3.5 py-2 text-right text-2xs font-medium uppercase tracking-wider text-gris-50"
                >
                  {c.texto}
                </th>
              ))}
              <th className="px-3.5 py-2 text-right text-2xs font-medium uppercase tracking-wider text-gris-50">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {orden.map((f) => (
              <tr key={`${f.organizacion_id}-${f.moneda}`} className="transition-colors duration-150 hover:bg-panel">
                <td className="px-3.5 py-2">
                  <Link
                    href={`/cuentas/${f.cliente_codigo}`}
                    className="text-sm text-tinta transition-colors duration-150 hover:text-azul-hondo"
                  >
                    {f.cliente}
                  </Link>
                </td>
                {COLUMNAS.map((c) => {
                  const v = Number(f[c.campo] ?? 0)
                  return (
                    <td key={c.campo} className="cifra px-3.5 py-2 text-right text-sm">
                      {v > 0 ? (
                        <span className={c.campo === 'mas_de_90' ? 'font-bold text-rojo' : 'text-gris'}>
                          {plata(v, f.moneda)}
                        </span>
                      ) : (
                        <span className="text-gris-50">—</span>
                      )}
                    </td>
                  )
                })}
                <td className="cifra px-3.5 py-2 text-right text-sm font-bold text-tinta">
                  {plata(f.total, f.moneda)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Seccion>
  )
}
