'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

/* ------------------------------------------------------------------
   Dictar en vez de escribir.

   Sale de una reunión, abre el teléfono y habla dos minutos. Eso se
   carga; un formulario en blanco no.

   Usa el reconocimiento de voz del propio navegador: no manda el audio
   a ningún servicio nuestro, no hay clave que administrar y no cuesta
   por minuto. A cambio depende del navegador — Chrome, Edge y Safari lo
   tienen; Firefox no. Donde no está, el botón no aparece y se escribe
   como siempre.
   ------------------------------------------------------------------ */

type Alternativa = { transcript: string }
type Resultado = { isFinal: boolean; 0: Alternativa; length: number }
type Evento = { resultIndex: number; results: { length: number; [i: number]: Resultado } }

type Reconocimiento = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: Evento) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function motor(): (new () => Reconocimiento) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Reconocimiento) | null
}

const EXCUSAS: Record<string, string> = {
  'not-allowed': 'Hay que darle permiso al micrófono.',
  'service-not-allowed': 'Hay que darle permiso al micrófono.',
  'no-speech': 'No se escuchó nada.',
  'audio-capture': 'No se encontró micrófono.',
  network: 'Se cortó la conexión.',
}

export default function Dictado({
  alDictar,
  etiqueta = 'Dictar',
}: {
  alDictar: (texto: string) => void
  etiqueta?: string
}) {
  const [grabando, setGrabando] = useState(false)
  const [parcial, setParcial] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<Reconocimiento | null>(null)

  /* El navegador corta la escucha solo: por silencio, por tiempo, o
     porque sí. Cortaba el dictado a la mitad y se perdía lo que faltaba.
     Con esta marca sabemos si el corte lo pidió la persona o el
     navegador, y si fue el navegador se vuelve a arrancar. */
  const queriaCortar = useRef(false)

  /* El motor solo existe en el navegador. Se lee como lo que es —una
     capacidad del entorno, no un estado— para que el servidor y el
     cliente rindan lo mismo y no haya un salto en la hidratación. */
  const disponible = useSyncExternalStore(
    () => () => {},
    () => motor() !== null,
    () => false,
  )

  useEffect(
    () => () => {
      queriaCortar.current = true
      ref.current?.stop()
    },
    [],
  )

  function arrancar() {
    const Motor = motor()
    if (!Motor) return

    const r = new Motor()
    r.lang = 'es-AR'
    r.continuous = true
    r.interimResults = true

    r.onresult = (e) => {
      let cerrado = ''
      let abierto = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) cerrado += t
        else abierto += t
      }
      if (cerrado) alDictar(cerrado)
      setParcial(abierto)
    }

    r.onerror = (e) => {
      // Un silencio largo no es un error: no hay que cortar por eso.
      if (e.error === 'no-speech') return
      setError(EXCUSAS[e.error] ?? 'No se pudo escuchar.')
      queriaCortar.current = true
      setGrabando(false)
    }

    r.onend = () => {
      setParcial('')
      if (queriaCortar.current) {
        setGrabando(false)
        return
      }
      // Lo cortó el navegador, no la persona: sigue escuchando.
      try {
        r.start()
      } catch {
        setGrabando(false)
      }
    }

    setError(null)
    queriaCortar.current = false
    setGrabando(true)
    r.start()
    ref.current = r
  }

  function cortar() {
    queriaCortar.current = true
    ref.current?.stop()
    setGrabando(false)
  }

  if (!disponible) return null

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => (grabando ? cortar() : arrancar())}
        aria-pressed={grabando}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm
                    transition-colors duration-150 ${
                      grabando
                        ? 'border-rojo bg-rojo-aire font-medium text-rojo'
                        : 'border-linea text-gris hover:border-azul hover:text-azul-hondo'
                    }`}
      >
        <span
          className={`size-2 shrink-0 rounded-full ${grabando ? 'bg-rojo' : 'bg-gris-50'}`}
          style={grabando ? { animation: 'aparecer 0.9s var(--ease-suave) infinite alternate' } : undefined}
          aria-hidden
        />
        {grabando ? 'Escuchando… tocá para cortar' : etiqueta}
      </button>

      {grabando && !parcial && (
        <span className="text-2xs text-gris-50">
          Hablá todo lo que necesites: no se corta solo.
        </span>
      )}
      {parcial && <span className="text-2xs text-gris-50 italic">{parcial}</span>}
      {error && <span className="text-2xs text-rojo">{error}</span>}
    </span>
  )
}
