'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  apagarEtapa,
  guardarEtapa,
  moverEstado,
  moverEtapa,
  renombrarEstado,
} from '@/app/acciones'
import { Seccion } from '@/components/ui'

/* ------------------------------------------------------------------
   Las etapas y los estados.

   Dos cosas parecidas que se editan distinto, y la diferencia importa.

   Las etapas del embudo son la forma en que la agencia vende, y esa
   forma se ajusta: se agregan, se renombran y se mueven de lugar.

   Los estados de proyecto no son etiquetas: son comportamiento. Gris
   exige un motivo, verde exige un subestado, naranja cierra el trabajo.
   Agregar un sexto color rompería reglas de la base que existen por
   buenas razones, así que acá solo se cambia el texto.
   ------------------------------------------------------------------ */

export type Etapa = {
  clave: string
  etiqueta: string
  orden: number
  activa: boolean
  es_final: boolean
  ayuda: string | null
  cuantas: number
}

export type Estado = {
  color: string
  etiqueta: string
  ayuda: string
  orden: number
}

const PUNTO: Record<string, string> = {
  verde: 'bg-verde',
  amarillo: 'bg-amarillo',
  gris: 'bg-gris-50',
  naranja: 'bg-naranja',
  rojo: 'bg-rojo',
}

const campo = 'campo'

const rotulo = 'rotulo'

