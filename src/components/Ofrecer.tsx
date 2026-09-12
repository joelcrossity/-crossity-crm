'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { anotarParaOfrecer, descartarNota, ofrecerServicio } from '@/app/acciones'
import { fechaCorta } from '@/lib/estados'
import { Seccion } from '@/components/ui'

/* ------------------------------------------------------------------
   Qué más le podemos ofrecer.

   Hoy esto vive en la cabeza de quien hizo el trabajo. Terminás un
   sitio y sabés que a ese cliente le sirve un agente conversacional,
   pero lo sabés vos y en ese momento; tres meses después ya no se te
   ocurre.

   Dos capas, porque son dos cosas distintas: lo que se deduce de lo
   entregado, y lo que solo sabe la persona que estuvo en la reunión.

   Y ofrecer no abre otra lista: abre una oportunidad en el pipeline.
   ------------------------------------------------------------------ */

export type Sugerencia = {
  servicio_id: string
  servicio: string
  recurrente: boolean
  porque_tiene: string
  razon: string
}

export type Nota = {
  id: string
  texto: string
  cuando: string | null
  estado: string
  servicio_id: string | null
  servicios: { nombre: string } | null
}

const campo = 'campo'

const rotulo = 'rotulo'

export default function Ofrecer({
  organizacionId,
  sugerencias,
  notas,
  servicios,
}: {
  organizacionId: string
  sugerencias: Sugerencia[]
  notas: Nota[]
  servicios: { id: string; nombre: string }[]
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [servicio, setServicio] = useState('')
  const [texto, setTexto] = useState('')
  const [cuando, setCuando] = useState('')

  const abiertas = notas.filter((n) => n.estado === 'anotada')

  function correr(fn: () => Promise<{ ok: boolean; error?: string; ir?: string }>, luego?: () => void) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo guardar.')
      else if (r.ir) router.push(r.ir)
      else {
        luego?.()
        router.refresh()
      }
    })
  }

  return (
    <Seccion
      titulo="Qué más le podemos ofrecer"
      ayuda="Lo de arriba sale solo de lo que ya le entregamos. Lo de abajo es lo que anotaste vos. Ofrecer algo abre una oportunidad en el pipeline, no otra lista."
      acciones={
        !abierto ? (
          <button type="button" onClick={() => setAbierto(true)} className="boton boton-secundario boton-chico">
            Anotar una idea
          </button>
        ) : null
      }
    >
      {error && <p className="text-sm font-medium text-rojo">{error}</p>}

      {abierto && (
        <div className="surge flex flex-wrap items-end gap-2 rounded-lg border border-azul bg-azul-aire p-3">
          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Qué servicio</span>
            <select
              value={servicio}
              onChange={(e) => setServicio(e.target.value)}
              className={`${campo} w-52`}
            >
              <option value="">todavía no sé</option>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-56 flex-1 flex-col gap-0.5">
            <span className={rotulo}>Qué notaste</span>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Le interesó la parte de reportes"
              className={campo}
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Cuándo volver</span>
            <input
              type="date"
              value={cuando}
              onChange={(e) => setCuando(e.target.value)}
              className={`${campo} cifra w-40`}
            />
          </label>

          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              correr(
                () => anotarParaOfrecer(organizacionId, servicio, texto, cuando),
                () => {
                  setTexto('')
                  setServicio('')
                  setCuando('')
                  setAbierto(false)
                },
              )
            }
            className="boton boton-principal"
          >
            Anotar
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="boton boton-sutil"
          >
            Cancelar
          </button>
        </div>
      )}

      {sugerencias.length > 0 && (
        <ul className="escalona grid gap-2 sm:grid-cols-2">
          {sugerencias.map((s) => (
            <li
              key={s.servicio_id}
              className="flex flex-col gap-2 tarjeta p-3.5"
            >
              <span className="flex flex-col gap-0.5">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-base font-bold tracking-tight text-tinta">{s.servicio}</span>
                  {s.recurrente && (
                    <span className="text-2xs font-medium text-verde">abono</span>
                  )}
                </span>
                <span className="text-2xs text-gris-50">porque ya tiene {s.porque_tiene}</span>
              </span>

              <p className="text-sm leading-snug text-gris">{s.razon}</p>

              <button
                type="button"
                disabled={pendiente}
                onClick={() =>
                  correr(() => ofrecerServicio(organizacionId, s.servicio_id, s.servicio))
                }
                className="w-fit rounded-md border border-linea px-2.5 py-1 text-2xs text-gris
                           transition-colors duration-150 hover:border-azul hover:text-azul-hondo
                           disabled:opacity-50"
              >
                Ofrecérselo →
              </button>
            </li>
          ))}
        </ul>
      )}

      {abiertas.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-linea pt-3">
          {abiertas.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-linea
                         bg-superficie px-3.5 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base text-tinta">{n.texto}</span>
                <span className="cifra block text-2xs text-gris-50">
                  {n.servicios?.nombre ?? 'sin servicio definido'}
                  {n.cuando && ` · volver el ${fechaCorta(n.cuando)}`}
                </span>
              </span>

              {n.servicio_id && (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() =>
                    correr(() =>
                      ofrecerServicio(
                        organizacionId,
                        n.servicio_id!,
                        n.servicios?.nombre ?? 'Propuesta',
                        n.id,
                      ),
                    )
                  }
                  className="boton boton-secundario boton-chico shrink-0"
                >
                  Ofrecérselo →
                </button>
              )}

              <button
                type="button"
                disabled={pendiente}
                onClick={() => correr(() => descartarNota(n.id))}
                className="shrink-0 text-2xs text-gris-50 transition-colors duration-150 hover:text-rojo"
              >
                no va
              </button>
            </li>
          ))}
        </ul>
      )}

      {sugerencias.length === 0 && abiertas.length === 0 && (
        <p className="tarjeta px-3.5 py-3 text-sm text-gris">
          Nada sugerido todavía. Las sugerencias salen de lo que se le entregó: cargale el servicio
          a sus proyectos terminados y aparecen solas.
        </p>
      )}
    </Seccion>
  )
}
