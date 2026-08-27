import { createClient } from '@/lib/supabase/server'

type Fila = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  cliente_codigo: string
  color: 'verde' | 'amarillo' | 'gris' | 'rojo'
  subestado: string | null
  motivo_gris: string | null
  prioridad: number | null
  fecha_comprometida: string | null
  es_producto_propio: boolean
  responsable: string | null
  dias_sin_novedades: number
}

const ETIQUETA_SUB: Record<string, string> = {
  en_curso: 'en curso',
  bloqueado: 'bloqueado',
  esperando_cliente: 'esperando cliente',
  esperando_anticipo: 'esperando anticipo',
  pausado_cliente: 'pausado por el cliente',
  dormido: 'dormido',
}

const GRUPOS = [
  { color: 'verde', titulo: 'En vivo', ayuda: 'Se está trabajando ahora' },
  { color: 'amarillo', titulo: 'Enviado, hay que seguirlo', ayuda: 'La pelota está del otro lado' },
  { color: 'gris', titulo: 'Standby', ayuda: 'Ni muerto ni vivo' },
  { color: 'rojo', titulo: 'Cerrados', ayuda: 'Fuera del tablero' },
] as const

const PUNTO: Record<string, string> = {
  verde: 'bg-verde',
  amarillo: 'bg-amarillo',
  gris: 'bg-gris-estado',
  rojo: 'bg-rojo',
}

export default async function Tablero() {
  const supabase = await createClient()

  const [{ data: { user } }, { data: proyectos }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('v_tablero').select('*').order('cliente'),
  ])

  const { data: persona } = await supabase
    .from('usuarios')
    .select('personas(nombre, roles)')
    .eq('id', user?.id ?? '')
    .single()

  const yo = persona?.personas as unknown as { nombre: string; roles: string[] } | undefined
  const filas = (proyectos ?? []) as Fila[]

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-linea pb-5">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-tinta-3">
            Crossity · tablero
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">
            {filas.filter((f) => f.color === 'verde').length} proyectos en vivo
          </h1>
        </div>
        {yo && (
          <div className="text-right">
            <p className="text-sm font-medium">{yo.nombre}</p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-tinta-3">
              {yo.roles.join(' · ').replace(/_/g, ' ') || 'sin rol'}
            </p>
          </div>
        )}
      </header>

      {GRUPOS.map((grupo) => {
        const delGrupo = filas.filter((f) => f.color === grupo.color)
        if (delGrupo.length === 0) return null

        return (
          <section key={grupo.color} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span className={`size-2 rounded-full ${PUNTO[grupo.color]}`} aria-hidden />
              <h2 className="text-base font-semibold tracking-tight">{grupo.titulo}</h2>
              <span className="font-mono text-[11px] uppercase tracking-wider text-tinta-3">
                {delGrupo.length} · {grupo.ayuda}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-linea bg-white">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-linea">
                    {['Proyecto', 'Estado', 'Responsable', 'Entrega', 'Sin novedades'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-tinta-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {delGrupo.map((f) => (
                    <tr key={f.id} className="border-b border-linea last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold tracking-tight">
                            {f.nombre}
                            {f.es_producto_propio && (
                              <span className="ml-2 rounded-full border border-violeta px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-violeta">
                                producto propio
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-[11px] text-tinta-3">
                            {f.codigo} · {f.cliente}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-tinta-2">
                        {ETIQUETA_SUB[f.subestado ?? f.motivo_gris ?? ''] ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-tinta-2">{f.responsable ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-[13px] tabular-nums text-tinta-2">
                        {f.fecha_comprometida
                          ? new Date(f.fecha_comprometida + 'T00:00:00').toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: 'short',
                            })
                          : <span className="text-rojo">sin fecha</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px] tabular-nums">
                        <span className={f.dias_sin_novedades > 7 ? 'font-semibold text-rojo' : 'text-tinta-2'}>
                          {f.dias_sin_novedades} {f.dias_sin_novedades === 1 ? 'día' : 'días'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </main>
  )
}
