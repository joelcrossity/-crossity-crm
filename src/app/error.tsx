'use client'

import Link from 'next/link'

/* ------------------------------------------------------------------
   Cuando una pantalla falla.

   Sin esto, un error en el servidor deja el esqueleto de carga girando
   para siempre: la persona ve "cargando" y no hay forma de saber que
   algo se rompió. Un error visible es mejor que una espera eterna,
   porque al menos se puede reportar.
   ------------------------------------------------------------------ */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="flex w-full max-w-md flex-col items-start gap-4">
        <span className="grid size-10 place-items-center rounded-full bg-rojo-aire text-rojo">
          <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
            <path d="M10 6.5v4.2M10 13.8v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </span>

        <h1 className="text-xl font-bold tracking-tight text-tinta">Se rompió esta pantalla</h1>
        <p className="text-sm text-gris">
          El resto del sistema sigue andando. Si vuelve a pasar, pasame el código de abajo: dice
          exactamente qué falló.
        </p>

        {error.digest && (
          <code className="cifra rounded-[var(--radius-control)] border border-linea bg-panel
                           px-2.5 py-1.5 text-2xs text-gris">
            {error.digest}
          </code>
        )}

        <p className="max-w-full truncate text-2xs text-gris-50">{error.message}</p>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="boton boton-principal">
            Probar de nuevo
          </button>
          <Link href="/hoy" className="boton boton-secundario">
            Ir a Hoy
          </Link>
        </div>
      </div>
    </main>
  )
}
