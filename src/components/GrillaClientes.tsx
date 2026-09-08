import Link from 'next/link'

/* ------------------------------------------------------------------
   Los clientes como cuentas, no como renglones.

   La pregunta que se le hace a esta pantalla no es "cuántos clientes
   hay" sino "quién nos está dando de comer y quién se enfrió". Por eso
   cada cuenta muestra sus proyectos vivos con nombre, y una barra que
   compara el peso de una contra otra sin tener que leer números.
   ------------------------------------------------------------------ */

export type Cuenta = {
  id: string
  codigo: string
  cuenta: string
  razones_sociales: number
  marcas: string | null
  en_vivo: number
  en_pipeline: number
  abonos: number
  bonificados: number
  proyectos_totales: number
}

export type Chip = { codigo: string; nombre: string; color: string }

export default function GrillaClientes({
  cuentas,
  porCuenta,
}: {
  cuentas: Cuenta[]
  porCuenta: Map<string, Chip[]>
}) {
  const mayor = Math.max(1, ...cuentas.map((c) => c.en_vivo + c.abonos))

  // Primero quien tiene algo pasando: una cuenta dormida no encabeza.
  const orden = [...cuentas].sort(
    (a, b) =>
      b.en_vivo + b.abonos - (a.en_vivo + a.abonos) ||
      b.en_pipeline - a.en_pipeline ||
      a.cuenta.localeCompare(b.cuenta),
  )

  return (
    <ul className="escalona grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {orden.map((c) => {
        const suyos = porCuenta.get(c.codigo) ?? []
        const peso = c.en_vivo + c.abonos
        const dormida = peso === 0 && c.en_pipeline === 0

        return (
          <li key={c.id}>
            <Link
              href={`/cuentas/${c.codigo}`}
              className={`flex h-full flex-col gap-3 rounded-lg border bg-superficie p-4
                          transition-[border-color,box-shadow] duration-150 hover:border-azul
                          hover:shadow-[0_2px_10px_-5px_oklch(0.232_0.003_106/0.28)] ${
                            dormida ? 'border-linea' : 'border-linea-fuerte'
                          }`}
            >
              <span className="flex flex-col gap-0.5">
                <span
                  className={`text-base font-bold leading-snug tracking-tight ${
                    dormida ? 'text-gris' : 'text-tinta'
                  }`}
                >
                  {c.cuenta}
                </span>
                <span className="cifra truncate text-2xs text-gris-50">
                  {c.codigo}
                  {c.razones_sociales > 1 && ` · ${c.razones_sociales} razones sociales`}
                </span>
              </span>

              {/* La barra compara cuentas entre sí; el número solo dice
                  cuántos. Juntos contestan "quién pesa más". */}
              <span className="flex flex-col gap-1">
                <span className="flex h-1.5 overflow-hidden rounded-sm bg-panel" aria-hidden>
                  <span
                    className="transition-[width] duration-500"
                    style={{
                      width: `${(peso / mayor) * 100}%`,
                      background: dormida ? 'var(--color-linea-fuerte)' : 'var(--color-serie-1)',
                    }}
                  />
                </span>
                <span className="cifra flex flex-wrap gap-x-3 text-2xs">
                  {c.en_vivo > 0 && <span className="font-bold text-verde">{c.en_vivo} en vivo</span>}
                  {c.abonos > 0 && <span className="text-azul-hondo">{c.abonos} abono{c.abonos > 1 ? 's' : ''}</span>}
                  {c.en_pipeline > 0 && <span className="text-amarillo">{c.en_pipeline} en pipeline</span>}
                  {dormida && <span className="text-gris-50">sin nada activo</span>}
                  <span className="ml-auto text-gris-50">{c.proyectos_totales} en total</span>
                </span>
              </span>

              {suyos.length > 0 && (
                <span className="mt-auto flex flex-wrap gap-1.5 border-t border-linea pt-2.5">
                  {suyos.slice(0, 4).map((x) => (
                    <span
                      key={x.codigo}
                      className="flex items-center gap-1.5 rounded-md bg-panel px-1.5 py-0.5 text-2xs text-gris"
                    >
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${
                          x.color === 'verde' ? 'bg-verde' : 'bg-amarillo'
                        }`}
                        aria-hidden
                      />
                      <span className="max-w-[11rem] truncate">{x.nombre}</span>
                    </span>
                  ))}
                  {suyos.length > 4 && (
                    <span className="cifra px-1 py-0.5 text-2xs text-gris-50">
                      +{suyos.length - 4}
                    </span>
                  )}
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
