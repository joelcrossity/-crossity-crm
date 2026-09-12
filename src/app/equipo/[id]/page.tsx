import { notFound } from 'next/navigation'
import Shell, { Rastro } from '@/components/Shell'
import Pestanas from '@/components/Pestanas'
import MiDia, { type Pendiente } from '@/components/MiDia'
import Calendario, { type Evento } from '@/components/Calendario'
import SinAcceso from '@/components/SinAcceso'
import { Cifra } from '@/components/Grafico'
import { Seccion, Lista, Fila, Cuerpo, Dato, Chip } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'
import { NOMBRE_ROL, rolPrincipal } from '@/lib/permisos'
import { plata, fechaCorta } from '@/lib/estados'

/* ------------------------------------------------------------------
   La ficha de una persona.

   La misma pantalla sirve para mirarse uno y para que dirección mire a
   otro, y eso está bien: lo que cambia no es la pantalla sino lo que la
   base devuelve. Su plata la ve ella y la ve dirección; nadie más,
   aunque escriba la URL.
   ------------------------------------------------------------------ */

export default async function FichaPersona({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: miFicha } = await supabase
    .from('usuarios')
    .select('persona_id, personas(roles)')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const misRoles = (miFicha?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []
  const soyYo = miFicha?.persona_id === id
  const mando = misRoles.includes('direccion') || misRoles.includes('administracion')
  const coordino = mando || misRoles.includes('coordinacion')

  if (!soyYo && !coordino)
    return (
      <Shell activo="/equipo">
        <SinAcceso que="La ficha de otra persona" />
      </Shell>
    )

  const [
    { data: quien },
    { data: carga },
    { data: pendientes },
    { data: agenda },
    { data: posicion },
    { data: hoyRow },
  ] = await Promise.all([
    supabase.from('v_equipo').select('*').eq('id', id).maybeSingle(),
    supabase.from('v_carga').select('*').eq('persona_id', id).maybeSingle(),
    supabase.from('v_pendientes').select('*').eq('persona_id', id),
    supabase.from('v_agenda_persona').select('*').eq('persona_id', id).order('fecha'),
    supabase.from('v_posicion_de').select('*').eq('persona_id', id),
    supabase.rpc('hoy_es'),
  ])

  if (!quien) notFound()

  const p = quien as Record<string, unknown>
  const c = (carga ?? {}) as Record<string, number | null>
  const tareas = (pendientes ?? []) as unknown as Pendiente[]
  const plata_ = (posicion ?? []) as Record<string, number | string | boolean>[]

  const nombre = p.nombre as string
  const roles = (p.roles as string[]) ?? []
  const iniciales = nombre.split(' ').map((x) => x[0]).slice(0, 2).join('')

  const aLiquidar = plata_.reduce((s, x) => s + Number(x.a_liquidar ?? 0), 0)
  const devengado = plata_.reduce((s, x) => s + Number(x.devengado ?? 0), 0)
  const liquidado = plata_.reduce((s, x) => s + Number(x.liquidado ?? 0), 0)
  const sinFactura = plata_.filter((x) => x.falta_su_factura).length

  // La plata solo la ve la persona o quien maneja la plata de la empresa.
  const veLaPlata = soyYo || mando

  return (
    <Shell activo="/equipo" titulo={nombre}>
      <Rastro pasos={[{ texto: 'Usuarios y roles', href: '/equipo' }, { texto: nombre }]} />

      <header className="mb-7 flex flex-wrap items-start gap-x-5 gap-y-4 border-b border-linea pb-6">
        <span
          className="grid size-14 shrink-0 place-items-center rounded-full bg-azul-hondo text-lg
                     font-bold text-white"
          aria-hidden
        >
          {iniciales}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-balance">{nombre}</h1>
          <span className="flex flex-wrap items-center gap-2">
            <Chip tono="azul">{NOMBRE_ROL[rolPrincipal(roles) ?? ''] ?? 'sin rol'}</Chip>
            {!!p.es_externa && <Chip>externa</Chip>}
            {!p.puede_entrar && <Chip tono="amarillo">sin acceso</Chip>}
            <span className="cifra text-2xs text-gris-50">
              {(p.email as string | null) ?? 'sin correo'}
            </span>
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="cifra text-2xl font-bold text-tinta">
            {c.entregas_pendientes ?? 0}
          </span>
          <span className="text-2xs text-gris-50">entregas por hacer</span>
        </div>
      </header>

      <Pestanas
        solapas={[
          {
            clave: 'hacer',
            texto: 'Qué tiene por hacer',
            señal: Number(c.entregas_vencidas ?? 0),
            contenido: (
              <div className="flex flex-col gap-9">
                <section className="escalona grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Cifra
                    valor={String(c.proyectos_en_vivo ?? 0)}
                    titulo="proyectos en vivo"
                    nota={
                      Number(c.proyectos_trabados ?? 0) > 0
                        ? `${c.proyectos_trabados} trabados esperando a otro`
                        : 'donde está asignada'
                    }
                  />
                  <Cifra
                    valor={String(c.entregas_esta_semana ?? 0)}
                    titulo="entregan esta semana"
                    nota="en los próximos siete días"
                    tono={Number(c.entregas_esta_semana ?? 0) > 0 ? 'amarillo' : 'tinta'}
                  />
                  <Cifra
                    valor={String(c.entregas_vencidas ?? 0)}
                    titulo="pasaron la fecha"
                    nota="ya vencieron"
                    tono={Number(c.entregas_vencidas ?? 0) > 0 ? 'rojo' : 'verde'}
                  />
                  <Cifra
                    valor={fechaCorta((c.proxima_entrega as unknown as string) ?? null) ?? '—'}
                    titulo="próxima entrega"
                    nota="la más cercana"
                  />
                </section>

                <MiDia pendientes={tareas} nombre={soyYo ? 'Vos' : nombre.split(' ')[0]} />
              </div>
            ),
          },
          {
            clave: 'calendario',
            texto: 'Su calendario',
            contenido:
              (agenda ?? []).length === 0 ? (
                <p className="tarjeta px-4 py-8 text-center text-sm text-gris">
                  No hay entregas con fecha en sus proyectos.
                </p>
              ) : (
                <Calendario
                  eventos={(agenda ?? []) as unknown as Evento[]}
                  hoy={(hoyRow as string) ?? ''}
                />
              ),
          },
          ...(veLaPlata
            ? [
                {
                  clave: 'plata',
                  texto: 'Su cuenta',
                  señal: sinFactura,
                  contenido: (
                    <div className="flex flex-col gap-9">
                      <section className="escalona grid gap-4 sm:grid-cols-3">
                        <Cifra
                          valor={plata(aLiquidar)}
                          titulo="listo para transferirle"
                          nota="la plata del cliente ya entró"
                          tono={aLiquidar > 0 ? 'verde' : 'tinta'}
                        />
                        <Cifra
                          valor={plata(devengado)}
                          titulo="devengado"
                          nota="se ganó y todavía no entró"
                        />
                        <Cifra
                          valor={plata(liquidado)}
                          titulo="ya cobrado"
                          nota="transferido"
                        />
                      </section>

                      {sinFactura > 0 && (
                        <p className="tarjeta border-amarillo px-4 py-3 text-sm text-tinta">
                          Hay {sinFactura} {sinFactura === 1 ? 'proyecto' : 'proyectos'} con plata
                          lista para transferir y sin su factura. Sin factura no se puede pagar.
                        </p>
                      )}

                      <Seccion
                        titulo="Proyecto por proyecto"
                        ayuda="El porcentaje se aplica sobre lo que queda después de gastos e impuestos."
                      >
                        {plata_.length === 0 ? (
                          <p className="tarjeta px-4 py-6 text-sm text-gris">
                            Todavía no tiene participación cargada en ningún proyecto.
                          </p>
                        ) : (
                          <Lista>
                            {plata_.map((x) => (
                              <Fila
                                key={`${x.proyecto_id}-${x.concepto}`}
                                href={`/proyecto/${x.proyecto_codigo}`}
                              >
                                <Cuerpo
                                  titulo={x.proyecto as string}
                                  detalle={`${x.cliente} · ${x.concepto} · ${Number(x.porcentaje)} %`}
                                />
                                {Number(x.a_liquidar) > 0 && (
                                  <Dato
                                    ancho="w-32"
                                    tono="verde"
                                    valor={plata(Number(x.a_liquidar), x.moneda as string)}
                                    nota="a transferir"
                                  />
                                )}
                                <Dato
                                  ancho="w-28"
                                  tono="gris"
                                  valor={plata(Number(x.devengado), x.moneda as string)}
                                  nota="devengado"
                                />
                              </Fila>
                            ))}
                          </Lista>
                        )}
                      </Seccion>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </Shell>
  )
}
