'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  cambiarEtapa,
  cambiarOrigen,
  cambiarProximaAccion,
  ganarOportunidad,
  perderOportunidad,
} from '@/app/acciones'
import { type EtapaViva } from '@/lib/estados'

/* ------------------------------------------------------------------
   El recorrido de una oportunidad, arriba de todo mientras todavía no
   es proyecto.

   Es la misma fila que después va a ser el proyecto: por eso lo que se
   habló el primer día sigue colgando del mismo hilo cuando se entrega.
   ------------------------------------------------------------------ */

const ORIGENES: [string, string][] = [
  ['recomendacion', 'Nos recomendaron'],
  ['referido', 'Referido de alguien'],
  ['cliente_existente', 'Ya es cliente'],
  ['entrante_web', 'Entró por la web'],
  ['whatsapp', 'Escribió por WhatsApp'],
  ['evento', 'Lo conocimos en un evento'],
  ['salida_propia', 'Salimos a buscarlo'],
  ['otro', 'Otro'],
]

const ESQUEMAS: [string, string][] = [
  ['cincuenta_cincuenta', '50 % al arrancar y 50 % al entregar'],
  ['por_hitos', 'Por entregas, con montos propios'],
  ['adelantado', 'Todo por adelantado'],
  ['mensual', 'Un abono mensual'],
  ['a_convenir', 'A convenir'],
]

const campo = 'campo'

const rotulo = 'rotulo'

