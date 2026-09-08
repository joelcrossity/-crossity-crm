import Link from 'next/link'
import Shell, { Titulo } from '@/components/Shell'
import { Marco, Barras, Columnas, Embudo, Cifra } from '@/components/Grafico'
import { createClient } from '@/lib/supabase/server'
import { ETAPAS, plata } from '@/lib/estados'

type Fila = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  color: string
  fecha_comprometida: string | null
  responsable: string | null
  dias_sin_novedades: number
  dias_de_atraso: number | null
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export default async function Hoy() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: cuenta } = await supabase
    .from('usuarios')
    .select('personas(nombre, roles)')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const yo = cuenta?.personas as unknown as { nombre: string; roles: string[] } | undefined
  const roles = yo?.roles ?? []
  const esDireccion = roles.includes('direccion')
  const esAdmin = roles.includes('administracion')
  const esComercial = roles.includes('vendedor') || roles.includes('project_manager')

  const [
    { data: proyectos },
    { data: pipeline },
    { data: hitos },
    { data: cuentas },
    { data: filasEtapas },
  ] = await Promise.all([
      supabase.from('v_tablero').select('*'),
      supabase.from('v_pipeline').select('etapa, monto_neto, moneda, sin_agendar, seguimiento_vencido'),
      supabase.from('hitos').select('monto_neto, moneda, facturado_at, cobrado_at'),
      supabase.from('v_cuenta').select('*'),
      supabase.from('etapas').select('clave, etiqueta').eq('activa', true).eq('es_final', false).order('orden'),
    ])

  const filas = (proyectos ?? []) as Fila[]
  const vivos = filas.filter((f) => f.color === 'verde')
  const frenados = vivos
    .filter((f) => f.dias_sin_novedades > 7)
    .sort((a, b) => b.dias_sin_novedades - a.dias_sin_novedades)
  const atrasados = vivos
    .filter((f) => (f.dias_de_atraso ?? -1) > 0)
    .sort((a, b) => (b.dias_de_atraso ?? 0) - (a.dias_de_atraso ?? 0))
  const incompletos = vivos.filter((f) => !f.fecha_comprometida || !f.responsable)

  // Facturado y cobrado por mes, últimos seis, en pesos.
  const hoy = new Date()
  const ventana = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1)
    return { clave: `${d.getFullYear()}-${d.getMonth()}`, mes: MESES[d.getMonth()] }
  })
  const acumulado = new Map(ventana.map((v) => [v.clave, { facturado: 0, cobrado: 0 }]))

  let porCobrar = 0
  for (const h of (hitos ?? []) as Record<string, unknown>[]) {
    if (h.moneda !== 'ARS') continue
    const monto = (h.monto_neto as number) ?? 0
    for (const [campo, fecha] of [
      ['facturado', h.facturado_at],
      ['cobrado', h.cobrado_at],
    ] as const) {
      if (!fecha) continue
      const d = new Date(fecha as string)
      const c = acumulado.get(`${d.getFullYear()}-${d.getMonth()}`)
      if (c) c[campo] += monto
    }
    if (h.facturado_at && !h.cobrado_at) porCobrar += monto
  }
  const meses = ventana.map((v) => ({ mes: v.mes, ...acumulado.get(v.clave)! }))
  const hayMovimiento = meses.some((m) => m.facturado > 0 || m.cobrado > 0)

  // Embudo
  const ops = (pipeline ?? []) as Record<string, unknown>[]
  const lasEtapas =
    (filasEtapas ?? []).length > 0
      ? (filasEtapas as { clave: string; etiqueta: string }[]).map((e) => ({
          valor: e.clave,
          etiqueta: e.etiqueta,
        }))
      : ETAPAS.map((e) => ({ valor: e.valor as string, etiqueta: e.etiqueta as string }))

  const embudo = lasEtapas.map((e) => {
    const de = ops.filter((o) => o.etapa === e.valor)
    return {
      etapa: e.etiqueta,
      cantidad: de.length,
      valor: de.reduce((s, o) => s + (o.moneda === 'ARS' ? ((o.monto_neto as number) ?? 0) : 0), 0),
      moneda: 'ARS',
    }
  })
  const sinAgendar = ops.filter((o) => o.sin_agendar).length

  // Peso de cada cliente
  const porCuenta = ((cuentas ?? []) as Record<string, unknown>[])
    .map((c) => ({
      nombre: c.cuenta as string,
      valor: (c.en_vivo as number) + (c.abonos as number),
      nota: `${c.proyectos_totales} en total`,
    }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)

  const nombre = yo?.nombre.split(' ')[0] ?? ''

  return (
    <Shell activo="/hoy">
      <Titulo
        seccion={`Hola, ${nombre}`}
        bajada={
          esDireccion
            ? 'La plata primero, y abajo lo que pide una decisión tuya.'
            : esAdmin
              ? 'Cobranza y carga. Abajo, lo que falta completar.'
              : 'Tus proyectos y tu pipeline.'
        }
        acciones={
          <Link
            href="/charla"
            className="flex items-center gap-2 rounded-md bg-azul-hondo px-3.5 py-2 text-sm
                       font-medium text-white transition-colors duration-150 hover:bg-azul"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
              <path
                d="M8 3.5v9M3.5 8h9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Anotar una charla
          </Link>
        }
      >
        {esDireccion ? 'Cómo viene la empresa' : esAdmin ? 'Qué hay para cobrar' : 'Qué necesita atención'}
      </Titulo>

      <div className="flex flex-col gap-9">
        {(esDireccion || esAdmin) && (
          <section className="grid gap-6 sm:grid-cols-4">
            <Cifra valor={String(vivos.length)} titulo="en vivo" nota="se trabajan ahora" tono="verde" href="/tablero" />
            <Cifra
              valor={plata(porCobrar)}
              titulo="por cobrar"
              nota="facturado y sin entrar"
              tono={porCobrar > 0 ? 'rojo' : 'tinta'}
              href="/admin"
            />
            <Cifra
              valor={String(ops.length)}
              titulo="en pipeline"
              nota={sinAgendar > 0 ? `${sinAgendar} sin seguimiento agendado` : 'todas con seguimiento'}
              tono={sinAgendar > 0 ? 'amarillo' : 'tinta'}
              href="/pipeline"
            />
            <Cifra
              valor={String(frenados.length)}
              titulo="frenados"
              nota="más de 7 días sin novedades"
              tono={frenados.length > 0 ? 'rojo' : 'verde'}
              href="/tablero"
            />
          </section>
        )}

        {(esDireccion || esAdmin) && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Marco
              titulo="Cuánto entra por mes"
              detalle="Últimos seis meses, en pesos"
              hayDatos={hayMovimiento}
              vacio="Todavía no hay entregas facturadas. Se llena solo a medida que se marquen en cada proyecto."
            >
              <Columnas meses={meses} />
            </Marco>

            <Marco
              titulo="Cómo viene el embudo"
              detalle={`${ops.length} oportunidades abiertas`}
              hayDatos={ops.length > 0}
              vacio="No hay oportunidades en el pipeline."
              pie={
                sinAgendar > 0 ? (
                  <p className="text-2xs text-amarillo">
                    {sinAgendar} sin próximo seguimiento agendado: están abandonadas aunque figuren
                    activas.
                  </p>
                ) : null
              }
            >
              <Embudo etapas={embudo} />
            </Marco>
          </section>
        )}

        {esDireccion && (
          <Marco
            titulo="Peso de cada cliente"
            detalle="Proyectos vivos y abonos por cuenta"
            hayDatos={porCuenta.length > 0}
            vacio="Todavía no hay clientes con proyectos activos."
          >
            <Barras datos={porCuenta} serie={2} sufijo="activos" />
          </Marco>
        )}

        {(esDireccion || esComercial) && (
          <>
            <Bloque
              pregunta="Se están cayendo"
              porque="Más de una semana sin que nadie cargue una novedad. No significa que estén parados: significa que nadie sabe."
              filas={frenados}
              vacio="Todos los proyectos en vivo tuvieron novedades esta semana."
              urgente
              columna={(f) => (
                <span className="cifra shrink-0 text-sm font-bold text-rojo">
                  {f.dias_sin_novedades} días
                </span>
              )}
            />
            <Bloque
              pregunta="Pasaron la fecha"
              porque="La entrega comprometida venció y el proyecto sigue en vivo."
              filas={atrasados}
              vacio="Ninguno pasó su fecha de entrega."
              urgente
              columna={(f) => (
                <span className="cifra shrink-0 text-sm font-bold text-rojo">
                  {f.dias_de_atraso} días tarde
                </span>
              )}
            />
          </>
        )}

        {incompletos.length > 0 && (
          <section className="flex flex-col gap-2.5 border-t border-linea pt-7">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-md font-bold tracking-tight">Falta cargarles algo</h2>
              <span className="cifra rounded-full bg-amarillo-aire px-1.5 py-0.5 text-2xs font-medium text-amarillo">
                {incompletos.length}
              </span>
            </div>
            <p className="max-w-[65ch] text-sm text-gris">
              Sin fecha o sin responsable, nadie puede priorizar solo y todo vuelve a vos. Se
              completan de corrido en administración.
            </p>
            <Link
              href="/admin"
              className="w-fit rounded-md bg-azul-hondo px-3.5 py-1.5 text-sm font-medium text-white
                         transition-colors duration-150 hover:bg-azul"
            >
              Completar los {incompletos.length}
            </Link>
          </section>
        )}
      </div>
    </Shell>
  )
}

