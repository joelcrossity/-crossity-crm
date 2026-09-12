/* ------------------------------------------------------------------
   Esqueletos de carga.

   Una pantalla que aparece entera de golpe cuando el servidor termina
   se siente como una demora sin explicación: no hay forma de saber si
   está cargando o si algo se rompió. El esqueleto contesta eso sin
   decir nada — muestra la forma de lo que viene.

   El pulso es muy suave a propósito. Un esqueleto que late fuerte
   compite con el contenido que está por llegar y cansa.
   ------------------------------------------------------------------ */

export function Barra({ ancho = 'w-full', alto = 'h-4' }: { ancho?: string; alto?: string }) {
  return (
    <span
      className={`block rounded-md bg-panel ${ancho} ${alto}`}
      style={{ animation: 'latir 1.6s var(--ease-suave) infinite' }}
      aria-hidden
    />
  )
}

export function TarjetaCifra() {
  return (
    <div className="tarjeta flex flex-col gap-2.5 p-5">
      <Barra ancho="w-20" alto="h-2.5" />
      <Barra ancho="w-24" alto="h-8" />
      <Barra ancho="w-32" alto="h-2.5" />
    </div>
  )
}

export function Renglones({ cuantos = 5 }: { cuantos?: number }) {
  const anchos = ['w-3/5', 'w-4/6', 'w-1/2', 'w-3/4', 'w-2/5', 'w-5/6']
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: cuantos }, (_, i) => (
        <div key={i} className="tarjeta flex items-center justify-between gap-4 px-4 py-3.5">
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Barra ancho={anchos[i % anchos.length]} alto="h-3.5" />
            <Barra ancho="w-1/4" alto="h-2.5" />
          </span>
          <Barra ancho="w-16" alto="h-3.5" />
        </div>
      ))}
    </div>
  )
}

export default function Esqueleto({
  cifras = 0,
  renglones = 5,
}: {
  cifras?: number
  renglones?: number
}) {
  return (
    <div className="flex flex-col gap-9" role="status" aria-label="Cargando">
      <div className="flex flex-col gap-2.5 border-b border-linea pb-6">
        <Barra ancho="w-24" alto="h-2.5" />
        <Barra ancho="w-72" alto="h-8" />
        <Barra ancho="w-1/2" alto="h-3.5" />
      </div>

      {cifras > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cifras }, (_, i) => (
            <TarjetaCifra key={i} />
          ))}
        </div>
      )}

      <Renglones cuantos={renglones} />
      <span className="sr-only">Cargando…</span>
    </div>
  )
}