export default function Recorrido({
  proyectoId,
  etapa,
  origen,
  proximaAccion,
  proximoSeguimiento,
  vencido,
  etapas,
}: {
  proyectoId: string
  etapa: string
  origen: string | null
  proximaAccion: string | null
  proximoSeguimiento: string | null
  vencido: boolean
  etapas: EtapaViva[]
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [cerrando, setCerrando] = useState<'ganado' | 'perdido' | null>(null)
  const [esquema, setEsquema] = useState('cincuenta_cincuenta')
  const [motivo, setMotivo] = useState<'no_se_dio' | 'perdido'>('no_se_dio')
  const [detalle, setDetalle] = useState('')

  const [accion, setAccion] = useState(proximaAccion ?? '')
  const [cuando, setCuando] = useState(proximoSeguimiento?.slice(0, 10) ?? '')

  const actual = etapas.findIndex((e) => e.valor === etapa)

  function correr(fn: () => Promise<{ ok: boolean; error?: string; ir?: string }>) {
    setError(null)
    empezar(async () => {
      const r = (await fn()) as { ok: boolean; error?: string; ir?: string }
      if (!r.ok) setError(r.error ?? 'No se pudo guardar.')
      else if (r.ir) router.push(r.ir)
      else router.refresh()
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-amarillo bg-amarillo-aire p-4">
      <div className="flex flex-col gap-0.5">
        <span className={rotulo}>Todavía no es un proyecto</span>
        <p className="max-w-[70ch] text-sm text-gris">
          Se está conversando. Cuando se gane, esta misma ficha pasa a ser el proyecto: lo que se
          habló acá no se pierde ni se vuelve a cargar.
        </p>
      </div>

      {/* La escalera. Se ve de dónde viene y cuánto falta, no solo dónde
          está: cinco botones sueltos no cuentan un recorrido. */}
      <ol className="flex flex-wrap items-start gap-y-2">
        {etapas.map((e, i) => {
          const hecha = i < actual
          const aca = i === actual
          return (
            <li key={e.valor} className="flex min-w-0 flex-1 basis-24 items-start">
              <button
                type="button"
                disabled={pendiente || aca}
                onClick={() => correr(() => cambiarEtapa(proyectoId, e.valor))}
                aria-current={aca ? 'step' : undefined}
                className="group flex min-w-0 flex-1 flex-col items-center gap-1.5 disabled:cursor-default"
              >
                <span className="flex w-full items-center" aria-hidden>
                  <span
                    className={`h-px flex-1 ${
                      i === 0 ? 'bg-transparent' : hecha || aca ? 'bg-azul-hondo' : 'bg-linea-fuerte'
                    }`}
                  />
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full border
                                text-[10px] font-bold transition-colors duration-200 ${
                                  aca
                                    ? 'border-azul-hondo bg-azul-hondo text-white'
                                    : hecha
                                      ? 'border-azul-hondo bg-superficie text-azul-hondo'
                                      : 'border-linea-fuerte bg-superficie text-gris-50 group-hover:border-azul'
                                }`}
                  >
                    {hecha ? '✓' : i + 1}
                  </span>
                  <span
                    className={`h-px flex-1 ${
                      i === etapas.length - 1
                        ? 'bg-transparent'
                        : hecha
                          ? 'bg-azul-hondo'
                          : 'bg-linea-fuerte'
                    }`}
                  />
                </span>
                <span
                  className={`px-1 text-center text-2xs leading-tight ${
                    aca
                      ? 'font-bold text-azul-hondo'
                      : hecha
                        ? 'text-gris'
                        : 'text-gris-50 group-hover:text-azul-hondo'
                  }`}
                >
                  {e.etiqueta}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>De dónde vino</span>
          <select
            value={origen ?? ''}
            disabled={pendiente}
            onChange={(e) => correr(() => cambiarOrigen(proyectoId, e.target.value))}
            className={campo}
          >
            <option value="">sin cargar</option>
            {ORIGENES.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-0.5 sm:col-span-2">
          <span className={rotulo}>Qué sigue, y cuándo</span>
          <span className="flex flex-wrap gap-2">
            <input
              value={accion}
              placeholder="Llamarlo para cerrar el alcance"
              disabled={pendiente}
              onChange={(e) => setAccion(e.target.value)}
              onBlur={() =>
                (accion !== (proximaAccion ?? '') || cuando !== (proximoSeguimiento?.slice(0, 10) ?? '')) &&
                correr(() => cambiarProximaAccion(proyectoId, accion, cuando))
              }
              className={`${campo} min-w-0 flex-1`}
            />
            <input
              type="date"
              value={cuando}
              disabled={pendiente}
              onChange={(e) => setCuando(e.target.value)}
              onBlur={() => correr(() => cambiarProximaAccion(proyectoId, accion, cuando))}
              className={`${campo} cifra w-40 ${vencido ? 'border-rojo' : ''}`}
            />
          </span>
          <span className={`text-2xs ${vencido ? 'font-medium text-rojo' : 'text-gris-50'}`}>
            {vencido
              ? 'La fecha de seguimiento ya pasó.'
              : 'Sin fecha acá, la oportunidad se apaga sola y nadie se entera.'}
          </span>
        </label>
      </div>

      {cerrando === 'ganado' ? (
        <div className="flex flex-col gap-2.5 border-t border-amarillo pt-3.5">
          <div className="flex flex-col gap-0.5">
            <span className={rotulo}>Cómo se cobra</span>
            <p className="max-w-[65ch] text-sm text-gris">
              Con esto se generan las entregas y el proyecto queda esperando el anticipo, no
              trabajando.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={esquema}
              onChange={(e) => setEsquema(e.target.value)}
              className={`${campo} w-72`}
              autoFocus
            >
              {ESQUEMAS.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => ganarOportunidad(proyectoId, esquema))}
              className="rounded-md bg-verde px-3.5 py-1.5 text-sm font-medium text-white
                         transition-colors duration-150 hover:opacity-90 disabled:opacity-50"
            >
              {pendiente ? 'Convirtiendo…' : 'Convertir en proyecto'}
            </button>
            <Cancelar onClick={() => setCerrando(null)} />
          </div>
        </div>
      ) : cerrando === 'perdido' ? (
        <div className="flex flex-col gap-2.5 border-t border-amarillo pt-3.5">
          <div className="flex flex-col gap-0.5">
            <span className={rotulo}>Qué pasó</span>
            <p className="max-w-[65ch] text-sm text-gris">
              No se dio vuelve a la lista de recontacto. Perdido no.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as 'no_se_dio' | 'perdido')}
              className={`${campo} w-64`}
              autoFocus
            >
              <option value="no_se_dio">No se dio, se apagó solo</option>
              <option value="perdido">Lo perdimos, decidió que no</option>
            </select>
            <input
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="Por qué"
              className={`${campo} w-64`}
            />
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => perderOportunidad(proyectoId, motivo, detalle))}
              className="rounded-md border border-linea-fuerte px-3.5 py-1.5 text-sm font-medium
                         text-gris transition-colors duration-150 hover:border-rojo hover:text-rojo
                         disabled:opacity-50"
            >
              Cerrarla
            </button>
            <Cancelar onClick={() => setCerrando(null)} />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-amarillo pt-3.5">
          <button
            type="button"
            onClick={() => setCerrando('ganado')}
            className="rounded-md bg-verde px-3.5 py-1.5 text-sm font-medium text-white
                       transition-colors duration-150 hover:opacity-90"
          >
            La ganamos
          </button>
          <button
            type="button"
            onClick={() => setCerrando('perdido')}
            className="rounded-md border border-linea px-3 py-1.5 text-sm text-gris
                       transition-colors duration-150 hover:border-rojo hover:text-rojo"
          >
            No va más
          </button>
        </div>
      )}

      {error && <p className="text-sm text-rojo">{error}</p>}
    </section>
  )
}

function Cancelar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="boton boton-sutil">
      Cancelar
    </button>
  )
}
