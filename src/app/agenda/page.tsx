import Shell, { Titulo } from '@/components/Shell'
import { Cifra } from '@/components/Grafico'
import Calendario, { type Evento } from '@/components/Calendario'
import Cheques, { type Cheque } from '@/components/Cheques'
import { createClient } from '@/lib/supabase/server'
import { plata } from '@/lib/estados'

export default async function Agenda() {
  const supabase = await createClient()

  const [{ data }, { data: cheques }, { data: cuentas }, { data: hoyRow }] = await Promise.all([
    supabase.from('v_agenda').select('*').order('fecha'),
    supabase
      .from('cheques')
      .select('id, tipo, numero, banco, importe, moneda, fecha_cobro, estado, es_echeq, organizacion_id')
      .order('fecha_cobro'),
    supabase.from('v_cuenta').select('id, cuenta').order('cuenta'),
    // El hoy lo dice la base: el del servidor puede estar en otra zona.
    supabase.rpc('hoy_es'),
  ])

  const eventos = (data ?? []) as Evento[]
  const hoy = (hoyRow as string) ?? ''

  const vencidos = eventos.filter((e) => e.vencido)
  const porCobrar = eventos
    .filter((e) => e.clase === 'cobro' && e.moneda === 'ARS')
    .reduce((s, e) => s + (e.monto ?? 0), 0)
  const aTransferir = eventos
    .filter((e) => e.clase === 'pago' && e.moneda === 'ARS')
    .reduce((s, e) => s + (e.monto ?? 0), 0)
  const enCheques = ((cheques ?? []) as Cheque[])
    .filter((c) => c.estado === 'en_cartera' && c.moneda === 'ARS')
    .reduce((s, c) => s + Number(c.importe), 0)

  return (
    <Shell activo="/agenda">
      <Titulo
        seccion="Agenda"
        bajada="Entregas, cobros, cheques y transferencias en un solo lugar. El problema nunca fue tener vencimientos: fue tenerlos repartidos."
      >
        {vencidos.length > 0
          ? `${vencidos.length} vencidos y sin cerrar`
          : `${eventos.length} cosas con fecha`}
      </Titulo>

      <div className="flex flex-col gap-9">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra
            titulo="Vencidos"
            valor={String(vencidos.length)}
            nota="pasaron y siguen abiertos"
            tono={vencidos.length > 0 ? 'rojo' : 'tinta'}
          />
          <Cifra titulo="Por cobrar" valor={plata(porCobrar)} nota="entregado y sin pagar" />
          <Cifra titulo="En cheques" valor={plata(enCheques)} nota="en cartera, sin depositar" />
          <Cifra
            titulo="Para transferir"
            valor={plata(aTransferir)}
            nota="la plata ya entró"
            tono={aTransferir > 0 ? 'rojo' : 'tinta'}
          />
        </section>

        <Calendario eventos={eventos} hoy={hoy} />

        <Cheques
          cheques={(cheques ?? []) as Cheque[]}
          clientes={((cuentas ?? []) as Record<string, unknown>[]).map((c) => ({
            id: c.id as string,
            nombre: c.cuenta as string,
          }))}
        />
      </div>
    </Shell>
  )
}
