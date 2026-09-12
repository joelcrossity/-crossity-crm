'use client'

import { useState } from 'react'
import Link from 'next/link'

/* ==================================================================
   El kit.

   Todo lo que se repite en más de una pantalla vive acá. La regla para
   lo que venga: una pantalla nueva se arma con estas piezas y hereda la
   estética sola. Si algo no está, se agrega acá y aparece en todas —no
   se escribe a mano en la pantalla nueva, porque eso es exactamente lo
   que hizo que veinte archivos tuvieran su propia copia de la clase de
   un input y que una quedara desactualizada.

   Los colores, las esquinas, las sombras y el vidrio no se definen acá:
   salen de las variables de globals.css. Esto es la forma, no el color.
   ================================================================== */

/* ------------------------------------------------------------------
   Encabezado de una sección dentro de una pantalla.
   Treinta lugares lo escribían a mano, cada uno con su tamaño.
   ------------------------------------------------------------------ */

export function Seccion({
  titulo,
  ayuda,
  cuantos,
  acciones,
  children,
}: {
  titulo: string
  ayuda?: React.ReactNode
  cuantos?: number
  acciones?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-baseline gap-2.5">
            <h2 className="text-md font-bold tracking-tight">{titulo}</h2>
            {cuantos !== undefined && (
              <span className="cifra text-2xs text-gris-50">{cuantos}</span>
            )}
          </span>
          {ayuda && <p className="max-w-[70ch] text-sm text-gris">{ayuda}</p>}
        </div>
        {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
      </div>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------
   Superficies.
   ------------------------------------------------------------------ */

export function Ficha({
  children,
  flota,
  className = '',
}: {
  children: React.ReactNode
  flota?: boolean
  className?: string
}) {
  return (
    <div className={`${flota ? 'tarjeta-flota' : 'tarjeta'} p-4 ${className}`}>{children}</div>
  )
}

/* Cuando no hay nada que mostrar. Dice qué falta y, si se puede, cómo
   conseguirlo: una lista vacía sin explicación se lee como un error. */
export function Vacio({ children, accion }: { children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="tarjeta flex flex-col items-start gap-3 px-4 py-6">
      <p className="max-w-[60ch] text-sm text-gris">{children}</p>
      {accion}
    </div>
  )
}

/* ------------------------------------------------------------------
   Listas. Una fila es una fila en todo el sistema: mismo alto, mismos
   divisores finos, mismo hover.
   ------------------------------------------------------------------ */

export function Lista({ children, escalona = true }: { children: React.ReactNode; escalona?: boolean }) {
  return <ul className={`flex flex-col gap-1.5 ${escalona ? 'escalona' : ''}`}>{children}</ul>
}

export function Fila({
  href,
  children,
  tono,
}: {
  href?: string
  children: React.ReactNode
  tono?: 'normal' | 'alerta' | 'apagado'
}) {
  const borde =
    tono === 'alerta' ? 'border-amarillo' : tono === 'apagado' ? 'border-dashed opacity-70' : ''

  const dentro = `tarjeta flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-3 ${borde}`

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className={`${dentro} transition-[border-color,box-shadow] duration-150
                      hover:border-azul-hondo hover:shadow-[var(--sombra-flotante)]`}
        >
          {children}
        </Link>
      ) : (
        <div className={dentro}>{children}</div>
      )}
    </li>
  )
}

/* El bloque de texto de una fila: título arriba, contexto abajo, los
   dos recortados. Es lo que evita que una fila crezca por un nombre
   largo y rompa la alineación de la columna de al lado. */
export function Cuerpo({ titulo, detalle }: { titulo: React.ReactNode; detalle?: React.ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-base font-medium text-tinta">{titulo}</span>
      {detalle && <span className="cifra block truncate text-2xs text-gris-50">{detalle}</span>}
    </span>
  )
}

/* Una cifra al final de la fila, alineada a la derecha y con ancho
   fijo: sin eso, las columnas de números bailan de fila en fila. */