function Bloque({
  pregunta,
  porque,
  filas,
  vacio,
  columna,
  urgente,
}: {
  pregunta: string
  porque: string
  filas: Fila[]
  vacio: string
  columna: (f: Fila) => React.ReactNode
  urgente?: boolean
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-md font-bold tracking-tight">{pregunta}</h2>
        <span
          className={`cifra rounded-full px-1.5 py-0.5 text-2xs font-medium ${
            filas.length === 0
              ? 'bg-verde-aire text-verde'
              : urgente
                ? 'bg-rojo-aire text-rojo'
                : 'bg-amarillo-aire text-amarillo'
          }`}
        >
          {filas.length}
        </span>
        <p className="w-full max-w-[65ch] text-sm text-gris">{porque}</p>
      </div>

      {filas.length === 0 ? (
        <p className="rounded-lg border border-linea bg-superficie px-3.5 py-3 text-sm text-gris">
          {vacio}
        </p>
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-lg border border-linea bg-superficie">
          {filas.map((f) => (
            <li key={f.id}>
              <Link
                href={`/proyecto/${f.codigo}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3.5 py-2.5
                           transition-colors duration-150 hover:bg-panel"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-tinta">{f.nombre}</span>
                  <span className="cifra block truncate text-2xs text-gris-50">
                    {f.codigo} · {f.cliente}
                    {f.responsable ? ` · ${f.responsable}` : ' · sin responsable'}
                  </span>
                </span>
                {columna(f)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
