import Link from 'next/link'
import type { Cuenta, Chip } from '@/components/GrillaClientes'

/* Las mismas cuentas en renglones, para comparar de corrido. */

export default function ListaCuentas({
  cuentas,
  porCuenta,
}: {
  cuentas: Cuenta[]
  porCuenta: Map<string, Chip[]>
}) {
  return (
    <ul className="escalona flex flex-col gap-1.5">
      {cuentas.map((c) => {
        const suyos = porCuenta.get(c.codigo) ?? []
        return (
          <li
            key={c.id}
            className="flex flex-col gap-2 tarjeta p-3.5
                       transition-colors duration-150 hover:border-linea-fuerte"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
              <Link href={`/cuentas/${c.codigo}`} className="group min-w-0">
                <span className="text-base font-bold tracking-tight text-tinta group-hover:text-azul-hondo">
                  {c.cuenta}
                </span>
                <span className="cifra block text-2xs text-gris-50">
                  {c.codigo}
                  {c.razones_sociales > 1 && ` · ${c.razones_sociales} razones sociales`}
                  {c.marcas && c.marcas !== c.cuenta && ` · ${c.marcas}`}
                </span>
              </Link>

              <span className="cifra flex shrink-0 flex-wrap gap-x-4 text-2xs">
                {c.en_vivo > 0 && <span className="font-bold text-verde">{c.en_vivo} en vivo</span>}
                {c.en_pipeline > 0 && <span className="text-amarillo">{c.en_pipeline} en pipeline</span>}
                {c.abonos > 0 && (
                  <span className="text-azul-hondo">
                    {c.abonos} abono{c.abonos > 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-gris-50">{c.proyectos_totales} en total</span>
              </span>
            </div>

            {suyos.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 border-t border-linea pt-2">
                {suyos.map((x) => (
                  <li key={x.codigo}>
                    <Link
                      href={`/proyecto/${x.codigo}`}
                      className="flex items-center gap-1.5 rounded-md border border-linea px-2 py-1
                                 text-2xs text-gris transition-colors duration-150
                                 hover:border-azul hover:text-azul-hondo"
                    >
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${
                          x.color === 'verde' ? 'bg-verde' : 'bg-amarillo'
                        }`}
                        aria-hidden
                      />
                      {x.nombre}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
