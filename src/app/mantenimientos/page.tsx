import Link from 'next/link'
import SinAcceso from '@/components/SinAcceso'
import { puedeVer } from '@/lib/permisos'
import Shell, { Titulo } from '@/components/Shell'
import { createClient } from '@/lib/supabase/server'
import { plata, fechaCorta } from '@/lib/estados'
import NuevoAbono from '@/components/NuevoAbono'

/* ------------------------------------------------------------------
   Los mantenimientos.

   Estaban repartidos entre Proyectos —donde se mezclan con el trabajo
   que empieza y termina— y la pestaña Caja de administración. Pero un
   abono no se parece a un proyecto: no tiene entrega, no tiene avance,
   y la pregunta que se le hace es otra. No es "cómo viene", es "sigue
   vigente y sigue cobrándose".

   Es también la parte de la empresa que no depende de vender de nuevo,
   así que merece mirarse sola.
   ------------------------------------------------------------------ */

type Abono = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  monto_mensual: number | null
  moneda: string
  vigencia_desde: string | null
  vigencia_hasta: string | null
  renovacion_automatica: boolean
  color: string
  viene_de: string | null
  vence_pronto: boolean
}

const NOMBRE: Record<string, { texto: string; punto: string }> = {
  verde: { texto: 'Vigente', punto: 'bg-verde' },
  amarillo: { texto: 'A seguir', punto: 'bg-amarillo' },
  gris: { texto: 'Pausado', punto: 'bg-gris-50' },
  naranja: { texto: 'Terminado', punto: 'bg-naranja' },
}

