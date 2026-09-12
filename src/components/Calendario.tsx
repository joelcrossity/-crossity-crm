'use client'

import { useState } from 'react'
import Link from 'next/link'
import { plata } from '@/lib/estados'

/* ------------------------------------------------------------------
   La agenda.

   SUINO tiene tres pantallas: cronograma de pagos, cheques y
   vencimientos. Con su volumen está bien. Acá conviene al revés: el
   problema nunca fue tener muchos vencimientos, fue tenerlos repartidos
   en la cabeza de una sola persona.

   Cuatro cosas tienen fecha y hasta hoy no estaban juntas en ningún
   lado: qué entregar, qué nos deben, qué cheque se cobra y a quién hay
   que transferirle.
   ------------------------------------------------------------------ */

export type Evento = {
  clave: string
  clase: string
  fecha: string
  titulo: string
  proyecto: string
  codigo: string | null
  cliente: string
  monto: number | null
  moneda: string
  vencido: boolean
}

const CLASES: Record<string, { texto: string; punto: string; tinta: string }> = {
  entrega: { texto: 'Entrega', punto: 'bg-serie-1', tinta: 'text-azul-hondo' },
  cobro:   { texto: 'Cobro',   punto: 'bg-verde',   tinta: 'text-verde' },
  cheque:  { texto: 'Cheque',  punto: 'bg-serie-3', tinta: 'text-violeta-50' },
  pago:    { texto: 'Pago',    punto: 'bg-serie-4', tinta: 'text-naranja' },
}

const DIAS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/* Se compara en texto ISO y no con Date: una fecha sin hora comparada
   como Date se corre un día según la zona horaria, y en una agenda un
   día de corrimiento es un vencimiento perdido. */
