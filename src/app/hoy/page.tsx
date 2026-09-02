import Link from 'next/link'
import Shell, { Titulo } from '@/components/Shell'
import { createClient } from '@/lib/supabase/server'
import { fechaCorta } from '@/lib/estados'

type Fila = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  color: string
  subestado: string | null
  fecha_comprometida: string | null
  responsable: string | null
  dias_sin_novedades: number
  dias_de_atraso: number | null
}

/* Cada bloque responde una pregunta concreta y ofrece qué hacer.
   Si un bloque está vacío es una buena noticia, y se dice. */
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
        <h2 className="text-md font-semibold tracking-tight">{pregunta}</h2>
        <span
          className={`cifra rounded-full px-1.5 py-0.5 text-2xs font-medium ${
            filas.length === 0
              ? 'bg-verde-suave text-verde'
              : urgente
                ? 'bg-rojo-suave text-rojo'
                : 'bg-amarillo-suave text-amarillo'
          }`}
        >
          {filas.length}
        </span>
        <p className="w-full text-sm text-tinta-2">{porque}</p>
      </div>

      {filas.length === 0 ? (
        <p className="rounded-lg border border-linea bg-superficie px-3.5 py-3 text-sm text-tinta-2">
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
                  <span className="cifra block truncate text-2xs text-tinta-3">
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

export default async function Hoy() {
  const supabase = await createClient()

  const [{ data: proyectos }, { data: sinCobrar }, { data: repartos }, { data: sinAbono }] =
    await Promise.all([
      supabase.from('v_tablero').select('*'),
      supabase.from('v_trabajando_sin_cobrar').select('codigo, nombre, cliente'),
      supabase.from('v_reparto_incompleto').select('codigo, nombre, cliente, suma_porcentajes'),
      supabase.from('v_sin_mantenimiento').select('codigo, nombre, cliente'),
    ])

  const filas = (proyectos ?? []) as Fila[]
  const vivos = filas.filter((f) => f.color === 'verde')

  const frenados = vivos
    .filter((f) => f.dias_sin_novedades > 7)
    .sort((a, b) => b.dias_sin_novedades - a.dias_sin_novedades)

  const atrasados = vivos
    .filter((f) => (f.dias_de_atraso ?? -1) > 0)
    .sort((a, b) => (b.dias_de_atraso ?? 0) - (a.dias_de_atraso ?? 0))

  const sinFecha = vivos.filter((f) => !f.fecha_comprometida)
  const sinResponsable = vivos.filter((f) => !f.responsable)

  return (
    <Shell activo="/hoy">
      <Titulo
        seccion="Hoy"
        bajada={`${vivos.length} en vivo de ${filas.length} proyectos. Abajo, sólo lo que pide una decisión tuya.`}
      >
        Qué necesita atención
      </Titulo>

      <div className="flex flex-col gap-8">
        <Bloque
          pregunta="Se están cayendo"
          porque="Más de una semana sin que nadie cargue una novedad. No significa que estén parados: significa que nadie sabe."
          filas={frenados}
          vacio="Todos los proyectos en vivo tuvieron novedades esta semana."
          urgente
          columna={(f) => (
            <span className="cifra shrink-0 text-sm font-semibold text-rojo">
              {f.dias_sin_novedades} días
            </span>
          )}
        />

        <Bloque
          pregunta="Pasaron la fecha"
          porque="La entrega comprometida ya venció y el proyecto sigue en vivo."
          filas={atrasados}
          vacio="Ninguno pasó su fecha de entrega."
          urgente
          columna={(f) => (
            <span className="cifra shrink-0 text-sm font-semibold text-rojo">
              {f.dias_de_atraso} días tarde
            </span>
          )}
        />

        <Bloque
          pregunta="No tienen fecha"
          porque="Sin fecha comprometida nadie puede priorizar solo, y todo vuelve a vos."
          filas={sinFecha}
          vacio="Todos los proyectos en vivo tienen fecha."
          columna={() => <span className="shrink-0 text-sm text-tinta-3">poner fecha</span>}
        />

        <Bloque
          pregunta="No tienen responsable"
          porque="Sin un nombre al lado, la pregunta sobre ese proyecto termina en vos."
          filas={sinResponsable}
          vacio="Todos los proyectos en vivo tienen responsable."
          columna={() => <span className="shrink-0 text-sm text-tinta-3">asignar</span>}
        />

        {(sinCobrar?.length || repartos?.length || sinAbono?.length) ? (
          <section className="flex flex-col gap-3 border-t border-linea pt-7">
            <h2 className="text-md font-semibold tracking-tight">De la plata</h2>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
              <Cifra
                n={sinCobrar?.length ?? 0}
                titulo="trabajando sin cobrar"
                nota="en vivo sin el anticipo cobrado"
              />
              <Cifra
                n={repartos?.length ?? 0}
                titulo="reparto sin cerrar"
                nota="las participaciones no suman 100 %"
              />
              <Cifra
                n={sinAbono?.length ?? 0}
                titulo="entregados sin abono"
                nota="terminaron y nadie abrió el mantenimiento"
              />
            </dl>
          </section>
        ) : null}
      </div>
    </Shell>
  )
}

function Cifra({ n, titulo, nota }: { n: number; titulo: string; nota: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-baseline gap-2">
        <span className={`cifra text-xl font-semibold ${n === 0 ? 'text-tinta-3' : 'text-tinta'}`}>
          {n}
        </span>
        <span className="text-sm font-medium text-tinta">{titulo}</span>
      </dt>
      <dd className="text-2xs text-tinta-3">{nota}</dd>
    </div>
  )
}
