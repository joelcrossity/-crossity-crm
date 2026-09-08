import Shell, { Titulo } from '@/components/Shell'
import Asistente from '@/components/Asistente'
import { Grupo, type Fila } from '@/components/TablaProyectos'
import TableroEstados from '@/components/TableroEstados'
import Vistas from '@/components/Vistas'
import { createClient } from '@/lib/supabase/server'

const ORDEN = ['verde', 'amarillo', 'gris', 'naranja', 'rojo']

export default async function Tablero() {
  const supabase = await createClient()
  const { data: cuentas } = await supabase
    .from('v_cuenta')
    .select('id, cuenta, proyectos_totales, en_vivo')
    .order('cuenta')
  const { data: personas } = await supabase
    .from('personas').select('id, nombre').eq('activa', true).order('nombre')
  const clientes = ((cuentas ?? []) as Record<string, unknown>[]).map((c) => ({
    id: c.id as string,
    nombre: c.cuenta as string,
    proyectos: (c.proyectos_totales as number) ?? 0,
    enVivo: (c.en_vivo as number) ?? 0,
  }))
  const { data } = await supabase
    .from('v_tablero')
    .select('*')
    .order('prioridad', { nullsFirst: false })
    .order('dias_sin_novedades', { ascending: false })

  const filas = (data ?? []) as Fila[]
  const vivos = filas.filter((f) => f.color === 'verde').length

  return (
    <Shell activo="/tablero">
      <Titulo
        seccion="Proyectos"
        bajada="Ordenados por prioridad, y dentro de cada estado por cuánto hace que no se sabe nada."
      >
        {vivos} en vivo, {filas.length} en total
      </Titulo>

      {filas.length === 0 ? (
        <div className="rounded-lg border border-linea bg-superficie px-4 py-8 text-center">
          <p className="text-base font-medium">Todavía no ves ningún proyecto</p>
          <p className="mx-auto mt-1 max-w-[50ch] text-sm text-gris">
            Vas a ver acá los proyectos donde estés asignado o tengas participación.
          </p>
        </div>
      ) : (
        <Vistas
          clave="crossity.proyectos"
          acciones={
            <Asistente clientes={clientes} personas={personas ?? []} arrancaComo="proyecto" />
          }
          tablero={<TableroEstados filas={filas} />}
          lista={
            <div className="flex flex-col gap-8">
              {ORDEN.map((color) => (
                <Grupo key={color} color={color} filas={filas.filter((f) => f.color === color)} />
              ))}
            </div>
          }
        />
      )}
    </Shell>
  )
}