export function Dato({
  valor,
  nota,
  ancho = 'w-28',
  tono = 'tinta',
}: {
  valor: React.ReactNode
  nota?: React.ReactNode
  ancho?: string
  tono?: 'tinta' | 'verde' | 'rojo' | 'amarillo' | 'gris'
}) {
  const color = {
    tinta: 'text-tinta',
    verde: 'text-verde',
    rojo: 'text-rojo',
    amarillo: 'text-amarillo',
    gris: 'text-gris',
  }[tono]

  return (
    <span className={`${ancho} shrink-0 text-right`}>
      <span className={`cifra block text-sm font-medium ${color}`}>{valor}</span>
      {nota && <span className="block text-2xs text-gris-50">{nota}</span>}
    </span>
  )
}

/* Un par rótulo-valor apretado, para las tiras de cifras dentro de una
   fila. Distinto de `Dato`: ése alinea a la derecha en una columna,
   éste se apila y fluye. */
export function Par({
  titulo,
  valor,
  tono = 'tinta',
}: {
  titulo: string
  valor: React.ReactNode
  tono?: 'tinta' | 'verde' | 'rojo' | 'amarillo' | 'naranja' | 'gris' | 'azul'
}) {
  const color = {
    tinta: 'text-tinta',
    verde: 'text-verde',
    rojo: 'text-rojo',
    amarillo: 'text-amarillo',
    naranja: 'text-naranja',
    gris: 'text-gris',
    azul: 'text-azul-hondo',
  }[tono]

  return (
    <span className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-gris-50">{titulo}</span>
      <span className={`cifra font-medium ${color}`}>{valor}</span>
    </span>
  )
}

/* ------------------------------------------------------------------
   Marcas chicas.
   ------------------------------------------------------------------ */

export function Chip({
  tono = 'gris',
  children,
}: {
  tono?: 'gris' | 'azul' | 'verde' | 'amarillo' | 'rojo' | 'violeta'
  children: React.ReactNode
}) {
  const traje = {
    gris: 'border-linea-fuerte text-gris-50',
    azul: 'border-azul-hondo text-azul-hondo',
    verde: 'border-verde text-verde',
    amarillo: 'border-amarillo text-amarillo',
    rojo: 'border-rojo text-rojo',
    violeta: 'border-violeta-50 text-violeta-50',
  }[tono]

  return (
    <span className={`rounded-full border px-2 py-px text-[10px] tracking-wide ${traje}`}>
      {children}
    </span>
  )
}

export function Punto({ color }: { color: string }) {
  const fondo =
    {
      verde: 'bg-verde',
      amarillo: 'bg-amarillo',
      gris: 'bg-gris-25',
      naranja: 'bg-naranja',
      rojo: 'bg-rojo',
      azul: 'bg-azul',
    }[color] ?? 'bg-gris-25'

  return <span className={`size-2 shrink-0 rounded-full ${fondo}`} aria-hidden />
}

/* ------------------------------------------------------------------
   La barra de pestañas.

   Estaba escrita dos veces —en el componente de pestañas y a mano en el
   historial— con subrayados de distinto grosor. Es la pieza, no el
   comportamiento: quién guarda cuál está activa lo decide cada pantalla.
   ------------------------------------------------------------------ */

