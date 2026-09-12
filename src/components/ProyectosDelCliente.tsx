import Link from 'next/link'
import { Lista, Fila, Cuerpo, Dato, Punto, Chip, Plegable, Vacio } from '@/components/ui'
import { plata, fechaCorta, SUBESTADO } from '@/lib/estados'

/* ------------------------------------------------------------------
   Los proyectos de un cliente, con su avance.

   El avance se mide por plata entregada y no por cantidad de entregas:
   una que vale la mitad del proyecto no pesa lo mismo que una que vale
   el trece por ciento. La barra muestra dos cosas superpuestas —lo
   entregado y lo cobrado— porque el hueco entre las dos es el
   diagnóstico: si entregaste todo y cobraste la mitad, el problema no
   es de producción.
   ------------------------------------------------------------------ */

export type Proyecto = {
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

export type Avance = {
  proyecto_id: string
  pct_entregado: number
  pct_cobrado: number
  entregas: number
  entregas_hechas: number
}

export type Archivado = {
  id: string
  codigo: string
  nombre: string
  color: string
  archivado_at: string
  era_oportunidad: boolean
}

function Barra({ entregado, cobrado }: { entregado: number; cobrado: number }) {
  return (
    <span className="relative mt-1 flex h-1.5 w-full overflow-hidden rounded-sm bg-panel" aria-hidden>
      <span
        className="absolute inset-y-0 left-0 transition-[width] duration-500"
        style={{ width: `${entregado}%`, background: 'var(--color-azul-50)' }}
      />
      <span
        className="absolute inset-y-0 left-0 transition-[width] duration-500"
        style={{ width: `${cobrado}%`, background: 'var(--color-verde)' }}
      />
    </span>
  )
}

/* Va afuera del componente a propósito: definido adentro, React lo
 trata como un tipo nuevo en cada render y desmonta y vuelve a montar
 todas las filas. Se nota en las animaciones y en cualquier estado
 interno que la fila tuviera. */
function Grupo({
titulo,
filas,
avance,
}: {
titulo: string
filas: Proyecto[]
avance: Map<string, Avance>
}) {
  if (filas.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline gap-2">
        <h3 className="text-sm font-bold tracking-tight text-tinta">{titulo}</h3>
        <span className="cifra text-2xs text-gris-50">{filas.length}</span>
      </span>
      <Lista>
        {filas.map((p) => {
          const a = avance.get(p.id)
          const esAbono = p.tipo === 'mantenimiento'
          return (
            <Fila key={p.id} href={`/proyecto/${p.codigo}`}>
              <Punto color={p.color} />
              <span className="min-w-0 flex-1">
                <Cuerpo
                  titulo={
                    <span className="flex flex-wrap items-baseline gap-2">
                      {p.nombre}
                      {esAbono && <Chip tono="verde">abono</Chip>}
                      {p.condicion === 'bonificado' && <Chip>bonificado</Chip>}
                    </span>
                  }
                  detalle={
                    <>
                      {p.personas?.nombre ?? 'sin responsable'}
                      {p.subestado && ` · ${SUBESTADO[p.subestado] ?? p.subestado}`}
                      {p.motivo_gris && ` · ${SUBESTADO[p.motivo_gris] ?? p.motivo_gris}`}
                      {p.fecha_comprometida && ` · ${fechaCorta(p.fecha_comprometida)}`}
                    </>
                  }
                />
                {!esAbono && a && a.entregas > 0 && (
                  <Barra entregado={Number(a.pct_entregado)} cobrado={Number(a.pct_cobrado)} />
                )}
              </span>

              {!esAbono && a && a.entregas > 0 && (
                <Dato
                  ancho="w-24"
                  valor={`${Number(a.pct_entregado)} %`}
                  nota={`${a.entregas_hechas} de ${a.entregas}`}
                />
              )}

              <Dato
                ancho="w-28"
                tono="gris"
                valor={plata(esAbono ? p.monto_mensual : p.monto_neto, p.moneda)}
                nota={esAbono ? 'por mes' : undefined}
              />
            </Fila>
          )
        })}
      </Lista>
    </div>
  )
}

export default function ProyectosDelCliente({
  proyectos,
  avances,
  archivados,
}: {
  proyectos: Proyecto[]
  avances: Avance[]
  archivados: Archivado[]
}) {
  const avance = new Map(avances.map((a) => [a.proyecto_id, a]))

  const activos = proyectos.filter((p) => p.color === 'verde')
  const pausados = proyectos.filter((p) => p.color === 'gris')
  const cerrados = proyectos.filter((p) => p.color === 'naranja' || p.color === 'rojo')



  if (proyectos.length === 0 && archivados.length === 0)
    return <Vacio>Este cliente todavía no tiene ningún proyecto ni oportunidad.</Vacio>

  return (
    <div className="flex flex-col gap-6">
      <p className="flex flex-wrap gap-x-4 text-2xs text-gris-50">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-azul-50" aria-hidden /> entregado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-verde" aria-hidden /> cobrado
        </span>
        <span>El avance se mide por plata, no por cantidad de entregas.</span>
      </p>

      <Grupo titulo="En vivo" filas={activos} avance={avance} />
      <Grupo titulo="En pausa" filas={pausados} avance={avance} />
      <Grupo titulo="Cerrados" filas={cerrados} avance={avance} />

      {archivados.length > 0 && (
        <Plegable
          titulo="Archivados"
          cuantos={archivados.length}
          ayuda="salieron del escritorio, siguen enteros"
        >
          <ul className="flex flex-col gap-1.5">
            {archivados.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/proyecto/${a.codigo}`}
                  className="tarjeta flex flex-wrap items-center justify-between gap-x-4 gap-y-1
                             px-3.5 py-2.5 transition-colors duration-150 hover:border-azul-hondo"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-tinta">{a.nombre}</span>
                    <span className="cifra block text-2xs text-gris-50">
                      {a.era_oportunidad ? 'oportunidad' : 'proyecto'} · archivado el{' '}
                      {fechaCorta(a.archivado_at.slice(0, 10))}
                    </span>
                  </span>
                  <Punto color={a.color} />
                </Link>
              </li>
            ))}
          </ul>
        </Plegable>
      )}
    </div>
  )
}
