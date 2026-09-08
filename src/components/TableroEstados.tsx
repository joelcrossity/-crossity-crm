'use client'

import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cambiarEstado } from '@/app/acciones'
import { SUBESTADO, fechaCorta } from '@/lib/estados'
import type { Fila } from '@/components/TablaProyectos'

/* ------------------------------------------------------------------
   Los proyectos como tablero, y arrastrables.

   Arrastrar de "En vivo" a "Terminado" cambia el proyecto de verdad: no
   es una vista aparte, es el mismo dato que ve todo el mundo.

   Lo único que no se resuelve arrastrando es el porqué. Standby y
   Perdido exigen un motivo —la base lo exige, y con razón: "se frenó"
   sin decir si lo pausó el cliente o si se durmió no sirve para nada
   dentro de tres meses—. Así que al soltar ahí se pregunta, en el
   lugar donde se soltó, y recién después se guarda.
   ------------------------------------------------------------------ */

const COLUMNAS: {
  color: string
  texto: string
  ayuda: string
  punto: string
  motivos?: { valor: string; texto: string }[]
  porDefecto?: string
}[] = [
  {
    color: 'verde',
    texto: 'En vivo',
    ayuda: 'se trabaja ahora',
    punto: 'bg-verde',
    porDefecto: 'en_curso',
  },
  { color: 'amarillo', texto: 'A seguir', ayuda: 'la pelota está del otro lado', punto: 'bg-amarillo' },
  {
    color: 'gris',
    texto: 'Standby',
    ayuda: 'ni muerto ni vivo',
    punto: 'bg-gris-50',
    motivos: [
      { valor: 'pausado_cliente', texto: 'Lo pausó el cliente' },
      { valor: 'esperando_anticipo', texto: 'Esperando el anticipo' },
      { valor: 'dormido', texto: 'Se durmió' },
      { valor: 'no_se_dio', texto: 'No se dio' },
    ],
  },
  { color: 'naranja', texto: 'Terminado', ayuda: 'no hay más que hacer', punto: 'bg-naranja' },
  {
    color: 'rojo',
    texto: 'Perdido',
    ayuda: 'salió mal o se descartó',
    punto: 'bg-rojo',
    motivos: [
      { valor: 'perdido', texto: 'Lo perdimos' },
      { valor: 'descartado', texto: 'Lo descartamos' },
      { valor: 'entregado', texto: 'Se entregó y se cerró' },
    ],
  },
]

