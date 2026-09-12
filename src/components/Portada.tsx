import Image from 'next/image'

/* ------------------------------------------------------------------
   El marco de las pantallas de entrada.

   Login, invitación y cambio de contraseña son la primera impresión del
   sistema —y para alguien que entra por primera vez, la única que tiene
   antes de decidir si esto se ve serio—. Hasta ahora eran un formulario
   suelto sobre el fondo.

   Va como una tarjeta flotante sobre el lienzo, con el mismo material
   que el resto: el aire alrededor hace el trabajo, no un adorno.
   ------------------------------------------------------------------ */

export default function Portada({
  titulo,
  bajada,
  children,
  pie,
}: {
  titulo: string
  bajada?: React.ReactNode
  children: React.ReactNode
  pie?: React.ReactNode
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      {/* Un halo muy tenue del azul de marca detrás de la tarjeta. Es lo
          único decorativo de la pantalla y se nota apenas: si se notara,
          competiría con el logo. */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2
                   rounded-full opacity-[0.07] blur-3xl"
        style={{ background: 'var(--color-azul)' }}
        aria-hidden
      />

      <div className="surge relative flex w-full max-w-[25rem] flex-col gap-7">
        <div className="tarjeta-flota flex flex-col gap-6 p-7">
          <div className="flex flex-col gap-3">
            <Image
              src="/marca/crossity.png"
              alt="Crossity"
              width={1060}
              height={300}
              priority
              className="h-8 w-auto self-start"
            />
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-bold tracking-tight text-tinta">{titulo}</h1>
              {bajada && <p className="text-sm leading-snug text-gris">{bajada}</p>}
            </div>
          </div>

          {children}
        </div>

        {pie && <div className="px-1 text-center">{pie}</div>}
      </div>
    </main>
  )
}

/* Los campos de las pantallas de entrada son más grandes que los del
   sistema: se escriben una vez, a veces desde el teléfono, y a veces por
   alguien que todavía no confía del todo en lo que está usando. */
export function Campo({
  etiqueta,
  ayuda,
  ...resto
}: { etiqueta: string; ayuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">{etiqueta}</span>
      <input
        {...resto}
        className="rounded-[var(--radius-control)] border border-linea bg-panel px-3.5 py-2.5
                   text-base text-tinta transition-colors duration-150
                   placeholder:text-gris-25 hover:border-linea-fuerte focus:border-azul-hondo
                   focus:bg-superficie focus:outline-none"
      />
      {ayuda && <span className="text-2xs text-gris-50">{ayuda}</span>}
    </label>
  )
}

export function Nota({
  tono,
  children,
}: {
  tono: 'aviso' | 'bien' | 'mal'
  children: React.ReactNode
}) {
  const traje = {
    aviso: 'border-amarillo bg-amarillo-aire',
    bien: 'border-verde bg-verde-aire',
    mal: 'border-rojo bg-rojo-aire',
  }[tono]

  return (
    <p className={`rounded-[var(--radius-control)] border px-3 py-2.5 text-sm text-tinta ${traje}`}>
      {children}
    </p>
  )
}
