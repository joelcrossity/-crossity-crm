import { createClient } from '@/lib/supabase/server'

/* ------------------------------------------------------------------
   El dólar del día, arriba.

   Dos números y de dónde salieron. Va en la barra porque la pregunta
   "¿a cuánto está?" aparece mientras se hace otra cosa —cotizando,
   cargando un cobro— y mandar a buscarla a otra pantalla es lo que hace
   que la gente termine mirando el celular en vez del sistema.

   Si la cotización no es de hoy se dice. Un número viejo sin aviso se
   lee como el del día, y con eso se cotiza mal.
   ------------------------------------------------------------------ */

type Fila = {
  casa: string
  venta: number
  fecha: string
  desactualizada: boolean
}

const peso = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 0 })

export default async function Dolar() {
  const supabase = await createClient()
  const { data } = await supabase.from('v_cotizacion_hoy').select('*')
  const filas = (data ?? []) as Fila[]
  if (filas.length === 0) return null

  const orden = ['oficial', 'blue']
  const vistas = filas.sort((a, b) => orden.indexOf(a.casa) - orden.indexOf(b.casa))
  const vieja = vistas.some((f) => f.desactualizada)

  return (
    <span
      className="hidden items-baseline gap-3 text-2xs sm:flex"
      title={
        vieja
          ? 'Alguna cotización no es de hoy. Se actualiza sola cada mañana.'
          : 'Cotización de hoy, de DolarApi'
      }
    >
      {vistas.map((f) => (
        <span key={f.casa} className="flex items-baseline gap-1">
          <span className="uppercase tracking-wider text-gris-50">{f.casa}</span>
          <span className={`cifra font-medium ${f.desactualizada ? 'text-gris-50' : 'text-tinta'}`}>
            ${peso(f.venta)}
          </span>
        </span>
      ))}
      {vieja && (
        <span className="text-amarillo" aria-label="La cotización no es de hoy">
          ·
        </span>
      )}
    </span>
  )
}
