import Shell, { Rastro } from '@/components/Shell'
import Charla from '@/components/Charla'
import { createClient } from '@/lib/supabase/server'

/* Pantalla propia y no un formulario escondido adentro de Pipeline.
   Sale de una reunión con el teléfono en la mano: entre "abrir la app y
   anotar" y "abrir la app, buscar Pipeline, buscar el botón y anotar"
   está la diferencia entre que se cargue y que no. */

export default async function NuevaCharla() {
  const supabase = await createClient()
  const { data: cuentas } = await supabase
    .from('v_cuenta')
    .select('id, cuenta, proyectos_totales, en_vivo')
    .order('cuenta')

  const clientes = ((cuentas ?? []) as Record<string, unknown>[]).map((c) => ({
    id: c.id as string,
    nombre: c.cuenta as string,
    proyectos: (c.proyectos_totales as number) ?? 0,
    enVivo: (c.en_vivo as number) ?? 0,
  }))

  return (
    <Shell activo="/hoy" titulo="Nueva charla">
      <Rastro pasos={[{ texto: 'Hoy', href: '/hoy' }, { texto: 'Nueva charla' }]} />
      <div className="max-w-3xl">
        <Charla clientes={clientes} siempreAbierto />
      </div>
    </Shell>
  )
}
