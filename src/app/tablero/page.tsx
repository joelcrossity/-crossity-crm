import Shell, { Titulo } from '@/components/Shell'
import { Grupo, type Fila } from '@/components/TablaProyectos'
import { createClient } from '@/lib/supabase/server'

const ORDEN = ['verde', 'amarillo', 'gris', 'naranja', 'rojo']

export default async function Tablero() {
  const supabase = await createClient()
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
          <p className="mx-auto mt-1 max-w-[50ch] text-sm text-tinta-2">
            Vas a ver acá los proyectos donde estés asignado o tengas participación.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {ORDEN.map((color) => (
            <Grupo key={color} color={color} filas={filas.filter((f) => f.color === color)} />
          ))}
        </div>
      )}
    </Shell>
  )
}
