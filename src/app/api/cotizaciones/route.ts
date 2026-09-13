import { NextResponse } from 'next/server'
import { clienteAdmin } from '@/lib/supabase/admin'

/* ------------------------------------------------------------------
   Traer el dólar del día.

   La corre el cron de Vercel una vez por día, y también se puede
   forzar a mano desde la pantalla de finanzas cuando el dólar se movió
   fuerte y no se quiere esperar.

   Escribe con la clave de servicio y no con la sesión de quien la
   llama: el cron no tiene sesión. Por eso la ruta pide un secreto —si
   no, cualquiera con la URL podría escribir cotizaciones falsas, y una
   cotización falsa hace facturar mal—.

   Guarda solo oficial y blue. La API trae seis, pero las otras cuatro
   no se usan para cotizar acá y guardarlas sería ruido que hay que
   explicar cada vez que alguien mire la tabla.
   ------------------------------------------------------------------ */

const CASAS = ['oficial', 'blue'] as const

type Dolar = {
  casa: string
  compra: number | null
  venta: number | null
  fechaActualizacion: string
}

export async function GET(pedido: Request) {
  const esperado = process.env.CRON_SECRET
  if (!esperado) {
    return NextResponse.json(
      { ok: false, error: 'Falta CRON_SECRET en las variables de entorno.' },
      { status: 500 },
    )
  }

  const dado = pedido.headers.get('authorization')
  if (dado !== `Bearer ${esperado}`) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  let crudo: Dolar[]
  try {
    const r = await fetch('https://dolarapi.com/v1/dolares', { cache: 'no-store' })
    if (!r.ok) throw new Error(`la API contestó ${r.status}`)
    crudo = (await r.json()) as Dolar[]
  } catch (e) {
    /* Que falle no es grave: la cotización de ayer sigue sirviendo y la
       pantalla avisa que está vieja. Peor sería guardar cualquier cosa
       para que no quede vacío. */
    return NextResponse.json(
      { ok: false, error: `No se pudo consultar el dólar: ${(e as Error).message}` },
      { status: 502 },
    )
  }

  const supabase = clienteAdmin()
  const guardadas: string[] = []

  for (const casa of CASAS) {
    const d = crudo.find((x) => x.casa === casa)
    if (!d || !d.venta || d.venta <= 0) continue

    const { error } = await supabase.rpc('guardar_cotizacion', {
      p_moneda: 'USD',
      p_casa: casa,
      p_venta: d.venta,
      p_compra: d.compra,
      // La fecha de la API y no la de hoy: si el oficial no se actualizó
      // el fin de semana, guardarlo como de hoy diría que hay un valor
      // de hoy que en realidad es de ayer.
      p_fecha: d.fechaActualizacion.slice(0, 10),
      p_fuente: 'dolarapi',
    })
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    guardadas.push(`${casa} ${d.venta}`)
  }

  if (guardadas.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'La API no trajo ni oficial ni blue.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, guardadas })
}