export default function Etapas({
  etapas,
  estados,
  esDireccion,
}: {
  etapas: Etapa[]
  estados: Estado[]
  esDireccion: boolean
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [nueva, setNueva] = useState('')
  const [ayudaNueva, setAyudaNueva] = useState('')

  const delEmbudo = etapas.filter((e) => !e.es_final)
  const finales = etapas.filter((e) => e.es_final)

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>, luego?: () => void) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo guardar.')
      else {
        luego?.()
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-9">
      {error && (
        <p className="surge rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      <Seccion
        titulo="Etapas del pipeline"
        ayuda={
          <>
            El orden es el recorrido: de arriba hacia abajo es como avanza una oportunidad.
            {!esDireccion && ' Solo dirección puede cambiarlas.'}
          </>
        }
        acciones={
          esDireccion && !abierto ? (
            <button type="button" onClick={() => setAbierto(true)} className="boton boton-secundario">
              Sumar una etapa
            </button>
          ) : null
        }
      >

        {abierto && (
          <div className="surge flex flex-wrap items-end gap-2 rounded-lg border border-azul bg-azul-aire p-3">
            <label className="flex flex-col gap-0.5">
              <span className={rotulo}>Cómo se llama</span>
              <input
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                placeholder="Prueba piloto"
                className={`${campo} w-52`}
                autoFocus
              />
            </label>
            <label className="flex min-w-56 flex-1 flex-col gap-0.5">
              <span className={rotulo}>Qué significa estar ahí</span>
              <input
                value={ayudaNueva}
                onChange={(e) => setAyudaNueva(e.target.value)}
                placeholder="Está probando el producto antes de decidir"
                className={campo}
              />
            </label>
            <button
              type="button"
              disabled={pendiente || !nueva.trim()}
              onClick={() =>
                correr(
                  () => guardarEtapa('', nueva, ayudaNueva),
                  () => {
                    setNueva('')
                    setAyudaNueva('')
                    setAbierto(false)
                  },
                )
              }
              className="boton boton-principal"
            >
              Sumarla
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="boton boton-sutil"
            >
              Cancelar
            </button>
            <p className="w-full text-2xs text-gris-50">
              Entra antes de Ganado. Después la movés de lugar con las flechas.
            </p>
          </div>
        )}

        <ul className="flex flex-col gap-1.5">
          {delEmbudo.map((e, i) => (
            <li
              key={e.clave}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border
                          bg-superficie px-3 py-2.5 ${
                            e.activa ? 'border-linea' : 'border-dashed border-linea-fuerte opacity-60'
                          }`}
            >
              {esDireccion && (
                <span className="flex shrink-0 flex-col gap-px">
                  <Flecha
                    hacia="arriba"
                    apagada={i === 0 || pendiente}
                    alClic={() => correr(() => moverEtapa(e.clave, -1))}
                  />
                  <Flecha
                    hacia="abajo"
                    apagada={i === delEmbudo.length - 1 || pendiente}
                    alClic={() => correr(() => moverEtapa(e.clave, 1))}
                  />
                </span>
              )}

              <span className="min-w-0 flex-1">
                {esDireccion ? (
                  <Editable
                    valor={e.etiqueta}
                    ayuda={e.ayuda ?? ''}
                    pendiente={pendiente}
                    alGuardar={(t, a) => correr(() => guardarEtapa(e.clave, t, a))}
                  />
                ) : (
                  <span>
                    <span className="block text-base font-medium text-tinta">{e.etiqueta}</span>
                    <span className="block text-2xs text-gris-50">{e.ayuda}</span>
                  </span>
                )}
              </span>

              <span className="cifra shrink-0 text-2xs text-gris-50">
                {e.cuantas > 0 ? `${e.cuantas} adentro` : 'vacía'}
              </span>

              {esDireccion && (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => correr(() => apagarEtapa(e.clave, !e.activa))}
                  className="shrink-0 rounded-md border border-linea px-2 py-1 text-2xs text-gris
                             transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
                >
                  {e.activa ? 'Apagar' : 'Prender'}
                </button>
              )}
            </li>
          ))}
        </ul>

        {finales.map((e) => (
          <p
            key={e.clave}
            className="rounded-lg border border-linea bg-panel px-3.5 py-2.5 text-sm text-gris"
          >
            <span className="font-medium text-tinta">{e.etiqueta}</span> cierra el recorrido y no se
            toca: es la puerta por donde una oportunidad se convierte en proyecto, y hay cálculos que
            dependen de ella.
          </p>
        ))}
      </Seccion>

      <div className="border-t border-linea pt-8">
        <Seccion
          titulo="Estados de proyecto"
          ayuda="El orden se cambia como en el pipeline: es cómo se miran las columnas del tablero y hay meses en que lo primero que querés ver es lo frenado. El texto también. Lo que no se toca es el comportamiento: frenado exige un motivo, en vivo exige un detalle, terminado cierra el trabajo. Un sexto color rompería reglas que existen por buenas razones."
        >

        <ul className="flex flex-col gap-1.5">
          {[...estados]
            .sort((a, b) => a.orden - b.orden)
            .map((e, i, lista) => (
              <li
                key={e.color}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border
                           border-linea bg-superficie px-3.5 py-2.5"
              >
                {esDireccion && (
                  <span className="flex shrink-0 flex-col gap-px">
                    <Flecha
                      hacia="arriba"
                      apagada={i === 0 || pendiente}
                      alClic={() => correr(() => moverEstado(e.color, -1))}
                    />
                    <Flecha
                      hacia="abajo"
                      apagada={i === lista.length - 1 || pendiente}
                      alClic={() => correr(() => moverEstado(e.color, 1))}
                    />
                  </span>
                )}
                <span className={`size-2.5 shrink-0 rounded-full ${PUNTO[e.color]}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  {esDireccion ? (
                    <Editable
                      valor={e.etiqueta}
                      ayuda={e.ayuda}
                      pendiente={pendiente}
                      alGuardar={(t, a) => correr(() => renombrarEstado(e.color, t, a))}
                    />
                  ) : (
                    <span>
                      <span className="block text-base font-medium text-tinta">{e.etiqueta}</span>
                      <span className="block text-2xs text-gris-50">{e.ayuda}</span>
                    </span>
                  )}
                </span>
              </li>
            ))}
        </ul>
        </Seccion>
      </div>
    </div>
  )
}

function Editable({
  valor,
  ayuda,
  pendiente,
  alGuardar,
}: {
  valor: string
  ayuda: string
  pendiente: boolean
  alGuardar: (texto: string, ayuda: string) => void
}) {
  const [t, setT] = useState(valor)
  const [a, setA] = useState(ayuda)

  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        value={t}
        disabled={pendiente}
        onChange={(e) => setT(e.target.value)}
        onBlur={() => (t !== valor || a !== ayuda) && alGuardar(t, a)}
        className={`${campo} w-44 font-medium`}
        aria-label="Nombre"
      />
      <input
        value={a}
        disabled={pendiente}
        onChange={(e) => setA(e.target.value)}
        onBlur={() => (t !== valor || a !== ayuda) && alGuardar(t, a)}
        placeholder="qué significa estar ahí"
        className={`${campo} min-w-48 flex-1 text-2xs`}
        aria-label="Ayuda"
      />
    </span>
  )
}

function Flecha({
  hacia,
  apagada,
  alClic,
}: {
  hacia: 'arriba' | 'abajo'
  apagada: boolean
  alClic: () => void
}) {
  return (
    <button
      type="button"
      disabled={apagada}
      onClick={alClic}
      aria-label={hacia === 'arriba' ? 'Subir' : 'Bajar'}
      className="grid size-5 place-items-center rounded text-gris-50 transition-colors duration-150
                 hover:text-azul-hondo disabled:opacity-25"
    >
      <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden>
        <path
          d={hacia === 'arriba' ? 'M3 7.5 6 4.5l3 3' : 'M3 4.5 6 7.5l3-3'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
