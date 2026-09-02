import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const NAVEGACION = [
  {
    grupo: 'Trabajo',
    items: [
      { href: '/hoy',      nombre: 'Hoy',       detalle: 'lo que necesita atención' },
      { href: '/tablero',  nombre: 'Proyectos', detalle: 'todo lo que está en curso' },
      { href: '/pipeline', nombre: 'Pipeline',  detalle: 'lo enviado y por seguir' },
    ],
  },
  {
    grupo: 'Relación',
    items: [{ href: '/cuentas', nombre: 'Cuentas', detalle: 'los clientes' }],
  },
  {
    grupo: 'Plata',
    items: [{ href: '/mi-posicion', nombre: 'Mi posición', detalle: 'lo que me toca' }],
  },
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
    .maybeSingle()

  const yo = data?.personas as unknown as { nombre: string; roles: string[] } | undefined
  const iniciales = yo?.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('') ?? '?'

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside
        className="flex shrink-0 flex-col gap-6 border-b border-linea bg-panel px-4 py-4
                   lg:sticky lg:top-0 lg:h-dvh lg:w-56 lg:border-r lg:border-b-0 lg:py-6"
      >
        <Link
          href="/hoy"
          className="px-2 text-2xs font-semibold uppercase tracking-[0.2em] text-violeta"
        >
          Crossity
        </Link>

        <nav className="flex flex-1 flex-wrap gap-x-6 gap-y-5 lg:flex-col lg:flex-nowrap">
          {NAVEGACION.map((seccion) => (
            <div key={seccion.grupo} className="flex flex-col gap-0.5">
              <span className="px-2 pb-1 text-2xs font-medium uppercase tracking-wider text-tinta-3">
                {seccion.grupo}
              </span>
              {seccion.items.map((item) => {
                const aca = activo === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.detalle}
                    aria-current={aca ? 'page' : undefined}
                    className={`rounded-md px-2 py-1.5 text-base transition-colors duration-150 ${
                      aca
                        ? 'bg-violeta-suave font-medium text-violeta-fuerte'
                        : 'text-tinta-2 hover:bg-superficie hover:text-tinta'
                    }`}
                  >
                    {item.nombre}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {yo && (
          <div className="flex items-center gap-2.5 border-t border-linea px-2 pt-4">
            <span
              className="grid size-7 shrink-0 place-items-center rounded-full bg-violeta
                         text-2xs font-semibold text-white"
              aria-hidden
            >
              {iniciales}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-medium">{yo.nombre}</span>
              <span className="block truncate text-2xs text-tinta-3">
                {yo.roles.map((r) => r.replace(/_/g, ' ')).join(' · ') || 'sin rol'}
              </span>
            </span>
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1 px-5 py-7 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}

export function Titulo({
  seccion,
  children,
  bajada,
  acciones,
}: {
  seccion: string
  children: React.ReactNode
  bajada?: React.ReactNode
  acciones?: React.ReactNode
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-linea pb-5">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-2xs font-medium uppercase tracking-wider text-tinta-3">
          {seccion}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{children}</h1>
        {bajada && <p className="max-w-[65ch] text-base text-tinta-2">{bajada}</p>}
      </div>
      {acciones}
    </header>
  )
}
