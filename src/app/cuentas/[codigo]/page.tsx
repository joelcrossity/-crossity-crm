import { notFound } from 'next/navigation'
import Shell, { Rastro } from '@/components/Shell'
import Documentos, { type Documento } from '@/components/Documentos'
import Pestanas from '@/components/Pestanas'
import ProyectosDelCliente, {
  type Proyecto,
  type Avance,
  type Archivado,
} from '@/components/ProyectosDelCliente'
import Interacciones, { type Interaccion } from '@/components/Interacciones'
import { Cifra } from '@/components/Grafico'
import { Chip } from '@/components/ui'
import Calendario, { type Evento } from '@/components/Calendario'
import Ofrecer, { type Sugerencia, type Nota } from '@/components/Ofrecer'
import CuentaCorriente, { type Saldo, type Movimiento } from '@/components/CuentaCorriente'
import { AliasCliente, DatoCliente, Lista } from '@/components/FichaCliente'
import { createClient } from '@/lib/supabase/server'
import { plata } from '@/lib/estados'




export default async function Cuenta(props: PageProps<'/cuentas/[codigo]'>) {
  const { codigo } = await props.params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizaciones')
    .select('id, codigo, nombre_canonico, alias, unidad, cuit, notas, carpeta_url')
    .eq('codigo', codigo)
    .maybeSingle()

  if (!org) notFound()

  const [
    { data: proyectos },
    { data: avances },
    { data: interacciones },
    { data: archivados },
    { data: razones },
    { data: marcas },
    { data: contactos },
    { data: agenda },
    { data: saldos },
    { data: movimientos },
    { data: sugerencias },
    { data: notas },
    { data: servicios },
    { data: hoyRow },
    { data: documentos },
  ] = await Promise.all([
      supabase
        .from('proyectos')
        .select(
          'id, codigo, nombre, color, subestado, motivo_gris, tipo, monto_neto, moneda, monto_mensual, fecha_comprometida, condicion, etapa, personas!proyectos_responsable_id_fkey(nombre)'
        )
        .eq('organizacion_id', org.id)
        .order('color'),
      supabase.from('v_avance').select('*').eq('organizacion_id', org.id),
      supabase
        .from('v_interacciones')
        .select('*')
        .eq('organizacion_id', org.id)
        .order('ocurrido_at', { ascending: false })
        .limit(40),
      supabase.from('v_archivados').select('*').eq('cliente_codigo', org.codigo),
      supabase
        .from('razones_sociales')
        .select('id, razon_social, cuit, es_principal')
        .eq('organizacion_id', org.id),
      supabase.from('marcas').select('id, nombre, es_principal').eq('organizacion_id', org.id),
      supabase.from('contactos').select('id, nombre, rol, email, telefono').eq('organizacion_id', org.id),
      supabase.from('v_agenda').select('*').eq('organizacion_id', org.id).order('fecha'),
      supabase.from('v_cuenta_corriente').select('*').eq('organizacion_id', org.id),
      supabase
        .from('v_movimientos')
        .select('*')
        .eq('organizacion_id', org.id)
        .order('fecha', { ascending: false })
        .limit(60),
      supabase.from('v_para_ofrecer').select('*').eq('organizacion_id', org.id),
      supabase
        .from('notas_de_venta')
        .select('id, texto, cuando, estado, servicio_id, servicios(nombre)')
        .eq('organizacion_id', org.id)
        .order('created_at', { ascending: false }),
      supabase.from('servicios').select('id, nombre').eq('activo', true).order('orden'),
      supabase.rpc('hoy_es'),
      supabase
        .from('v_documentos')
        .select('id, titulo, url, clase, version, enviado_at, enviado_por')
        .eq('organizacion_id', org.id)
        .order('created_at', { ascending: false }),
    ])

  type P = {
    id: string
    codigo: string
    nombre: string
    color: string
    subestado: string | null
    motivo_gris: string | null
    tipo: string
    monto_neto: number | null
    moneda: string
    monto_mensual: number | null
    fecha_comprometida: string | null
    condicion: string
    etapa: string | null
    personas: { nombre: string } | null
  }

  const ps = (proyectos ?? []) as unknown as P[]
  const vivos = ps.filter((p) => p.color === 'verde')
  const abonos = ps.filter((p) => p.tipo === 'mantenimiento' && p.color === 'verde')
  const bonificados = ps.filter((p) => p.condicion === 'bonificado')

  const facturable = ps
    .filter((p) => p.color !== 'rojo' && p.condicion !== 'bonificado')
    .reduce((s, p) => s + (p.moneda === 'ARS' ? (p.monto_neto ?? 0) : 0), 0)
  const regalado = bonificados.reduce((s, p) => s + (p.monto_neto ?? 0), 0)
  const mensual = abonos.reduce((s, p) => s + (p.monto_mensual ?? 0), 0)

  const principal = ((contactos ?? []) as { nombre: string; rol: string | null; email: string | null; telefono: string | null }[])[0]
  const ejecutivo = ps.find((x) => x.personas?.nombre)?.personas?.nombre

  return (
    <Shell activo="/cuentas" titulo={org.nombre_canonico}>
      <Rastro pasos={[{ texto: 'Clientes', href: '/cuentas' }, { texto: org.nombre_canonico }]} />

      <header className="mb-7 flex flex-wrap items-start justify-between gap-x-6 gap-y-4
                         border-b border-linea pb-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="cifra text-2xs text-gris-50">{org.codigo}</span>
          <h1 className="text-2xl font-bold tracking-tight text-balance">{org.nombre_canonico}</h1>

          <span className="flex flex-wrap items-center gap-2">
            {vivos.length > 0 && <Chip tono="verde">{vivos.length} en vivo</Chip>}
            {abonos.length > 0 && <Chip tono="azul">{abonos.length} con abono</Chip>}
            {bonificados.length > 0 && <Chip>{bonificados.length} bonificado</Chip>}
            {(razones ?? []).length > 1 && (
              <Chip tono="amarillo">{(razones ?? []).length} razones sociales</Chip>
            )}
          </span>

          {/* Los datos que uno busca justo antes de llamar, sin entrar a
              ninguna pestaña. */}
          <span className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-2xs text-gris-50">
            {principal && (
              <span className="text-gris">
                {principal.nombre}
                {principal.rol && ` · ${principal.rol}`}
              </span>
            )}
            {principal?.telefono && <span className="cifra">{principal.telefono}</span>}
            {principal?.email && <span className="cifra">{principal.email}</span>}
            {ejecutivo && <span>a cargo: {ejecutivo}</span>}
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="cifra text-2xl font-bold text-tinta">{plata(facturable)}</span>
          <span className="text-2xs text-gris-50">facturable en toda la relación</span>
        </div>
      </header>

      <Pestanas
        solapas={[
          {
            clave: 'proyectos',
            texto: 'Proyectos',
            señal: vivos.length,
            contenido: (
              <div className="flex flex-col gap-9">
                <section className="escalona grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Cifra valor={String(ps.length)} titulo="proyectos" nota="en toda la relación" />
                  <Cifra
                    valor={plata(mensual)}
                    titulo="por mes"
                    nota={abonos.length > 0 ? `${abonos.length} abonos vigentes` : 'sin abonos'}
                    tono={mensual > 0 ? 'verde' : 'tinta'}
                  />
                  <Cifra
                    valor={plata(regalado)}
                    titulo="bonificado"
                    nota="lo que se regaló"
                    tono={regalado > 0 ? 'amarillo' : 'tinta'}
                  />
                  <Cifra
                    valor={String((archivados ?? []).length)}
                    titulo="archivados"
                    nota="fuera del escritorio"
                  />
                </section>

                <ProyectosDelCliente
                  proyectos={ps as unknown as Proyecto[]}
                  avances={(avances ?? []) as Avance[]}
                  archivados={(archivados ?? []) as unknown as Archivado[]}
                />
              </div>
            ),
          },
          {
            clave: 'plata',
            texto: 'Cuenta corriente',
            contenido: (
              <CuentaCorriente
                saldos={(saldos ?? []) as Saldo[]}
                movimientos={(movimientos ?? []) as Movimiento[]}
              />
            ),
          },
          {
            clave: 'calendario',
            texto: 'Calendario',
            contenido:
              ((agenda ?? []) as Evento[]).length === 0 ? (
                <p className="tarjeta px-4 py-8 text-center text-sm text-gris">
                  No hay nada con fecha para esta cuenta.
                </p>
              ) : (
                <Calendario eventos={(agenda ?? []) as Evento[]} hoy={(hoyRow as string) ?? ''} />
              ),
          },
          {
            clave: 'historia',
            texto: 'Historia',
            señal: (interacciones ?? []).length,
            contenido: (
              <div className="flex flex-col gap-9">
                <Interacciones filas={(interacciones ?? []) as unknown as Interaccion[]} />
              </div>
            ),
          },
          {
            clave: 'ofrecer',
            texto: 'Qué ofrecerle',
            contenido: (
              <Ofrecer
                organizacionId={org.id}
                sugerencias={(sugerencias ?? []) as Sugerencia[]}
                notas={(notas ?? []) as unknown as Nota[]}
                servicios={(servicios ?? []) as { id: string; nombre: string }[]}
              />
            ),
          },
          {
            clave: 'datos',
            texto: 'Datos y papeles',
            contenido: (
              <div className="flex flex-col gap-9">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                  <DatoCliente
                    id={org.id}
                    campo="nombre_canonico"
                    etiqueta="Nombre"
                    valor={org.nombre_canonico}
                  />
                  <DatoCliente
                    id={org.id}
                    campo="cuit"
                    etiqueta="CUIT"
                    valor={org.cuit}
                    marcador="30-…"
                    ancho="w-40"
                  />
                </div>

                <AliasCliente id={org.id} alias={org.alias ?? []} />

                <Lista
                  titulo="Razones sociales"
                  ayuda="Con cuál o cuáles factura. La principal es la que se usa por defecto."
                  tabla="razones_sociales"
                  organizacionId={org.id}
                  tipo="razon"
                  items={((razones ?? []) as Record<string, unknown>[]).map((r) => ({
                    id: r.id as string,
                    principal: r.razon_social as string,
                    secundario: (r.cuit as string) ?? null,
                    esPrincipal: !!r.es_principal,
                  }))}
                />

                <Lista
                  titulo="Marcas"
                  ayuda="Cómo se lo conoce. Sirve para que la captura por WhatsApp sepa de quién habla."
                  tabla="marcas"
                  organizacionId={org.id}
                  tipo="marca"
                  items={((marcas ?? []) as Record<string, unknown>[]).map((m) => ({
                    id: m.id as string,
                    principal: m.nombre as string,
                    esPrincipal: !!m.es_principal,
                  }))}
                />

                <Lista
                  titulo="Contactos"
                  ayuda="Quién es quién del lado del cliente."
                  tabla="contactos"
                  organizacionId={org.id}
                  tipo="contacto"
                  items={((contactos ?? []) as Record<string, unknown>[]).map((c) => ({
                    id: c.id as string,
                    principal: c.nombre as string,
                    secundario: [c.rol, c.email, c.telefono].filter(Boolean).join(' · ') || null,
                  }))}
                />

                <Documentos
                  documentos={(documentos ?? []) as Documento[]}
                  organizacionId={org.id}
                  carpeta={org.carpeta_url}
                  duenoTabla="organizaciones"
                  duenoId={org.id}
                />
              </div>
            ),
          },
        ]}
      />
    </Shell>
  )
}
