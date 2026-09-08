import { plata } from '@/lib/estados'

/* ------------------------------------------------------------------
   El cashflow.

   Todo lo demás en el sistema mira el pasado. Esto mira los seis meses
   que vienen, que es sobre lo que hay que decidir. Más allá de seis es
   adivinar.

   Todo llevado a pesos con la cotización de hoy: un cashflow con tres
   monedas mezcladas no se lee.
   ------------------------------------------------------------------ */

export type Mes = {
  mes: string
  por_cobrar: number
  cheques: number
  abonos: number
  a_transferir: number
  costos_fijos: number
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export default function Cashflow({ meses }: { meses: Mes[] }) {
  const filas = meses.map((m) => {
    const entra = Number(m.por_cobrar) + Number(m.cheques) + Number(m.abonos)
    const sale = Number(m.a_transferir) + Number(m.costos_fijos)
    return { ...m, entra, sale, neto: entra - sale }
  })

  const tope = Math.max(1, ...filas.map((f) => Math.max(f.entra, f.sale)))

  /* El acumulado se calcula antes de dibujar. Ir sumándolo dentro del
     map funciona una vez y falla en cuanto React re-renderice. */
  const conAcumulado = filas.reduce<(typeof filas[number] & { acumulado: number })[]>(
    (lista, f) => [
      ...lista,
      { ...f, acumulado: (lista.at(-1)?.acumulado ?? 0) + f.neto },
    ],
    [],
  )

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight">Cómo viene la caja</h2>
        <p className="max-w-[70ch] text-sm text-gris">
          Seis meses hacia adelante. Entra lo comprometido —cobros que vencen, cheques y abonos— y
          sale lo que hay que transferir más los costos fijos. Todo en pesos a la cotización de hoy.
        </p>
      </div>

      <ul className="flex flex-col gap-0">
        {conAcumulado.map((f, i) => {
          const mes = Number(f.mes.slice(5, 7)) - 1
          return (
            <li
              key={f.mes}
              className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 border-b border-linea py-2.5
                         last:border-b-0"
            >
              <span className="cifra text-2xs font-medium uppercase tracking-wider text-gris-50">
                {MESES[mes]} {f.mes.slice(2, 4)}
              </span>

              {/* Dos barras opuestas: entra arriba, sale abajo. Lo que
                  importa no es cada una sino cuál es más larga. */}
              <span className="flex flex-col gap-0.5" aria-hidden>
                <span className="flex h-2 items-center">
                  <span
                    className="h-full rounded-r-sm"
                    style={{ width: `${(f.entra / tope) * 100}%`, background: 'var(--color-verde)' }}
                  />
                </span>
                <span className="flex h-2 items-center">
                  <span
                    className="h-full rounded-r-sm"
                    style={{ width: `${(f.sale / tope) * 100}%`, background: 'var(--color-serie-4)' }}
                  />
                </span>
              </span>

              <span className="flex flex-col items-end gap-0 text-right">
                <span
                  className={`cifra text-sm font-bold ${
                    f.neto < 0 ? 'text-rojo' : 'text-tinta'
                  }`}
                >
                  {f.neto >= 0 ? '+' : ''}
                  {plata(f.neto)}
                </span>
                <span className="cifra text-2xs text-gris-50">
                  {plata(f.entra)} · {plata(f.sale)}
                  {i > 0 && (
                    <span className={f.acumulado < 0 ? 'font-medium text-rojo' : ''}>
                      {' '}· acum. {plata(f.acumulado)}
                    </span>
                  )}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <p className="flex flex-wrap gap-x-4 text-2xs text-gris-50">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-verde" aria-hidden /> entra
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ background: 'var(--color-serie-4)' }} aria-hidden />
          sale
        </span>
        <span>
          Los cobros sin fecha de vencimiento no aparecen: cargales el “vence” en la entrega.
        </span>
      </p>
    </section>
  )
}
