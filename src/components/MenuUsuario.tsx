'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ------------------------------------------------------------------
   El menú de la persona.

   Antes las iniciales llevaban derecho a cambiar la contraseña, que es
   una de las dos cosas que uno busca ahí — y la menos frecuente. La
   otra, salir, no estaba en ningún lado: se cerraba sesión borrando
   cookies o esperando que venciera.

   Un sistema donde no se puede salir es un problema real cuando dos
   personas comparten una computadora, que en una agencia pasa seguido.
   ------------------------------------------------------------------ */

export default function MenuUsuario({
  nombre,
  roles,
  iniciales,
}: {
  nombre: string
  roles: string[]
  iniciales: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function afuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  async function salir() {
    setSaliendo(true)
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={`${nombre} — abrir menú`}
        className="flex items-center gap-2 rounded-md py-1 pr-1 pl-2 transition-colors duration-150
                   hover:bg-superficie"
      >
        <span className="hidden min-w-0 text-right leading-tight sm:block">
          <span className="block truncate text-sm font-medium text-tinta">{nombre}</span>
          <span className="block truncate text-2xs text-gris-50">
            {roles.map((r) => r.replace(/_/g, ' ')).join(' · ') || 'sin rol'}
          </span>
        </span>
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full bg-azul-hondo
                     text-2xs font-bold text-white"
          aria-hidden
        >
          {iniciales}
        </span>
      </button>

      {abierto && (
        <div
          className="surge absolute right-0 z-(--z-desplegable) mt-2 flex w-60 flex-col
                     overflow-hidden rounded-lg border border-linea bg-superficie
                     shadow-[0_6px_24px_-8px_oklch(0.232_0.003_106/0.22)]"
        >
          <span className="flex flex-col gap-0.5 border-b border-linea px-3.5 py-2.5 sm:hidden">
            <span className="text-sm font-medium text-tinta">{nombre}</span>
            <span className="text-2xs text-gris-50">
              {roles.map((r) => r.replace(/_/g, ' ')).join(' · ') || 'sin rol'}
            </span>
          </span>

          <Link
            href="/clave"
            onClick={() => setAbierto(false)}
            className="px-3.5 py-2.5 text-sm text-gris transition-colors duration-150
                       hover:bg-panel hover:text-tinta"
          >
            Cambiar la contraseña
          </Link>

          <button
            type="button"
            disabled={saliendo}
            onClick={salir}
            className="border-t border-linea px-3.5 py-2.5 text-left text-sm text-gris
                       transition-colors duration-150 hover:bg-rojo-aire hover:text-rojo
                       disabled:opacity-50"
          >
            {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      )}
    </div>
  )
}
