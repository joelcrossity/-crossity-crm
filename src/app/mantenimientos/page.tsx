import Link from 'next/link'
import Shell, { Titulo } from '@/components/Shell'
import { createClient } from '@/lib/supabase/server'
import { plata, fechaCorta } from '@/lib/estados'

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
  vigencia_desde: string | null
  vigencia_hasta: string | null
  renovacion_automatica: boolean
  color: string
  viene_de: string | null
  vence_pronto: boolean
}

type Huerfano = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  fecha_comprometida: string | null
}

const NOMBRE: Record<string, { texto: string; punto: string }> = {
  verde: { texto: 'Vigente', punto: 'bg-verde' },
  amarillo: { texto: 'A seguir', punto: 'bg-amarillo' },
  gris: { texto: 'Pausado', punto: 'bg-gris-50' },
  naranja: { texto: 'Terminado', punto: 'bg-naranja' },
}

export default async function Mantenimientos() {
  const supabase = await createClient()

  const [{ data: abonos }, { data: sin }, { data: pulso }] = await Promise.all([
    supabase.from('v_recurrentes').select('*').order('cliente'),
    supabase.from('v_sin_mantenimiento').select('*'),
    supabase.from('v_pulso').select('id, dias_sin_novedades'),
  ])

  const filas = (abonos ?? []) as Abono[]
  const vigentes = filas.filter((a) => a.color === 'verde')
  const mensual = vigentes.reduce((s, a) => s + Number(a.monto_mensual ?? 0), 0)
  const vencen = filas.filter((a) => a.vence_pronto && a.color === 'verde')
  const sinAbono = (sin ?? []) as Huerfano[]

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
      >
        {vigentes.length} abonos vigentes
      </Titulo>

      <div className="flex flex-col gap-9">
        <section className="grid gap-4 sm:grid-cols-3">
          <Dato rotulo="Por mes" valor={plata(mensual)} nota="mientras estén vigentes" />
          <Dato rotulo="Por año" valor={plata(mensual * 12)} nota="si ninguno se cae" />
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
            <p className="rounded-lg border border-linea bg-superficie px-3.5 py-3 text-sm text-gris">
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

        {sinAbono.length > 0 && (
          <section className="flex flex-col gap-2.5 border-t border-linea pt-8">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-md font-bold tracking-tight">Se entregó y no tiene abono</h2>
              <span className="cifra rounded-full bg-amarillo-aire px-1.5 py-0.5 text-2xs font-medium text-amarillo">
                {sinAbono.length}
              </span>
              <p className="w-full max-w-[70ch] text-sm text-gris">
                Es plata recurrente que se pierde por no preguntar a tiempo. El momento de proponerlo
                es al entregar, cuando el trabajo está fresco y el cliente contento.
              </p>
            </div>

            <ul className="escalona flex flex-col gap-1.5">
              {sinAbono.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/proyecto/${h.codigo}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg
                               border border-linea bg-superficie px-3.5 py-2.5 transition-colors
                               duration-150 hover:border-azul"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium text-tinta">
                        {h.nombre}
                      </span>
                      <span className="cifra block truncate text-2xs text-gris-50">{h.cliente}</span>
                    </span>
                    <span className="shrink-0 text-2xs text-azul-hondo">Abrirle el abono →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
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
    <div className="surge flex flex-col gap-0.5 rounded-lg border border-linea bg-superficie p-3.5">
      <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">{rotulo}</span>
      <span className={`cifra text-xl font-bold ${alarma ? 'text-amarillo' : 'text-tinta'}`}>
        {valor}
      </span>
      <span className="text-2xs text-gris-50">{nota}</span>
    </div>
  )
}
