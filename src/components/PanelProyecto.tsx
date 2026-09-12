import { plata, fechaCorta, SUBESTADO } from '@/lib/estados'

/* ------------------------------------------------------------------
   Lo primero que se ve al entrar a un proyecto. Responde de un vistazo
   en qué está, cuánto se hizo, cuándo entrega, cómo va el cobro del
   cliente y qué se le debe a cada uno.

   Va arriba de los campos editables a propósito: primero se entiende,
   después se toca.
   ------------------------------------------------------------------ */

const PUNTO: Record<string, string> = {
  verde: 'bg-verde',
  amarillo: 'bg-amarillo',
  gris: 'bg-gris-50',
  naranja: 'bg-naranja',
  rojo: 'bg-rojo',
}

const NOMBRE: Record<string, string> = {
  verde: 'En vivo',
  amarillo: 'A seguir',
  gris: 'Standby',
  naranja: 'Terminado',
  rojo: 'Perdido',
}

export type Entrega = {
  titulo: string
  monto: number
  entregado: boolean
  facturado: boolean
  cobrado: boolean
}

export type Rendicion = Map<
  string,
  { comprometido: number; devengado: number; a_liquidar: number; liquidado: number; moneda: string }
>

export default function PanelProyecto({
  color,
  detalle,
  diasSinNovedades,
  total,
  entregado,
  cobrado,
  moneda,
  proxima,
  fechaFinal,
  rendicion,
  esAbono,
  montoMensual,
  entregas,
}: {
  color: string
  detalle: string | null
  diasSinNovedades: number
  total: number
  entregado: number
  cobrado: number
  moneda: string
  proxima: { titulo: string; fecha: string | null } | null
  fechaFinal: string | null
  rendicion: Rendicion
  esAbono: boolean
  montoMensual: number | null
  entregas: Entrega[]
}) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
  const falta = total - cobrado

  const aLiquidar = [...rendicion.values()].reduce((a, f) => a + f.a_liquidar, 0)
  const conSaldo = [...rendicion.entries()]
    .filter(([, f]) => f.a_liquidar > 0 || f.devengado > 0)
    .sort((a, b) => b[1].a_liquidar - a[1].a_liquidar)

  return (
    <section className="flex flex-col gap-4 tarjeta p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Casillero titulo="Estado">
          <span className="flex items-center gap-2">
            <span className={`size-2.5 shrink-0 rounded-full ${PUNTO[color]}`} aria-hidden />
            <span className="text-lg font-bold text-tinta">{NOMBRE[color]}</span>
          </span>
          <Pie>
            {detalle ? SUBESTADO[detalle] ?? detalle : '—'}
            {diasSinNovedades > 0 && (
              <span className={diasSinNovedades > 7 ? ' font-bold text-rojo' : ''}>
                {' · '}
                {diasSinNovedades} {diasSinNovedades === 1 ? 'día' : 'días'} sin novedades
              </span>
            )}
          </Pie>
        </Casillero>

        <Casillero titulo={esAbono ? 'Abono mensual' : 'Avance'}>
          {esAbono ? (
            <span className="cifra text-lg font-bold text-tinta">
              {plata(montoMensual, moneda)}
            </span>
          ) : (
            <span className="flex items-baseline gap-2">
              <span className="cifra text-2xl font-bold text-tinta">{pct(entregado)} %</span>
              <span className="cifra text-sm text-verde">{pct(cobrado)} % cobrado</span>
            </span>
          )}
          {!esAbono && total > 0 && (
            <span className="mt-1.5 flex h-1.5 gap-px overflow-hidden rounded-sm bg-panel">
              <span style={{ width: `${pct(cobrado)}%`, background: 'var(--color-verde)' }} />
              <span
                style={{
                  width: `${pct(entregado) - pct(cobrado)}%`,
                  background: 'var(--color-serie-1)',
                }}
              />
            </span>
          )}
          <Pie>{esAbono ? 'por mes, mientras esté vigente' : 'entregado, sobre plata'}</Pie>
        </Casillero>

        <Casillero titulo={proxima ? 'Próxima entrega' : 'Entrega comprometida'}>
          <span className="cifra text-lg font-bold text-tinta">
            {fechaCorta(proxima?.fecha ?? fechaFinal) ?? (
              <span className="text-rojo">sin fecha</span>
            )}
          </span>
          <Pie>{proxima?.titulo ?? (total > 0 ? 'todas entregadas' : 'sin entregas cargadas')}</Pie>
        </Casillero>

        <Casillero titulo="Del cliente">
          <span className="cifra text-lg font-bold text-tinta">{plata(cobrado, moneda)}</span>
          <Pie>
            cobrado de {plata(total, moneda)}
            {falta > 0 && <span className="font-bold text-rojo"> · faltan {plata(falta, moneda)}</span>}
          </Pie>
        </Casillero>
      </div>

      {entregas.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-linea pt-3.5">
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
              Las entregas
            </span>
            <span className="cifra text-2xs text-gris-50">
              {entregas.filter((e) => e.cobrado).length} de {entregas.length} cobradas
            </span>
          </span>

          {/* Cada entrega ocupa lo que pesa en plata, no lo mismo que las
              demás: una de la mitad del proyecto tiene que verse la mitad
              de la barra. Entregado, facturado y cobrado son tres hechos
              distintos y se apilan, porque acá casi nunca coinciden. */}
          <ul className="flex gap-0.5" aria-label="Estado de cada entrega">
            {entregas.map((e, i) => (
              <li
                key={i}
                title={`${e.titulo} — ${
                  e.cobrado ? 'cobrada' : e.facturado ? 'facturada' : e.entregado ? 'entregada' : 'pendiente'
                }`}
                style={{ flexGrow: Math.max(e.monto, 1) }}
                className="flex min-w-0 flex-col gap-1"
              >
                <span
                  className={`h-1.5 rounded-sm ${
                    e.cobrado ? 'bg-verde' : e.facturado ? 'bg-azul' : e.entregado ? 'bg-azul-50' : 'bg-panel'
                  }`}
                />
                <span className="truncate text-[10px] leading-tight text-gris-50">{e.titulo}</span>
              </li>
            ))}
          </ul>

          <p className="flex flex-wrap gap-x-4 text-2xs text-gris-50">
            <Punto clase="bg-azul-50">entregada</Punto>
            <Punto clase="bg-azul">facturada</Punto>
            <Punto clase="bg-verde">cobrada</Punto>
          </p>
        </div>
      )}

      {conSaldo.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-linea pt-3.5">
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
              Pagos a cada uno
            </span>
            {aLiquidar > 0 && (
              <span className="cifra text-2xs text-azul-hondo">
                {plata(aLiquidar, moneda)} listos para transferir
              </span>
            )}
          </span>

          <ul className="flex flex-wrap gap-x-8 gap-y-2">
            {conSaldo.map(([quien, f]) => (
              <li key={quien} className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-tinta">{quien}</span>
                <span className="cifra flex flex-wrap gap-x-3 text-2xs">
                  {f.a_liquidar > 0 && (
                    <span className="font-bold text-azul-hondo">
                      {plata(f.a_liquidar, f.moneda)} a liquidar
                    </span>
                  )}
                  {f.devengado > 0 && (
                    <span className="text-amarillo">{plata(f.devengado, f.moneda)} devengado</span>
                  )}
                  {f.liquidado > 0 && (
                    <span className="text-verde">{plata(f.liquidado, f.moneda)} ya pagado</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-2xs text-gris-50">
            A liquidar es plata del cliente que ya entró y todavía no se transfirió. Devengado se
            ganó pero no entró.
          </p>
        </div>
      )}
    </section>
  )
}

function Casillero({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">{titulo}</span>
      {children}
    </div>
  )
}

function Pie({ children }: { children: React.ReactNode }) {
  return <span className="text-2xs leading-snug text-gris-50">{children}</span>
}

function Punto({ clase, children }: { clase: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 shrink-0 rounded-sm ${clase}`} aria-hidden />
      {children}
    </span>
  )
}
