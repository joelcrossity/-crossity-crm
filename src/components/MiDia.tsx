'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plegable, Chip } from '@/components/ui'
import { fechaCorta } from '@/lib/estados'

/* ------------------------------------------------------------------
   Lo que le queda por hacer a alguien.

   Dos modos, y el que importa es el primero. "Mi día" muestra tres
   cosas: las tres que más urgen. Una lista de cuarenta pendientes no
   ayuda a decidir por dónde empezar — se lee, se cierra, y se vuelve a
   trabajar por lo que uno ya tenía en la cabeza.

   El orden no es por fecha: primero lo vencido, después lo de esta
   semana, y lo trabado va al final aunque esté vencido. Eso último es
   deliberado: si algo espera un anticipo del cliente, ponerlo arriba
   sería pedirle a la persona que se haga cargo de algo que no depende
   de ella.
   ------------------------------------------------------------------ */

export type Pendiente = {
  id: string
  titulo: string
  entregable: string | null
  proyecto: string
  proyecto_codigo: string
  cliente: string
  cliente_codigo: string
  fecha_comprometida: string | null
  urgencia: string
  trabada_porque: string | null
  dias_para_entregar: number | null
}

const PESO: Record<string, number> = { vencida: 0, esta_semana: 1, en_curso: 2, trabado: 3 }

const SELLO: Record<string, { texto: string; tono: 'rojo' | 'amarillo' | 'gris' | 'azul' }> = {
  vencida: { texto: 'vencida', tono: 'rojo' },
  esta_semana: { texto: 'esta semana', tono: 'amarillo' },
  en_curso: { texto: 'en curso', tono: 'azul' },
  trabado: { texto: 'trabada', tono: 'gris' },
}

function ordenar(a: Pendiente, b: Pendiente) {
  const d = (PESO[a.urgencia] ?? 9) - (PESO[b.urgencia] ?? 9)
  if (d !== 0) return d
  return (a.fecha_comprometida ?? '9999').localeCompare(b.fecha_comprometida ?? '9999')
}

function Tarea({ t }: { t: Pendiente }) {
  const s = SELLO[t.urgencia] ?? SELLO.en_curso
  return (
    <li>
      <Link
        href={`/proyecto/${t.proyecto_codigo}`}
        className="tarjeta flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3
                   transition-[border-color,box-shadow] duration-150 hover:border-azul-hondo
                   hover:shadow-[var(--sombra-flotante)]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-tinta">{t.titulo}</span>
          <span className="cifra block truncate text-2xs text-gris-50">
            {t.cliente} · {t.proyecto}
          </span>
        </span>

        {t.trabada_porque && (
          <span className="text-2xs text-amarillo">{t.trabada_porque}</span>
        )}

        <Chip tono={s.tono}>{s.texto}</Chip>

        <span className="cifra w-16 shrink-0 text-right text-2xs text-gris-50">
          {fechaCorta(t.fecha_comprometida) ?? 'sin fecha'}
        </span>
      </Link>
    </li>
  )
}

export default function MiDia({
  pendientes,
  nombre,
}: {
  pendientes: Pendiente[]
  nombre: string
}) {
  const [enfocado, setEnfocado] = useState(true)

  const ordenadas = [...pendientes].sort(ordenar)
  const trabadas = ordenadas.filter((t) => t.urgencia === 'trabado')
  const activas = ordenadas.filter((t) => t.urgencia !== 'trabado')
  const tresPrimeras = activas.slice(0, 3)

  // Agrupado por cliente para el modo completo: así se ve de una que
  // seis de las ocho cosas son del mismo, que cambia cómo se ordena el día.
  const porCliente = new Map<string, Pendiente[]>()
  for (const t of activas) {
    const l = porCliente.get(t.cliente) ?? []
    l.push(t)
    porCliente.set(t.cliente, l)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Cuánto mostrar"
          className="flex gap-0.5 rounded-[var(--radius-control)] border border-linea bg-panel p-0.5"
        >
          {([
            [true, 'Mi día'],
            [false, 'Todo'],
          ] as const).map(([valor, texto]) => (
            <button
              key={texto}
              type="button"
              aria-pressed={enfocado === valor}
              onClick={() => setEnfocado(valor)}
              className={`rounded-[7px] px-3 py-1 text-sm transition-colors duration-150 ${
                enfocado === valor
                  ? 'bg-superficie font-medium text-tinta shadow-[var(--sombra-apoyada)]'
                  : 'text-gris-50 hover:text-gris'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>

        <span className="text-2xs text-gris-50">
          {activas.length} por hacer
          {trabadas.length > 0 && ` · ${trabadas.length} trabadas`}
        </span>
      </div>

      {activas.length === 0 ? (
        <p className="tarjeta px-4 py-8 text-center text-sm text-gris">
          {trabadas.length > 0
            ? `${nombre} no tiene nada que dependa de ${nombre === 'Vos' ? 'vos' : 'él'} ahora mismo: lo que queda está trabado esperando a otro.`
            : 'Nada pendiente. Todas las entregas de sus proyectos están hechas.'}
        </p>
      ) : enfocado ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gris">
            Las tres que más urgen. Lo demás sigue estando, en «Todo».
          </p>
          <ul className="escalona flex flex-col gap-1.5">
            {tresPrimeras.map((t) => (
              <Tarea key={t.id} t={t} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {[...porCliente.entries()].map(([cliente, suyas]) => (
            <div key={cliente} className="flex flex-col gap-2">
              <span className="flex items-baseline gap-2">
                <h3 className="text-sm font-bold tracking-tight text-tinta">{cliente}</h3>
                <span className="cifra text-2xs text-gris-50">{suyas.length}</span>
              </span>
              <ul className="escalona flex flex-col gap-1.5">
                {suyas.map((t) => (
                  <Tarea key={t.id} t={t} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {trabadas.length > 0 && (
        <Plegable
          titulo="Trabadas, esperando a otro"
          cuantos={trabadas.length}
          ayuda="no depende de esta persona"
        >
          <ul className="flex flex-col gap-1.5">
            {trabadas.map((t) => (
              <Tarea key={t.id} t={t} />
            ))}
          </ul>
        </Plegable>
      )}
    </div>
  )
}
