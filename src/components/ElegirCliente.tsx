'use client'

import { useId, useMemo, useRef, useState, useTransition } from 'react'
import { deQuienEsEsteCuit } from '@/app/acciones'

/* ------------------------------------------------------------------
   Elegir un cliente.

   Esto reemplaza a un <select> con treinta y cuatro opciones sin
   buscador, y no es un capricho estético: ese select es lo que creó el
   duplicado de Leffler. Nadie encuentra "Leffler Dietz" en una lista
   larga que no se puede filtrar, así que carga uno nuevo, y a partir de
   ahí el mismo cliente tiene dos fichas y sus proyectos quedan
   repartidos entre las dos.

   Por eso busca por todo lo que alguien podría escribir: el nombre, las
   marcas y los alias. Los alias importan especialmente, porque el
   nombre viejo de una fusión queda ahí: el que escribe "Leffler -
   Dietz" tiene que encontrar la ficha que absorbió ese nombre, no un
   vacío que lo invite a crear otro.

   Y cuando de verdad es uno nuevo, antes de dejarlo pasar avisa si ya
   hay alguno que se le parece. Avisa, no prohíbe: dos empresas pueden
   llamarse parecido y eso lo sabe una persona, no una comparación de
   cadenas.
   ------------------------------------------------------------------ */

export type Cliente = {
  id: string
  nombre: string
  proyectos: number
  enVivo: number
  marcas?: string | null
  alias?: string[] | null
  cuits?: string[] | null
}

/* El CUIT sin puntos ni guiones: la misma cuenta que hace la columna
   generada en la base, para que "30-71234567-8" y "30712345678" se
   busquen igual acá y allá. */
const soloNumeros = (s: string) => s.replace(/\D/g, '')

/* La misma normalización que usa clave_cliente() en la base: sin
   mayúsculas, sin tildes, sin puntuación y sin el sufijo societario.
   Si las dos se separan, la pantalla va a avisar de duplicados que la
   base no considera tales, o al revés. */
const SOCIETARIO = /\b(s\.?a\.?s?|s\.?r\.?l|srl|sas|sa|ltda|ltd|inc|group|grupo)\b/g

function clave(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(SOCIETARIO, '')
    .replace(/[^a-z0-9]/g, '')
}

function Cuenta({ c }: { c: Cliente }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm text-tinta">{c.nombre}</span>
      <span className="truncate text-2xs text-gris-50">
        {c.proyectos === 0
          ? 'sin historia'
          : `${c.proyectos} proyecto${c.proyectos > 1 ? 's' : ''}${
              c.enVivo > 0 ? ` · ${c.enVivo} en vivo` : ''
            }`}
        {c.marcas ? ` · ${c.marcas}` : ''}
      </span>
    </span>
  )
}

