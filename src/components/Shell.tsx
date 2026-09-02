import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const SECCIONES = [
  { href: '/tablero',     nombre: 'Tablero',     detalle: 'Lo que está en curso' },
  { href: '/pipeline',    nombre: 'Pipeline',    detalle: 'Lo enviado y por seguir' },
  { href: '/cuentas',     nombre: 'Cuentas',     detalle: 'Los clientes' },
  { href: '/mi-posicion', nombre: 'Mi posición', detalle: 'Mi plata' },
]

export default async function Shell({
  children,
  activo,
}: {
  children: React.ReactNode
  activo: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('usuarios')
    .select('personas(nombre, roles)')
    .eq('id', user?.id ?? '')
    .single()

  const yo = data?.personas as unknown as { nombre: string; roles: string[] } | undefined

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-linea bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3">
          <Link
            href="/tablero"
            className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-violeta"
          >
            Crossity
          </Link>

          <nav className="flex flex-1 flex-wrap gap-x-6 gap-y-1">
            {SECCIONES.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                title={s.detalle}
                className={`text-sm transition-colors ${
                  activo === s.href
                    ? 'font-semibold text-tinta'
                    : 'text-tinta-2 hover:text-tinta'
                }`}
              >
                {s.nombre}
              </Link>
            ))}
          </nav>

          {yo && (
            <div className="text-right leading-tight">
              <p className="text-[13px] font-medium">{yo.nombre}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-tinta-3">
                {yo.roles.map((r) => r.replace(/_/g, ' ')).join(' · ') || 'sin rol'}
              </p>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-9">{children}</main>
    </div>
  )
}
