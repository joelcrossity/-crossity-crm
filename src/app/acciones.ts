'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type Resultado = { ok: true } | { ok: false; error: string }

// RLS decide si el cambio entra. Acá sólo traducimos el fallo a algo legible.
function traducir(mensaje: string): string {
  if (mensaje.includes('gris_con_motivo')) return 'Un proyecto en standby necesita decir por qué.'
  if (mensaje.includes('rojo_con_motivo')) return 'Al cerrarlo hay que decir si se perdió o se descartó.'
  if (mensaje.includes('naranja_sin_motivo')) return 'Terminado no lleva motivo.'
  if (mensaje.includes('subestado_solo_verde')) return 'El sub-estado sólo aplica a lo que está en vivo.'
  if (mensaje.includes('porcentaje es un acuerdo')) return 'El porcentaje sólo lo cambia dirección.'
  if (mensaje.includes('propia visibilidad')) return 'No podés cambiar tu propia visibilidad.'
  return mensaje
}

async function guardar(
  proyectoId: string,
  cambios: Record<string, unknown>
): Promise<Resultado> {
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('proyectos')
    .update(cambios, { count: 'exact' })
    .eq('id', proyectoId)
    .select('id')

  if (error) return { ok: false, error: traducir(error.message) }
  // RLS no da error: simplemente no toca la fila.
  if (count === 0) return { ok: false, error: 'No tenés permiso para cambiar este proyecto.' }

  revalidatePath('/tablero')
  revalidatePath('/pipeline')
  revalidatePath('/hoy')
  revalidatePath('/admin')
  return { ok: true }
}

export async function cambiarEstado(
  proyectoId: string,
  color: string,
  detalle: string | null
): Promise<Resultado> {
  const cambios: Record<string, unknown> = {
    color,
    subestado: null,
    motivo_gris: null,
    motivo_rojo: null,
  }

  if (color === 'verde') cambios.subestado = detalle ?? 'en_curso'
  if (color === 'gris') cambios.motivo_gris = detalle ?? 'dormido'
  if (color === 'rojo') cambios.motivo_rojo = detalle ?? 'perdido'

  return guardar(proyectoId, cambios)
}

export async function cambiarFecha(proyectoId: string, fecha: string): Promise<Resultado> {
  return guardar(proyectoId, { fecha_comprometida: fecha || null })
}

export async function cambiarResponsable(
  proyectoId: string,
  personaId: string
): Promise<Resultado> {
  return guardar(proyectoId, { responsable_id: personaId || null })
}

export async function cambiarPrioridad(
  proyectoId: string,
  prioridad: string
): Promise<Resultado> {
  const n = parseInt(prioridad, 10)
  return guardar(proyectoId, { prioridad: Number.isFinite(n) && n > 0 ? n : null })
}

export async function cambiarMonto(
  proyectoId: string,
  monto: string,
  moneda: string
): Promise<Resultado> {
  const n = parseFloat(monto.replace(/\./g, '').replace(',', '.'))
  return guardar(proyectoId, {
    monto_neto: Number.isFinite(n) && n > 0 ? n : null,
    moneda,
  })
}

export async function cambiarSeguimiento(
  proyectoId: string,
  accion: string,
  cuando: string
): Promise<Resultado> {
  return guardar(proyectoId, {
    proxima_accion: accion.trim() || null,
    proximo_seguimiento: cuando ? new Date(cuando).toISOString() : null,
  })
}

export async function cambiarEtapa(proyectoId: string, etapa: string): Promise<Resultado> {
  return guardar(proyectoId, { etapa })
}

// La novedad es el latido del proyecto: de acá sale el "días sin novedades".
export async function cargarNovedad(
  proyectoId: string,
  tipo: string,
  texto: string
): Promise<Resultado> {
  const limpio = texto.trim()
  if (!limpio) return { ok: false, error: 'Escribí qué pasó.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: yo } = await supabase
    .from('usuarios')
    .select('persona_id')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const { error } = await supabase.from('actualizaciones').insert({
    proyecto_id: proyectoId,
    tipo,
    texto: limpio,
    autor_id: yo?.persona_id ?? null,
    canal: 'nota',
  })

  if (error) return { ok: false, error: traducir(error.message) }

  revalidatePath(`/proyecto`, 'layout')
  revalidatePath('/tablero')
  revalidatePath('/hoy')
  return { ok: true }
}

export async function marcarHito(
  hitoId: string,
  campo: 'entregado_at' | 'facturado_at' | 'cobrado_at',
  marcado: boolean
): Promise<Resultado> {
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('hitos')
    .update({ [campo]: marcado ? new Date().toISOString() : null }, { count: 'exact' })
    .eq('id', hitoId)
    .select('id')

  if (error) return { ok: false, error: traducir(error.message) }
  if (count === 0) return { ok: false, error: 'No tenés permiso para cambiar esta entrega.' }

  revalidatePath('/proyecto', 'layout')
  revalidatePath('/tablero')
  return { ok: true }
}