export default function TableroEstados({ filas }: { filas: Fila[] }) {
  const router = useRouter()
  const [, empezar] = useTransition()
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [encima, setEncima] = useState<string | null>(null)
  const [preguntando, setPreguntando] = useState<{ id: string; color: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [vista, mover] = useOptimistic(
    filas,
    (actual: Fila[], c: { id: string; color: string; detalle: string | null }) =>
      actual.map((f) =>
        f.id === c.id
          ? { ...f, color: c.color, subestado: c.color === 'verde' ? c.detalle : null }
          : f,
      ),
  )

  function guardar(id: string, color: string, detalle: string | null) {
    setPreguntando(null)
    setError(null)
    empezar(async () => {
      mover({ id, color, detalle })
      const r = await cambiarEstado(id, color, detalle)
      if (!r.ok) setError(r.error)
      router.refresh()
    })
  }

  function soltar(columna: (typeof COLUMNAS)[number]) {
    const id = arrastrando
    setArrastrando(null)
    setEncima(null)
    if (!id) return

    const f = vista.find((x) => x.id === id)
    if (!f || f.color === columna.color) return

    // Donde hace falta un porqué, se pregunta antes de tocar nada.
    if (columna.motivos) setPreguntando({ id, color: columna.color })
    else guardar(id, columna.color, columna.porDefecto ?? null)
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="surge rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      <div className="riel -mx-5 flex gap-3 overflow-x-auto px-5 pb-3 lg:-mx-10 lg:px-10">
        {COLUMNAS.map((c) => {
          const suyas = vista.filter((f) => f.color === c.color)
          const frenados = suyas.filter((f) => f.dias_sin_novedades > 7).length
          const objetivo = encima === c.color && arrastrando !== null
          const pregunta = preguntando?.color === c.color ? preguntando : null

          return (
            <section
              key={c.color}
              onDragOver={(e) => {
                e.preventDefault()
                setEncima(c.color)
              }}
              onDragLeave={() => setEncima((v) => (v === c.color ? null : v))}
              onDrop={() => soltar(c)}
              className={`flex w-[16.5rem] shrink-0 flex-col gap-2.5 rounded-lg border p-2.5
                          transition-colors duration-200 [scroll-snap-align:start] ${
                            objetivo ? 'border-azul bg-azul-aire' : 'border-linea bg-panel'
                          }`}
            >
              <header className="flex flex-col gap-0.5 px-1 pt-0.5">
                <span className="flex items-baseline gap-2">
                  <span className={`size-2 shrink-0 rounded-full ${c.punto}`} aria-hidden />
                  <h2 className="text-sm font-bold tracking-tight text-tinta">{c.texto}</h2>
                  <span className="cifra ml-auto text-2xs text-gris-50">{suyas.length}</span>
                </span>
                <span className="text-2xs text-gris-50">
                  {c.color === 'verde' && frenados > 0 ? (
                    <span className="font-medium text-rojo">
                      {frenados} sin novedades hace una semana
                    </span>
                  ) : (
                    c.ayuda
                  )}
                </span>
              </header>

              {pregunta && (
                <div className="surge flex flex-col gap-2 rounded-md border border-azul bg-superficie p-2.5">
                  <span className="text-2xs font-medium text-tinta">¿Por qué?</span>
                  <div className="flex flex-col gap-1">
                    {c.motivos!.map((m) => (
                      <button
                        key={m.valor}
                        type="button"
                        onClick={() => guardar(pregunta.id, c.color, m.valor)}
                        className="rounded-md border border-linea px-2 py-1 text-left text-2xs
                                   text-gris transition-colors duration-150
                                   hover:border-azul hover:text-azul-hondo"
                      >
                        {m.texto}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreguntando(null)}
                    className="text-2xs text-gris-50 hover:text-tinta"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              <ul className="escalona flex flex-col gap-2">
                {suyas.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/proyecto/${f.codigo}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', f.id)
                        setArrastrando(f.id)
                      }}
                      onDragEnd={() => {
                        setArrastrando(null)
                        setEncima(null)
                      }}
                      className={`flex cursor-grab flex-col gap-2 rounded-md border border-linea
                                  bg-superficie p-3 transition-[border-color,box-shadow,opacity]
                                  duration-150 hover:border-azul
                                  hover:shadow-[0_2px_8px_-4px_oklch(0.232_0.003_106/0.25)]
                                  active:cursor-grabbing ${
                                    arrastrando === f.id ? 'opacity-40' : ''
                                  }`}
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold leading-snug tracking-tight text-tinta">
                          {f.nombre}
                        </span>
                        <span className="truncate text-2xs text-gris-50">{f.cliente}</span>
                      </span>

                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xs">
                        {f.subestado && (
                          <span className="text-gris">{SUBESTADO[f.subestado] ?? f.subestado}</span>
                        )}
                        {f.fecha_comprometida && (
                          <span className="cifra text-gris-50">
                            {fechaCorta(f.fecha_comprometida)}
                          </span>
                        )}
                      </span>

                      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-2xs">
                        <span className={f.responsable ? 'text-gris' : 'text-amarillo'}>
                          {f.responsable ?? 'sin responsable'}
                        </span>
                        {f.color === 'verde' && f.dias_sin_novedades > 7 && (
                          <span className="cifra shrink-0 font-medium text-rojo">
                            {f.dias_sin_novedades} d
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}

                {suyas.length === 0 && (
                  <li
                    className={`rounded-md border border-dashed px-3 py-6 text-center text-2xs
                                transition-colors duration-200 ${
                                  objetivo
                                    ? 'border-azul text-azul-hondo'
                                    : 'border-linea-fuerte text-gris-50'
                                }`}
                  >
                    {objetivo ? 'Soltalo acá' : 'Ninguno'}
                  </li>
                )}
              </ul>
            </section>
          )
        })}
      </div>

      <p className="text-2xs text-gris-50">
        Se arrastra entre columnas y el cambio impacta en el proyecto. Standby y Perdido preguntan
        el motivo: sin él, dentro de tres meses nadie sabe por qué se frenó.
      </p>
    </div>
  )
}
