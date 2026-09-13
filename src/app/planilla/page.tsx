import Shell, { Titulo } from '@/components/Shell'
import SinAcceso from '@/components/SinAcceso'
import Planilla, { type Linea } from '@/components/Planilla'
import { createClient } from '@/lib/supabase/server'

export default async function PaginaPlanilla() {
  const supabase = await createClient()

  /* No se decide acá quién entra: se pide y si la base no devuelve
     nada es porque no le corresponde. Preguntar primero por el rol y
     después consultar serían dos reglas para lo mismo. */
  const hoy = new Date()
  const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
  const { data, error } = await supabase.rpc('planilla_mes', { p_mes: mes, p_casa: 'oficial' })

  if (error) {
    return (
      <Shell activo="/planilla">
        <SinAcceso que="La planilla" />
      </Shell>
    )
  }

  return (
    <Shell activo="/planilla">
      <Titulo
        seccion="Finanzas"
        bajada="Lo que entró y lo que salió este mes, y lo que está por pasar. Todo valuado en pesos para poder sumarlo."
      >
        La planilla del mes
      </Titulo>
      <Planilla inicial={(data ?? []) as Linea[]} mesInicial={mes} />
    </Shell>
  )
}
