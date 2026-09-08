'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { anotarCharla } from '@/app/acciones'
import Dictado from '@/components/Dictado'

/* ------------------------------------------------------------------
   Anotar una charla, en veinte segundos.

   Este es el momento en que casi todo se pierde: hubo una reunión, hay
   interés, y todavía no existe ni el proyecto ni el alcance. El
   formulario largo mata ese registro. Éste pide cuatro cosas y ya deja
   el hilo abierto: después crece solo.
   ------------------------------------------------------------------ */

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

const rotulo = 'text-2xs font-medium uppercase tracking-wider text-gris-50'

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

export default function Charla({
  clientes,
  siempreAbierto = false,
}: {
  clientes: { id: string; nombre: string; proyectos: number; enVivo: number }[]
  siempreAbierto?: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(siempreAbierto)
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [clienteId, setClienteId] = useState('')
  const [clienteNuevo, setClienteNuevo] = useState('')
  const [tema, setTema] = useState('')
  const [loHablado, setLoHablado] = useState('')
  const [origen, setOrigen] = useState('')
  const [cuando, setCuando] = useState('')
  const [referidoPor, setReferidoPor] = useState('')
  const [referidoNota, setReferidoNota] = useState('')

  const elegido = clientes.find((c) => c.id === clienteId)

  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-fit rounded-md border border-linea-fuerte px-3.5 py-1.5 text-sm font-medium
                   text-gris transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
      >
        Anotar una charla
      </button>
    )

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg border border-azul bg-azul-aire p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight text-tinta">Anotar una charla</h2>
        <p className="max-w-[70ch] text-sm text-gris">
          Para cuando hubo una reunión o una llamada y todavía no hay proyecto. Queda como
          oportunidad en interés: el alcance, el monto y las entregas se cargan cuando existan.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Con quién</span>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className={campo}
            autoFocus
          >
            <option value="">elegí…</option>
            <option value="nuevo">Alguien nuevo</option>
            <option value="sin_definir">Todavía no sé de quién es</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.enVivo > 0 ? ` — ${c.enVivo} en vivo` : c.proyectos > 0 ? ` — ${c.proyectos} atrás` : ''}
              </option>
            ))}
          </select>
          {elegido && elegido.proyectos > 0 && (
            <span className="text-2xs text-azul-hondo">
              Ya es cliente: esto se suma a su ficha, no abre otra.
            </span>
          )}
          {clienteId === 'sin_definir' && (
            <span className="text-2xs text-gris-50">
              Queda en espera y te lo va a recordar la campanita hasta que le pongas nombre.
            </span>
          )}
        </label>

        {clienteId === 'nuevo' && (
          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Cómo se llama</span>
            <input
              value={clienteNuevo}
              onChange={(e) => setClienteNuevo(e.target.value)}
              placeholder="Vision Motors"
              className={campo}
            />
          </label>
        )}

        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>De dónde salió</span>
          <select value={origen} onChange={(e) => setOrigen(e.target.value)} className={campo}>
            <option value="">sin cargar</option>
            {ORIGENES.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>

        {(origen === 'recomendacion' || origen === 'referido') && (
          <>
            <label className="flex flex-col gap-0.5">
              <span className={rotulo}>Quién lo trajo</span>
              <input
                value={referidoPor}
                onChange={(e) => setReferidoPor(e.target.value)}
                placeholder="Nombre y apellido"
                className={campo}
              />
              <span className="text-2xs text-gris-50">
                Si ya nos refirió antes, se reconoce y no se duplica.
              </span>
            </label>

            <label className="flex flex-col gap-0.5">
              <span className={rotulo}>Qué se habló de su comisión</span>
              <input
                value={referidoNota}
                onChange={(e) => setReferidoNota(e.target.value)}
                placeholder="Nada todavía, o «con un 10 % está bien»"
                className={campo}
              />
              <span className="text-2xs text-gris-50">
                El porcentaje lo cierra administración cuando haya monto.
              </span>
            </label>
          </>
        )}

        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Tema, si ya hay uno</span>
          <input
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="Sitio nuevo, o dejalo vacío"
            className={campo}
          />
          <span className="text-2xs text-gris-50">Si todavía no se sabe, queda “Por definir”.</span>
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Cuándo se vuelve a hablar</span>
          <input
            type="date"
            value={cuando}
            onChange={(e) => setCuando(e.target.value)}
            className={`${campo} cifra`}
          />
          <span className="text-2xs text-gris-50">
            Sin esta fecha la charla se apaga sola y nadie se entera.
          </span>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className={rotulo}>De qué hablaron</span>
          <Dictado
            etiqueta="Contalo hablando"
            alDictar={(t) => setLoHablado((v) => (v ? `${v} ${t}` : t).replace(/\s+/g, ' '))}
          />
        </span>
        <textarea
          value={loHablado}
          onChange={(e) => setLoHablado(e.target.value)}
          rows={3}
          placeholder="Quiere ordenar la parte de ventas. No sabe todavía si es un sitio o un sistema. Mueve mucho por WhatsApp."
          className={`${campo} resize-y`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            setError(null)
            empezar(async () => {
              const r = await anotarCharla({
                clienteId, clienteNuevo, tema, loHablado, origen, cuando, referidoPor, referidoNota,
              })
              if (r.ok && r.ir) router.push(r.ir)
              else if (!r.ok) setError(r.error)
            })
          }}
          className="rounded-md bg-azul-hondo px-3.5 py-1.5 text-sm font-medium text-white
                     transition-colors duration-150 hover:bg-azul disabled:opacity-50"
        >
          {pendiente ? 'Anotando…' : 'Anotar la charla'}
        </button>
        {!siempreAbierto && (
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="px-2 py-1.5 text-sm text-gris hover:text-tinta"
          >
            Cancelar
          </button>
        )}
        {error && <span className="text-sm text-rojo">{error}</span>}
      </div>
    </div>
  )
}
