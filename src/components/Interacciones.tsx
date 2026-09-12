import Link from 'next/link'
import { Vacio, Chip } from '@/components/ui'

/* ------------------------------------------------------------------
   Todo lo que se habló con un cliente, junto.

   Estaba repartido entre las novedades de cada proyecto, así que para
   saber en qué quedó una relación había que abrir cinco fichas. Esto es
   lo que uno quiere leer antes de una reunión.

   Hereda la RLS de la línea de tiempo, que ya filtra por tipo: lo
   comercial —precios tanteados, dudas del cliente— lo ven dirección, PM
   y vendedores, y nadie más. Un desarrollador que entre acá ve las
   entregas y no las conversaciones de precio.
   ------------------------------------------------------------------ */

export type Interaccion = {
  id: string
  ocurrido_at: string
  tipo: string
  canal: string
  texto: string
  quien: string | null
  proyecto_codigo: string
  proyecto: string
  era_oportunidad: boolean
}

const TIPO: Record<string, { texto: string; tono: 'azul' | 'verde' | 'violeta' | 'amarillo' }> = {
  entrega: { texto: 'Entrega', tono: 'azul' },
  comercial: { texto: 'Comercial', tono: 'violeta' },
  administrativo: { texto: 'Administrativo', tono: 'verde' },
  decision: { texto: 'Decisión', tono: 'amarillo' },
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export default function Interacciones({ filas }: { filas: Interaccion[] }) {
  if (filas.length === 0)
    return (
      <Vacio>
        Todavía no hay nada anotado con este cliente. Lo que se carga como novedad en cualquiera de
        sus proyectos aparece acá.
      </Vacio>
    )

  // Agrupado por mes: en una relación larga, la pregunta suele ser
  // "¿qué pasó en septiembre?" y no "¿qué fue lo número catorce?".
  const porMes = new Map<string, Interaccion[]>()
  for (const i of filas) {
    const k = i.ocurrido_at.slice(0, 7)
    const l = porMes.get(k) ?? []
    l.push(i)
    porMes.set(k, l)
  }

  return (
    <div className="flex flex-col gap-7">
      {[...porMes.entries()].map(([mes, items]) => (
        <div key={mes} className="flex flex-col gap-2.5">
          <h3 className="text-2xs font-medium uppercase tracking-wider text-gris-50">
            {MES[Number(mes.slice(5, 7)) - 1]} {mes.slice(0, 4)}
          </h3>

          <ul className="escalona flex flex-col gap-1.5">
            {items.map((i) => {
              const t = TIPO[i.tipo] ?? TIPO.entrega
              return (
                <li key={i.id} className="tarjeta flex flex-col gap-1.5 px-4 py-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="cifra text-2xs text-gris-50">
                      {i.ocurrido_at.slice(8, 10)}/{i.ocurrido_at.slice(5, 7)}
                    </span>
                    <Chip tono={t.tono}>{t.texto}</Chip>
                    {i.era_oportunidad && <Chip>oportunidad</Chip>}
                    <Link
                      href={`/proyecto/${i.proyecto_codigo}`}
                      className="truncate text-2xs text-gris-50 transition-colors duration-150
                                 hover:text-azul-hondo"
                    >
                      {i.proyecto}
                    </Link>
                  </span>

                  <p className="text-base leading-snug text-tinta">{i.texto}</p>

                  {i.quien && (
                    <span className="text-2xs text-gris-50">
                      {i.quien}
                      {i.canal !== 'nota' && ` · por ${i.canal}`}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