export function BarraSolapas<T extends string>({
  solapas,
  activa,
  alElegir,
}: {
  solapas: { clave: T; texto: string; señal?: number }[]
  activa: T
  alElegir: (clave: T) => void
}) {
  return (
    <div role="tablist" className="riel flex gap-1 overflow-x-auto border-b border-linea">
      {solapas.map((s) => {
        const aca = s.clave === activa
        return (
          <button
            key={s.clave}
            type="button"
            role="tab"
            aria-selected={aca}
            onClick={() => alElegir(s.clave)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm
                        transition-colors duration-150 ${
                          aca
                            ? 'border-azul-hondo font-medium text-tinta'
                            : 'border-transparent text-gris hover:text-tinta'
                        }`}
          >
            {s.texto}
            {s.señal !== undefined && s.señal > 0 && (
              <span
                className={`cifra rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  aca ? 'bg-azul-aire text-azul-hondo' : 'bg-panel text-gris-50'
                }`}
              >
                {s.señal}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------
   El plegable.

   Para lo que ya cerró: ocupa lugar en el escritorio y casi nunca se
   mira, pero tiene que seguir a mano. Arranca cerrado y muestra cuántos
   hay, que es lo único que hace falta saber sin abrirlo.

   La animación usa `grid-template-rows` de 0fr a 1fr en vez de una
   altura fija: así se abre suave sin tener que medir el contenido, y
   funciona igual con tres tarjetas que con treinta.
   ------------------------------------------------------------------ */

export function Plegable({
  titulo,
  cuantos,
  ayuda,
  punto,
  resaltado,
  children,
  alSoltar,
  alPasarEncima,
  alSalir,
}: {
  titulo: string
  cuantos: number
  ayuda?: string
  punto?: React.ReactNode
  /* Cuando algo se está arrastrando encima: el plegable sigue siendo un
     destino válido aunque esté cerrado. */
  resaltado?: boolean
  children: React.ReactNode
  alSoltar?: () => void
  alPasarEncima?: (e: React.DragEvent) => void
  alSalir?: () => void
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <div
      onDragOver={alPasarEncima}
      onDragLeave={alSalir}
      onDrop={alSoltar}
      className={`overflow-hidden rounded-[var(--radius-tarjeta)] border transition-colors
                  duration-200 ${
                    resaltado ? 'border-azul bg-azul-aire' : 'border-linea bg-panel'
                  }`}
    >
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors
                   duration-150 hover:bg-superficie"
      >
        <svg
          viewBox="0 0 16 16"
          className={`size-3.5 shrink-0 text-gris-50 transition-transform duration-200
                      ease-(--ease-salida) ${abierto ? 'rotate-0' : '-rotate-90'}`}
          fill="none"
          aria-hidden
        >
          <path
            d="M4 6.2 8 10l4-3.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {punto}

        <span className="text-sm font-medium text-tinta">{titulo}</span>
        <span className="cifra rounded-full bg-superficie px-1.5 py-0.5 text-2xs text-gris-50">
          {cuantos}
        </span>

        {ayuda && !abierto && (
          <span className="hidden truncate text-2xs text-gris-50 sm:inline">{ayuda}</span>
        )}

        {resaltado && (
          <span className="ml-auto text-2xs font-medium text-azul-hondo">Soltalo acá</span>
        )}
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-(--ease-salida)"
        style={{ gridTemplateRows: abierto ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-linea p-3">{children}</div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   Avisos. Tres tonos y ninguno tapa la pantalla: un mensaje que hay que
   cerrar para seguir trabajando interrumpe más de lo que informa.
   ------------------------------------------------------------------ */

export function Aviso({
  tono,
  children,
  accion,
}: {
  tono: 'bien' | 'ojo' | 'mal' | 'dato'
  children: React.ReactNode
  accion?: React.ReactNode
}) {
  const traje = {
    bien: 'border-verde bg-verde-aire',
    ojo: 'border-amarillo bg-amarillo-aire',
    mal: 'border-rojo bg-rojo-aire',
    dato: 'border-azul bg-azul-aire',
  }[tono]

  return (
    <div
      className={`surge flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-tarjeta)]
                  border px-4 py-2.5 text-sm text-tinta ${traje}`}
    >
      <span className="max-w-[70ch]">{children}</span>
      {accion}
    </div>
  )
}

/* ------------------------------------------------------------------
   Formularios. Los campos comparten la clase `.campo` de globals, así
   que acá solo está la forma: rótulo arriba, ayuda abajo.
   ------------------------------------------------------------------ */

export function Etiqueta({
  texto,
  ayuda,
  ancho = '',
  children,
}: {
  texto: string
  ayuda?: React.ReactNode
  ancho?: string
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-0.5 ${ancho}`}>
      <span className="rotulo">{texto}</span>
      {children}
      {ayuda && <span className="text-2xs text-gris-50">{ayuda}</span>}
    </label>
  )
}

/* El formulario que se despliega dentro de una pantalla, en vez de un
   modal. No tapa lo que estabas mirando, que suele ser justo el dato
   que necesitás para completarlo. */
export function Formulario({
  children,
  onSubmit,
  action,
}: {
  children: React.ReactNode
  onSubmit?: (e: React.FormEvent) => void
  action?: (fd: FormData) => void
}) {
  return (
    <form
      onSubmit={onSubmit}
      action={action}
      className="surge flex flex-wrap items-end gap-2.5 rounded-[var(--radius-tarjeta)]
                 border border-azul bg-azul-aire p-3.5"
    >
      {children}
    </form>
  )
}
