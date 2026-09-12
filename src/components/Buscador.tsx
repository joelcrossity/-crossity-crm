'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ------------------------------------------------------------------
   Buscar todo desde cualquier lado.

   Buscar por pantalla obliga a saber de antemano en cuál está lo que se
   busca — y si hay que saberlo, ya no hace falta buscar. Esto responde
   la pregunta de siempre: "¿cómo se llamaba el proyecto de Vision?".

   Se abre con Cmd+K o Ctrl+K. Ese atajo es una convención y por eso se
   respeta: quien la conoce la prueba sin que nadie se la enseñe, y
   quien no, tiene el botón al lado de la campanita.

   Los datos se traen una sola vez al abrirlo y se filtran acá. A esta
   escala son unos cientos de filas: ir al servidor por cada letra se
   siente lento aunque no lo sea.
   ------------------------------------------------------------------ */

type Hallazgo = {
  clase: string
  id: string
  titulo: string
  detalle: string | null
  codigo: string | null
  adonde: string
  señal: string | null
  texto: string
}

const NOMBRE: Record<string, string> = {
  proyecto: 'Proyecto',
  cliente: 'Cliente',
  persona: 'Persona',
}

const PUNTO: Record<string, string> = {
  verde: 'bg-verde',
  amarillo: 'bg-amarillo',
  gris: 'bg-gris-25',
  naranja: 'bg-naranja',
  rojo: 'bg-rojo',
}

function normalizar(t: string) {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export default function Buscador() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [todo, setTodo] = useState<Hallazgo[] | null>(null)
  const [texto, setTexto] = useState('')
  const [marcado, setMarcado] = useState(0)
  const campo = useRef<HTMLInputElement>(null)

  // El atajo vive mientras la pantalla exista, no mientras esté abierto.
  useEffect(() => {
     
    function tecla(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAbierto((v) => !v)
      }
      if (e.key === 'Escape') setAbierto(false)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  useEffect(() => {
    if (!abierto || todo) return
    void createClient()
      .from('v_buscar')
      .select('*')
      .then(({ data }) => setTodo((data ?? []) as Hallazgo[]))
  }, [abierto, todo])

  /* Enfocar es tocar el DOM, que es para lo que el efecto existe. Lo
     que se limpia al cerrar se limpia donde se cierra, no en un efecto:
     así el estado no se recalcula por rebote. */
  useEffect(() => {
    if (abierto) campo.current?.focus()
  }, [abierto])

  function cerrar() {
    setAbierto(false)
    setTexto('')
    setMarcado(0)
  }

  const q = normalizar(texto.trim())
  const hallados =
    q.length === 0
      ? []
      : (todo ?? [])
          .filter((h) => normalizar(h.texto).includes(q))
          .sort((a, b) => {
            // Lo que empieza con lo tipeado va antes de lo que solo lo contiene.
            const ea = normalizar(a.titulo).startsWith(q) ? 0 : 1
            const eb = normalizar(b.titulo).startsWith(q) ? 0 : 1
            return ea - eb || a.titulo.localeCompare(b.titulo)
          })
          .slice(0, 8)

  function ir(h: Hallazgo) {
    cerrar()
    router.push(h.adonde)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Buscar"
        className="flex items-center gap-2 rounded-[var(--radius-control)] border border-linea
                   bg-superficie px-2.5 py-1.5 text-2xs text-gris-50 transition-colors
                   duration-150 hover:border-linea-fuerte hover:text-gris"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden rounded border border-linea px-1 font-sans text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-(--z-modal) flex items-start justify-center px-4 pt-[12vh]"
          onMouseDown={(e) => e.target === e.currentTarget && cerrar()}
        >
          <div
            className="fixed inset-0 bg-tinta/20 backdrop-blur-[2px]"
            style={{ animation: 'aparecer 0.2s var(--ease-suave) both' }}
            aria-hidden
          />

          <div
            role="dialog"
            aria-label="Buscar"
            className="surge vidrio relative w-full max-w-lg overflow-hidden rounded-[var(--radius-contenedor)]
                       border shadow-[var(--sombra-alzada)]"
          >
            <div className="flex items-center gap-2.5 border-b border-linea px-4 py-3">
              <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-gris-50" fill="none" aria-hidden>
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={campo}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value)
                  setMarcado(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setMarcado((v) => Math.min(v + 1, hallados.length - 1))
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setMarcado((v) => Math.max(v - 1, 0))
                  }
                  if (e.key === 'Enter' && hallados[marcado]) ir(hallados[marcado])
                }}
                placeholder="Proyecto, cliente o persona…"
                className="w-full bg-transparent text-md text-tinta outline-none placeholder:text-gris-25"
              />
              <kbd className="shrink-0 rounded border border-linea px-1.5 py-0.5 font-sans text-[10px] text-gris-50">
                esc
              </kbd>
            </div>

            {q.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gris-50">
                {todo === null ? 'Cargando…' : 'Escribí para buscar en todo el sistema.'}
              </p>
            ) : hallados.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gris-50">
                Nada con ese nombre.
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1.5">
                {hallados.map((h, i) => (
                  <li key={`${h.clase}-${h.id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setMarcado(i)}
                      onClick={() => ir(h)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left
                                  transition-colors duration-100 ${
                                    i === marcado ? 'bg-azul-aire' : ''
                                  }`}
                    >
                      {h.señal ? (
                        <span
                          className={`size-2 shrink-0 rounded-full ${PUNTO[h.señal] ?? 'bg-gris-25'}`}
                          aria-hidden
                        />
                      ) : (
                        <span className="size-2 shrink-0" aria-hidden />
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base text-tinta">{h.titulo}</span>
                        {h.detalle && (
                          <span className="block truncate text-2xs text-gris-50">{h.detalle}</span>
                        )}
                      </span>

                      <span className="shrink-0 text-2xs text-gris-25">{NOMBRE[h.clase]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}
