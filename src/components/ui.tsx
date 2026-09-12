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
