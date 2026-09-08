import Link from 'next/link'
import { plata } from '@/lib/estados'

/* ------------------------------------------------------------------
   Gráficos en SVG, sin librerías. Marcas finas, grilla recesiva,
   etiquetas directas donde aportan. Un solo eje siempre.

   Cuando no hay datos lo dicen: un eje vacío miente peor que un texto.
   ------------------------------------------------------------------ */

export function Marco({
  titulo,
  detalle,
  vacio,
  hayDatos,
  children,
  pie,
}: {
  titulo: string
  detalle?: string
  vacio: string
  hayDatos: boolean
  children: React.ReactNode
  pie?: React.ReactNode
}) {
  return (
    <figure className="flex flex-col gap-3 rounded-lg border border-linea bg-superficie p-4">
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-base font-bold text-tinta">{titulo}</span>
        {detalle && <span className="text-2xs text-gris-50">{detalle}</span>}
      </figcaption>
      {hayDatos ? (
        children
      ) : (
        <p className="py-6 text-center text-sm text-gris-50">{vacio}</p>
      )}
      {hayDatos && pie}
    </figure>
  )
}

/* Barras horizontales: para comparar magnitudes entre entidades con
   nombre largo. La etiqueta va afuera, siempre legible. */
export function Barras({
  datos,
  moneda = 'ARS',
  serie = 1,
  sufijo,
}: {
  datos: { nombre: string; valor: number; nota?: string }[]
  moneda?: string
  serie?: 1 | 2 | 3 | 4
  sufijo?: string
}) {
  const max = Math.max(...datos.map((d) => d.valor), 1)
  const color = `var(--color-serie-${serie})`

  return (
    <ul className="flex flex-col gap-2.5">
      {datos.map((d) => {
        const ancho = Math.max((d.valor / max) * 100, 1.5)
        return (
          <li key={d.nombre} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-tinta">{d.nombre}</span>
              <span className="cifra shrink-0 text-sm font-bold text-tinta">
                {sufijo ? `${d.valor} ${sufijo}` : plata(d.valor, moneda)}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 flex-1 overflow-hidden rounded-sm bg-panel">
                <span
                  className="block h-full rounded-sm"
                  style={{ width: `${ancho}%`, background: color }}
                  title={`${d.nombre}: ${sufijo ? d.valor + ' ' + sufijo : plata(d.valor, moneda)}`}
                />
              </span>
              {d.nota && <span className="shrink-0 text-2xs text-gris-50">{d.nota}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/* Columnas por mes: cambio en el tiempo, dos series apiladas con
   separación de 2 px entre segmentos para que se lean como distintas. */
export function Columnas({
  meses,
  moneda = 'ARS',
}: {
  meses: { mes: string; facturado: number; cobrado: number }[]
  moneda?: string
}) {
  const max = Math.max(...meses.map((m) => Math.max(m.facturado, m.cobrado)), 1)
  const alto = 132

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1.5" style={{ height: alto }}>
        {meses.map((m) => (
          <div key={m.mes} className="flex flex-1 items-end justify-center gap-0.5">
            <span
              className="w-1/2 rounded-t-sm"
              style={{
                height: `${Math.max((m.facturado / max) * alto, m.facturado > 0 ? 3 : 0)}px`,
                background: 'var(--color-serie-1)',
              }}
              title={`${m.mes} · facturado ${plata(m.facturado, moneda)}`}
            />
            <span
              className="w-1/2 rounded-t-sm"
              style={{
                height: `${Math.max((m.cobrado / max) * alto, m.cobrado > 0 ? 3 : 0)}px`,
                background: 'var(--color-serie-2)',
              }}
              title={`${m.mes} · cobrado ${plata(m.cobrado, moneda)}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 border-t border-linea pt-1.5">
        {meses.map((m) => (
          <span key={m.mes} className="flex-1 text-center text-2xs text-gris-50">
            {m.mes}
          </span>
        ))}
      </div>
      <Leyenda
        items={[
          { texto: 'facturado', serie: 1 },
          { texto: 'cobrado', serie: 2 },
        ]}
      />
    </div>
  )
}

/* Embudo: cada etapa con su cuenta y su valor. El ancho comunica
   cuántas quedan; el número, cuánto valen. */
export function Embudo({
  etapas,
}: {
  etapas: { etapa: string; cantidad: number; valor: number; moneda: string }[]
}) {
  const max = Math.max(...etapas.map((e) => e.cantidad), 1)

  return (
    <ul className="flex flex-col gap-1.5">
      {etapas.map((e, i) => (
        <li key={e.etapa} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-sm text-tinta">{e.etapa}</span>
          <span className="h-6 flex-1 overflow-hidden rounded-sm bg-panel">
            <span
              className="flex h-full items-center rounded-sm px-2"
              style={{
                width: `${Math.max((e.cantidad / max) * 100, 8)}%`,
                background: `var(--color-serie-${((i % 4) + 1) as 1 | 2 | 3 | 4})`,
              }}
              title={`${e.etapa}: ${e.cantidad} oportunidades`}
            >
              <span className="cifra text-2xs font-bold text-white">{e.cantidad}</span>
            </span>
          </span>
          <span className="cifra w-24 shrink-0 text-right text-sm text-gris">
            {e.valor > 0 ? plata(e.valor, e.moneda) : '—'}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function Leyenda({ items }: { items: { texto: string; serie: 1 | 2 | 3 | 4 }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <li key={i.texto} className="flex items-center gap-1.5 text-2xs text-gris">
          <span
            className="size-2 shrink-0 rounded-xs"
            style={{ background: `var(--color-serie-${i.serie})` }}
            aria-hidden
          />
          {i.texto}
        </li>
      ))}
    </ul>
  )
}

/* Un número solo, cuando el gráfico sobra. */
export function Cifra({
  valor,
  titulo,
  nota,
  tono = 'tinta',
  href,
}: {
  valor: string
  titulo: string
  nota?: string
  tono?: 'tinta' | 'verde' | 'rojo' | 'amarillo'
  /* Un número que cuenta algo tiene que llevar a lo que cuenta.
     Si no, obliga a buscar a mano lo que la pantalla ya encontró. */
  href?: string
}) {
  const color = {
    tinta: 'text-tinta',
    verde: 'text-verde',
    rojo: 'text-rojo',
    amarillo: 'text-amarillo',
  }[tono]

  const cuerpo = (
    <>
      <span className={`cifra text-xl font-bold ${color}`}>{valor}</span>
      <span className="text-sm font-medium text-tinta">{titulo}</span>
      {nota && <span className="text-2xs text-gris-50">{nota}</span>}
    </>
  )

  if (!href) return <div className="flex flex-col gap-0.5">{cuerpo}</div>

  return (
    <Link
      href={href}
      className="-m-2 flex flex-col gap-0.5 rounded-md p-2 transition-colors duration-150
                 hover:bg-panel"
    >
      {cuerpo}
    </Link>
  )
}