function clave(a: number, m: number, d: number) {
  return `${a}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function Calendario({ eventos, hoy }: { eventos: Evento[]; hoy: string }) {
  const [a0, m0] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1]
  const [mes, setMes] = useState({ a: a0, m: m0 })
  const [clases, setClases] = useState<string[]>([])
  const [dia, setDia] = useState<string | null>(null)

  const visibles = clases.length === 0 ? eventos : eventos.filter((e) => clases.includes(e.clase))

  const porDia = new Map<string, Evento[]>()
  for (const e of visibles) {
    const l = porDia.get(e.fecha) ?? []
    l.push(e)
    porDia.set(e.fecha, l)
  }

  const primero = new Date(Date.UTC(mes.a, mes.m, 1))
  const arranque = (primero.getUTCDay() + 6) % 7 // la semana empieza el lunes
  const largo = new Date(Date.UTC(mes.a, mes.m + 1, 0)).getUTCDate()
  const celdas = [
    ...Array.from({ length: arranque }, () => null),
    ...Array.from({ length: largo }, (_, i) => i + 1),
  ]

  function mover(n: number) {
    setDia(null)
    setMes((v) => {
      const m = v.m + n
      return { a: v.a + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    })
  }

  const delDia = dia ? (porDia.get(dia) ?? []) : []
  const atrasados = visibles
    .filter((e) => e.vencido)
    .sort((x, y) => x.fecha.localeCompare(y.fecha))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Flecha alClic={() => mover(-1)} lado="izq" />
          <span className="min-w-44 text-center text-md font-bold tracking-tight text-tinta">
            {MESES[mes.m]} {mes.a}
          </span>
          <Flecha alClic={() => mover(1)} lado="der" />
          <button
            type="button"
            onClick={() => {
              setMes({ a: a0, m: m0 })
              setDia(null)
            }}
            className="ml-1.5 rounded-md border border-linea px-2 py-1 text-2xs text-gris
                       transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
          >
            Hoy
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(CLASES).map(([valor, c]) => {
            const puesto = clases.includes(valor)
            return (
              <button
                key={valor}
                type="button"
                aria-pressed={puesto}
                onClick={() =>
                  setClases((v) => (v.includes(valor) ? v.filter((x) => x !== valor) : [...v, valor]))
                }
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-2xs
                            transition-colors duration-150 ${
                              puesto
                                ? 'border-azul bg-azul-aire font-medium text-azul-hondo'
                                : 'border-linea text-gris hover:border-linea-fuerte'
                            }`}
              >
                <span className={`size-1.5 rounded-full ${c.punto}`} aria-hidden />
                {c.texto}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-linea bg-linea">
        {DIAS.map((d) => (
          <span
            key={d}
            className="bg-panel px-2 py-1.5 text-center text-2xs font-medium uppercase tracking-wider text-gris-50"
          >
            {d}
          </span>
        ))}

        {celdas.map((n, i) => {
          if (n === null) return <span key={`v${i}`} className="min-h-20 bg-panel/60" />
          const k = clave(mes.a, mes.m, n)
          const suyos = porDia.get(k) ?? []
          const esHoy = k === hoy
          const elegido = k === dia

          return (
            <button
              key={k}
              type="button"
              onClick={() => setDia(elegido ? null : k)}
              className={`flex min-h-20 flex-col gap-1 p-1.5 text-left transition-colors duration-150 ${
                elegido ? 'bg-azul-aire' : 'bg-superficie hover:bg-panel'
              }`}
            >
              <span
                className={`cifra text-2xs ${
                  esHoy
                    ? 'grid size-5 place-items-center rounded-full bg-azul-hondo font-bold text-white'
                    : suyos.length > 0
                      ? 'font-medium text-tinta'
                      : 'text-gris-50'
                }`}
              >
                {n}
              </span>

              <span className="flex flex-col gap-0.5">
                {suyos.slice(0, 3).map((e) => (
                  <span key={e.clave} className="flex items-center gap-1">
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${
                        e.vencido ? 'bg-rojo' : CLASES[e.clase].punto
                      }`}
                      aria-hidden
                    />
                    <span className="truncate text-[10px] leading-tight text-gris">{e.titulo}</span>
                  </span>
                ))}
                {suyos.length > 3 && (
                  <span className="cifra pl-2.5 text-[10px] text-gris-50">
                    +{suyos.length - 3}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {dia && (
        <Bloque
          titulo={`${Number(dia.slice(8))} de ${MESES[Number(dia.slice(5, 7)) - 1]}`}
          eventos={delDia}
          vacio="Nada agendado ese día."
        />
      )}

      {atrasados.length > 0 && (
        <Bloque
          titulo="Ya pasaron"
          ayuda="Vencieron y siguen abiertos. No se van solos."
          eventos={atrasados}
          vacio=""
        />
      )}
    </div>
  )
}

function Bloque({
  titulo,
  ayuda,
  eventos,
  vacio,
}: {
  titulo: string
  ayuda?: string
  eventos: Evento[]
  vacio: string
}) {
  return (
    <section className="surge flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-md font-bold tracking-tight">{titulo}</h2>
        <span className="cifra text-2xs text-gris-50">{eventos.length}</span>
        {ayuda && <p className="w-full max-w-[65ch] text-sm text-gris">{ayuda}</p>}
      </div>

      {eventos.length === 0 ? (
        <p className="tarjeta px-3.5 py-3 text-sm text-gris">
          {vacio}
        </p>
      ) : (
        <ul className="escalona flex flex-col gap-1.5">
          {eventos.map((e) => {
            const c = CLASES[e.clase]
            const cuerpo = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`text-2xs font-medium uppercase tracking-wider ${c.tinta}`}>
                      {c.texto}
                    </span>
                    {e.vencido && (
                      <span className="text-2xs font-medium text-rojo">vencido</span>
                    )}
                  </span>
                  <span className="block truncate text-base font-medium text-tinta">{e.titulo}</span>
                  <span className="cifra block truncate text-2xs text-gris-50">
                    {e.cliente}
                    {e.proyecto !== '—' && ` · ${e.proyecto}`}
                  </span>
                </span>
                <span className="cifra shrink-0 text-right text-sm font-medium text-tinta">
                  {e.monto !== null ? plata(e.monto, e.moneda) : ''}
                  <span className="block text-2xs font-normal text-gris-50">
                    {e.fecha.slice(8)}/{e.fecha.slice(5, 7)}
                  </span>
                </span>
              </>
            )
            const clase =
              'flex items-baseline gap-4 rounded-lg border bg-superficie px-3.5 py-2.5 ' +
              `transition-colors duration-150 ${e.vencido ? 'border-rojo/40' : 'border-linea'}`

            return (
              <li key={e.clave}>
                {e.codigo ? (
                  <Link href={`/proyecto/${e.codigo}`} className={`${clase} hover:border-azul`}>
                    {cuerpo}
                  </Link>
                ) : (
                  <span className={clase}>{cuerpo}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Flecha({ alClic, lado }: { alClic: () => void; lado: 'izq' | 'der' }) {
  return (
    <button
      type="button"
      onClick={alClic}
      aria-label={lado === 'izq' ? 'Mes anterior' : 'Mes siguiente'}
      className="grid size-7 place-items-center rounded-md border border-linea text-gris
                 transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
        <path
          d={lado === 'izq' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