export default function ElegirCliente({
  clientes,
  elegido,
  nombreNuevo,
  cuitNuevo = '',
  alElegir,
  alEscribirNuevo,
  alEscribirCuit,
  autoFoco = false,
  extras = [],
}: {
  clientes: Cliente[]
  /* Opciones que no son una cuenta. Charla tiene una: "todavía no sé de
     quién es", que abre una cuenta provisoria. Van al pie, con el alta,
     porque las tres son salidas y no resultados de la búsqueda. */
  extras?: { valor: string; texto: string; ayuda?: string }[]
  /* El id de la cuenta, 'nuevo' si se está dando de alta, o '' si
     todavía no eligió. */
  elegido: string
  nombreNuevo: string
  cuitNuevo?: string
  alElegir: (id: string) => void
  alEscribirNuevo: (nombre: string) => void
  alEscribirCuit?: (cuit: string) => void
  autoFoco?: boolean
}) {
  const [busca, setBusca] = useState('')
  const [duenio, setDuenio] = useState<{ id: string; nombre: string; donde: string } | null>(null)
  const [, consultando] = useTransition()
  const [abierto, setAbierto] = useState(false)
  const [marcado, setMarcado] = useState(0)
  const listaId = useId()
  const caja = useRef<HTMLDivElement>(null)

  const cuenta = clientes.find((c) => c.id === elegido)
  const extra = extras.find((x) => x.valor === elegido)

  const halladas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return clientes
    // Si lo que escribe son números, está buscando por CUIT.
    const n = soloNumeros(q)
    return clientes.filter(
      (c) =>
        [c.nombre, c.marcas ?? '', ...(c.alias ?? [])].join(' ').toLowerCase().includes(q) ||
        (n.length >= 3 && (c.cuits ?? []).some((x) => x.includes(n))),
    )
  }, [clientes, busca])

  /* Al dar de alta uno nuevo: ¿ya hay alguno que se le parece? */
  const parecidos = useMemo(() => {
    const k = clave(nombreNuevo)
    if (k.length < 3) return []
    return clientes.filter(
      (c) => clave(c.nombre) === k || (c.alias ?? []).some((a) => clave(a) === k),
    )
  }, [clientes, nombreNuevo])

  function cerrar() {
    setAbierto(false)
    setBusca('')
    setMarcado(0)
  }

  function tomar(id: string) {
    alElegir(id)
    cerrar()
  }

  function teclado(e: React.KeyboardEvent) {
    const total = halladas.length + 1 + extras.length // + alta + extras
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAbierto(true)
      setMarcado((i) => (i + 1) % total)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMarcado((i) => (i - 1 + total) % total)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (!abierto) return setAbierto(true)
      if (marcado < halladas.length) tomar(halladas[marcado].id)
      else if (marcado === halladas.length) tomar('nuevo')
      else tomar(extras[marcado - halladas.length - 1].valor)
    } else if (e.key === 'Escape' && abierto) {
      e.preventDefault()
      cerrar()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={caja}
        className="relative w-72"
        onBlur={(e) => {
          // Solo si el foco salió de toda la caja, no al saltar de un
          // hijo a otro: si no, elegir con el mouse cierra antes de
          // que el clic llegue.
          if (!e.currentTarget.contains(e.relatedTarget as Node)) cerrar()
        }}
      >
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          onKeyDown={teclado}
          autoFocus={autoFoco}
          aria-haspopup="listbox"
          aria-expanded={abierto}
          aria-controls={listaId}
          className={`campo flex w-full cursor-pointer items-center gap-2 text-left ${
            abierto ? 'border-azul' : ''
          }`}
        >
          <span className={`min-w-0 flex-1 truncate ${cuenta || elegido === 'nuevo' ? '' : 'text-gris-50'}`}>
            {elegido === 'nuevo'
              ? nombreNuevo.trim() || 'Cliente nuevo'
              : extra?.texto ?? cuenta?.nombre ?? 'Buscar o elegir cliente'}
          </span>
          <svg
            viewBox="0 0 16 16"
            className={`size-3.5 shrink-0 text-gris-50 transition-transform duration-200
                        ease-(--ease-salida) ${abierto ? 'rotate-180' : ''}`}
            fill="none"
            aria-hidden
          >
            <path d="M4 6.2 8 10l4-3.8" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {abierto && (
          <div
            className="surge tarjeta shadow-[var(--sombra-flotante)] absolute top-full left-0 z-(--z-desplegable) mt-1.5 flex
                       w-full flex-col overflow-hidden"
          >
            <div className="border-b border-linea p-1.5">
              <input
                type="search"
                value={busca}
                autoFocus
                onChange={(e) => {
                  setBusca(e.target.value)
                  setMarcado(0)
                }}
                onKeyDown={teclado}
                placeholder="Escribí para buscar…"
                aria-label="Buscar cliente"
                className="w-full rounded-md border border-linea bg-superficie px-2 py-1
                           text-sm text-tinta placeholder:text-gris-50 focus:border-azul"
              />
            </div>

            <ul id={listaId} role="listbox" className="riel max-h-64 overflow-y-auto p-1">
              {halladas.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.id === elegido}
                    onMouseEnter={() => setMarcado(i)}
                    onClick={() => tomar(c.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left
                                transition-colors duration-100 ${
                                  i === marcado ? 'bg-azul-aire' : ''
                                }`}
                  >
                    <Cuenta c={c} />
                    {c.id === elegido && (
                      <span className="shrink-0 text-2xs text-azul-hondo">elegido</span>
                    )}
                  </button>
                </li>
              ))}

              {halladas.length === 0 && (
                <li className="px-2 py-3 text-center text-2xs text-gris-50">
                  Ninguno coincide con «{busca.trim()}».
                </li>
              )}
            </ul>

            <div className="border-t border-linea p-1">
              <button
                type="button"
                role="option"
                aria-selected={elegido === 'nuevo'}
                onMouseEnter={() => setMarcado(halladas.length)}
                onClick={() => {
                  // Lo que se escribió buscando casi siempre es el
                  // nombre: arrancar el alta con eso ahorra tipearlo.
                  if (busca.trim() && !nombreNuevo.trim()) alEscribirNuevo(busca.trim())
                  tomar('nuevo')
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left
                            text-sm font-medium text-azul-hondo transition-colors duration-100 ${
                              marcado === halladas.length ? 'bg-azul-aire' : ''
                            }`}
              >
                <span aria-hidden>＋</span>
                Crear cliente nuevo
                {busca.trim() && <span className="truncate text-gris-50">«{busca.trim()}»</span>}
              </button>

              {extras.map((x, i) => (
                <button
                  key={x.valor}
                  type="button"
                  role="option"
                  aria-selected={elegido === x.valor}
                  onMouseEnter={() => setMarcado(halladas.length + 1 + i)}
                  onClick={() => tomar(x.valor)}
                  className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left
                              transition-colors duration-100 ${
                                marcado === halladas.length + 1 + i ? 'bg-azul-aire' : ''
                              }`}
                >
                  <span className="text-sm text-tinta">{x.texto}</span>
                  {x.ayuda && <span className="text-2xs text-gris-50">{x.ayuda}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {elegido === 'nuevo' && (
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-azul-hondo">
              Nombre del cliente nuevo
            </span>
            <input
              value={nombreNuevo}
              onChange={(e) => alEscribirNuevo(e.target.value)}
              placeholder="Vision Motors"
              className={`campo w-72 ${parecidos.length > 0 ? 'border-amarillo' : 'border-azul'}`}
            />
          </label>

          {alEscribirCuit && (
            <label className="flex flex-col gap-0.5">
              <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
                CUIT o DNI <span className="normal-case">— opcional, pero evita duplicados</span>
              </span>
              <input
                value={cuitNuevo}
                inputMode="numeric"
                onChange={(e) => {
                  alEscribirCuit(e.target.value)
                  setDuenio(null)
                }}
                /* Se pregunta al salir del campo y no en cada tecla: el
                   número recién está completo cuando se terminó de
                   escribir, y un viaje al servidor por dígito no aporta
                   nada. */
                onBlur={() => {
                  const n = soloNumeros(cuitNuevo)
                  if (n.length < 7) return setDuenio(null)
                  const local = clientes.find((c) => (c.cuits ?? []).includes(n))
                  if (local) return setDuenio({ id: local.id, nombre: local.nombre, donde: 'la cuenta' })
                  // Puede ser de un cliente que esta persona no ve.
                  consultando(async () => setDuenio(await deQuienEsEsteCuit(cuitNuevo)))
                }}
                placeholder="30-71234567-8"
                className={`campo cifra w-72 ${duenio ? 'border-rojo' : ''}`}
              />
            </label>
          )}

          {duenio && (
            <div
              role="alert"
              className="surge flex flex-col gap-1.5 rounded-md border border-rojo bg-rojo-aire
                         px-2.5 py-2"
            >
              <span className="text-2xs text-tinta">
                Ya hay un cliente con el CUIT{' '}
                <span className="cifra font-medium">{cuitNuevo.trim()}</span>:{' '}
                <span className="font-medium">{duenio.nombre}</span>
                {duenio.donde !== 'la cuenta' && `, en ${duenio.donde}`}.
              </span>
              <button
                type="button"
                onClick={() => {
                  alEscribirNuevo('')
                  alEscribirCuit?.('')
                  setDuenio(null)
                  alElegir(duenio.id)
                }}
                className="boton boton-principal boton-chico w-fit"
              >
                Usar la ficha existente
              </button>
            </div>
          )}

          {parecidos.length > 0 && (
            <div className="surge flex flex-col gap-1.5 rounded-md border border-amarillo
                            bg-amarillo-aire px-2.5 py-2">
              <span className="text-2xs text-tinta">
                {parecidos.length === 1
                  ? 'Ya existe uno que se llama casi igual:'
                  : 'Ya existen algunos que se llaman casi igual:'}
              </span>
              {parecidos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    alEscribirNuevo('')
                    alElegir(c.id)
                  }}
                  className="flex items-center gap-2 rounded-md border border-linea bg-superficie
                             px-2 py-1 text-left transition-colors duration-150 hover:border-azul"
                >
                  <Cuenta c={c} />
                  <span className="shrink-0 text-2xs font-medium text-azul-hondo">usar éste</span>
                </button>
              ))}
              <span className="text-2xs text-gris-50">
                Si igual es otro, seguí: dos empresas pueden llamarse parecido.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
