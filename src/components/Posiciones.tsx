import Link from 'next/link'
import { plata } from '@/lib/estados'

/* ------------------------------------------------------------------
   El estado de resultado de cada proyecto.

   Acordado, entregado, facturado y cobrado son cuatro hechos distintos.
   Verlos juntos es la única forma de notar dónde se traba: si entregado
   va muy por delante de facturado, el problema es administrativo; si
   facturado va por delante de cobrado, el problema es el cliente.
   ------------------------------------------------------------------ */

export type Posicion = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  color: string
  tipo: string
  moneda: string
  acordado: number
  entregado: number
  facturado: number
  cobrado: number
  gastos: number
  impuestos: number
  para_terceros: number
  para_crossity: number
  a_transferir: number
}

export default function Posiciones({ filas }: { filas: Posicion[] }) {
  const vivos = filas.filter((f) => f.color === 'verde' && Number(f.acordado) > 0)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight">Cómo está parado cada proyecto</h2>
        <p className="max-w-[70ch] text-sm text-gris">
          Si lo entregado va muy por delante de lo facturado, el problema es nuestro. Si lo
          facturado va por delante de lo cobrado, el problema es del cliente. Son dos conversaciones
          distintas.
        </p>
      </div>

      {vivos.length === 0 ? (
        <p className="tarjeta px-3.5 py-3 text-sm text-gris">
          No hay proyectos en vivo con monto cargado.
        </p>
      ) : (
        <ul className="escalona flex flex-col gap-2">
          {vivos.map((f) => {
            const acordado = Number(f.acordado)
            const pct = (n: number) => (acordado > 0 ? Math.min(100, (n / acordado) * 100) : 0)
            const queda = Number(f.para_crossity) - Number(f.gastos) - Number(f.impuestos)

            return (
              <li key={f.id}>
                <Link
                  href={`/proyecto/${f.codigo}`}
                  className="flex flex-col gap-2 tarjeta p-3.5
                             transition-colors duration-150 hover:border-azul"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium text-tinta">
                        {f.nombre}
                      </span>
                      <span className="cifra block truncate text-2xs text-gris-50">{f.cliente}</span>
                    </span>
                    <span className="cifra shrink-0 text-sm font-bold text-tinta">
                      {plata(acordado, f.moneda)}
                    </span>
                  </span>

                  {/* Tres barras superpuestas, de la más avanzada a la
                      menos: el hueco entre ellas ES el problema. */}
                  <span className="relative flex h-2 overflow-hidden rounded-sm bg-panel" aria-hidden>
                    <span
                      className="absolute inset-y-0 left-0 transition-[width] duration-500"
                      style={{ width: `${pct(Number(f.entregado))}%`, background: 'var(--color-azul-50)' }}
                    />
                    <span
                      className="absolute inset-y-0 left-0 transition-[width] duration-500"
                      style={{ width: `${pct(Number(f.facturado))}%`, background: 'var(--color-serie-1)' }}
                    />
                    <span
                      className="absolute inset-y-0 left-0 transition-[width] duration-500"
                      style={{ width: `${pct(Number(f.cobrado))}%`, background: 'var(--color-verde)' }}
                    />
                  </span>

                  <span className="cifra flex flex-wrap gap-x-4 gap-y-0.5 text-2xs">
                    <Dato titulo="entregado" valor={plata(f.entregado, f.moneda)} tono="text-azul-50" />
                    <Dato titulo="facturado" valor={plata(f.facturado, f.moneda)} tono="text-azul-hondo" />
                    <Dato titulo="cobrado" valor={plata(f.cobrado, f.moneda)} tono="text-verde" />
                    {Number(f.gastos) > 0 && (
                      <Dato titulo="gastos" valor={plata(f.gastos, f.moneda)} tono="text-naranja" />
                    )}
                    {Number(f.para_terceros) > 0 && (
                      <Dato titulo="a terceros" valor={plata(f.para_terceros, f.moneda)} tono="text-gris" />
                    )}
                    <Dato
                      titulo="queda para Crossity"
                      valor={plata(queda, f.moneda)}
                      tono={queda < 0 ? 'text-rojo' : 'text-tinta'}
                    />
                  </span>

                  {Number(f.a_transferir) > 0 && (
                    <span className="text-2xs font-medium text-azul-hondo">
                      {plata(f.a_transferir, f.moneda)} listos para transferir
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Dato({ titulo, valor, tono }: { titulo: string; valor: string; tono: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-gris-50">{titulo}</span>
      <span className={`font-medium ${tono}`}>{valor}</span>
    </span>
  )
}