export default async function Mantenimientos() {
  const supabase = await createClient()

  const { data: { user: quien } } = await supabase.auth.getUser()
  const { data: miFicha } = await supabase
    .from('usuarios')
    .select('personas(roles)')
    .eq('id', quien?.id ?? '')
    .maybeSingle()
  const misRoles = (miFicha?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []

  if (!puedeVer('/mantenimientos', misRoles))
    return (
      <Shell activo="/mantenimientos">
        <SinAcceso que="Mantenimiento" />
      </Shell>
    )

  const [
    { data: abonos },
    { data: pulso },
    { data: cuentas },
    { data: personas },
    { data: servicios },
    { data: hoyRow },
  ] = await Promise.all([
    supabase.from('v_recurrentes').select('*').order('cliente'),
    supabase.from('v_pulso').select('id, dias_sin_novedades'),
    supabase.from('v_cuenta').select('id, cuenta').order('cuenta'),
    supabase.from('personas').select('id, nombre').eq('activa', true).order('nombre'),
    supabase.from('servicios').select('id, nombre').eq('activo', true).order('orden'),
    supabase.rpc('hoy_es'),
  ])

  const filas = (abonos ?? []) as Abono[]
  const vigentes = filas.filter((a) => a.color === 'verde')

  /* Cada moneda por separado y no convertida a pesos: un abono en
     dólares es una cobertura, y esconderlo dentro de un total en pesos
     borra justamente la información por la que se cobra en dólares. */
  const porMoneda = new Map<string, number>()
  for (const a of vigentes) {
    const m = a.moneda ?? 'ARS'
    porMoneda.set(m, (porMoneda.get(m) ?? 0) + Number(a.monto_mensual ?? 0))
  }
  const monedas = [...porMoneda.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => (a[0] === 'ARS' ? -1 : b[0] === 'ARS' ? 1 : a[0].localeCompare(b[0])))
  const vencen = filas.filter((a) => a.vence_pronto && a.color === 'verde')

  const dias = new Map(
    ((pulso ?? []) as Record<string, unknown>[]).map((p) => [
      p.id as string,
      (p.dias_sin_novedades as number) ?? 0,
    ]),
  )

  return (
    <Shell activo="/mantenimientos">
      <Titulo
        seccion="Mantenimiento"
        bajada="Lo que entra todos los meses sin volver a vender. A un abono no se le pregunta cómo viene: se le pregunta si sigue vigente y si se está cobrando."
        acciones={
          <NuevoAbono
            clientes={((cuentas ?? []) as Record<string, unknown>[]).map((c) => ({
              id: c.id as string,
              nombre: c.cuenta as string,
            }))}
            personas={(personas ?? []) as { id: string; nombre: string }[]}
            servicios={(servicios ?? []) as { id: string; nombre: string }[]}
            hoy={(hoyRow as string) ?? ''}
          />
        }
      >
        {vigentes.length} abonos vigentes
      </Titulo>

      <div className="flex flex-col gap-9">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {monedas.length === 0 ? (
            <Dato rotulo="Por mes" valor={plata(0)} nota="todavía sin abonos vigentes" />
          ) : (
            monedas.map(([moneda, total]) => (
              <Dato
                key={moneda}
                rotulo={`Por mes en ${moneda}`}
                valor={plata(total, moneda)}
                nota={`${plata(total * 12, moneda)} al año si ninguno se cae`}
              />
            ))
          )}
          <Dato
            rotulo="Vencen pronto"
            valor={String(vencen.length)}
            nota="en los próximos 60 días"
            alarma={vencen.length > 0}
          />
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-md font-bold tracking-tight">Los abonos</h2>

          {filas.length === 0 ? (
            <p className="tarjeta px-3.5 py-3 text-sm text-gris">
              Todavía no hay ninguno. Se abren desde la ficha de un proyecto terminado.
            </p>
          ) : (
            <ul className="escalona flex flex-col gap-1.5">
              {filas.map((a) => {
                const e = NOMBRE[a.color] ?? NOMBRE.gris
                const frenado = a.color === 'verde' && (dias.get(a.id) ?? 0) > 45
                return (
                  <li key={a.id}>
                    <Link
                      href={`/proyecto/${a.codigo}`}
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border
                                 border-linea bg-superficie px-3.5 py-2.5 transition-colors
                                 duration-150 hover:border-azul"
                    >
                      <span className="flex min-w-0 flex-1 items-baseline gap-2">
                        <span className={`size-2 shrink-0 self-center rounded-full ${e.punto}`} aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-base font-medium text-tinta">
                            {a.cliente}
                          </span>
                          <span className="cifra block truncate text-2xs text-gris-50">
                            {a.nombre}
                            {a.viene_de && ` · sale de ${a.viene_de}`}
                            {a.vigencia_desde && ` · desde ${fechaCorta(a.vigencia_desde)}`}
                          </span>
                        </span>
                      </span>

                      <span className="shrink-0 text-right">
                        <span className="cifra block text-sm font-bold text-tinta">
                          {plata(a.monto_mensual)}
                          <span className="text-2xs font-normal text-gris-50"> /mes</span>
                        </span>
                        <span className="cifra block text-2xs">
                          {a.vence_pronto ? (
                            <span className="font-medium text-amarillo">
                              vence {fechaCorta(a.vigencia_hasta)}
                            </span>
                          ) : a.renovacion_automatica ? (
                            <span className="text-verde">renueva solo</span>
                          ) : (
                            <span className="text-gris-50">{e.texto}</span>
                          )}
                        </span>
                      </span>

                      {frenado && (
                        <span className="cifra w-24 shrink-0 text-right text-2xs font-medium text-rojo">
                          {dias.get(a.id)} días sin novedades
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

      </div>
    </Shell>
  )
}

function Dato({
  rotulo,
  valor,
  nota,
  alarma,
}: {
  rotulo: string
  valor: string
  nota: string
  alarma?: boolean
}) {
  return (
    <div className="surge flex flex-col gap-0.5 tarjeta p-3.5">
      <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">{rotulo}</span>
      <span className={`cifra text-xl font-bold ${alarma ? 'text-amarillo' : 'text-tinta'}`}>
        {valor}
      </span>
      <span className="text-2xs text-gris-50">{nota}</span>
    </div>
  )
}
