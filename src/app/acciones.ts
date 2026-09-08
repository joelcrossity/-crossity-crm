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
  if (mensaje.includes('ya tiene su mantenimiento')) return 'Este proyecto ya tiene su mantenimiento abierto.'
  if (mensaje.includes('ya es un mantenimiento')) return 'Esto ya es un mantenimiento.'
  if (mensaje.includes('participaciones')) return 'El reparto sólo lo copia dirección. Abrilo sin copiarlo y cargalo después.'
  if (mensaje.includes('arman el equipo')) return 'Sólo dirección, administración o coordinación arman el equipo.'
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

/* Registrar un cobro, no sólo tildar que entró.
   El tilde movía `hitos.cobrado_at` y no dejaba rastro: no se podía
   responder cuándo entró la plata ni por qué medio. Insertar en `cobros`
   dispara el hito por trigger y además deja el historial. */
export async function registrarCobro(
  hitoId: string,
  monto: string,
  fecha: string,
  medio: string,
  moneda: string
): Promise<Resultado> {
  const n = parseFloat(monto.replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'Poné el monto que entró.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: yo } = await supabase
    .from('usuarios').select('persona_id').eq('id', user?.id ?? '').maybeSingle()

  const { error } = await supabase.from('cobros').insert({
    hito_id: hitoId,
    monto: n,
    moneda,
    fecha: fecha || new Date().toISOString().slice(0, 10),
    medio: medio.trim() || null,
    registrado_por: yo?.persona_id ?? null,
  })

  if (error) return { ok: false, error: traducir(error.message) }

  revalidatePath('/proyecto', 'layout')
  revalidatePath('/admin')
  revalidatePath('/hoy')
  return { ok: true }
}

export async function borrarCobro(cobroId: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('cobros').delete({ count: 'exact' }).eq('id', cobroId).select('id')

  if (error) return { ok: false, error: traducir(error.message) }
  if (count === 0) return { ok: false, error: 'No tenés permiso para borrar este cobro.' }

  revalidatePath('/proyecto', 'layout')
  revalidatePath('/admin')
  return { ok: true }
}

/* Abrir el mantenimiento de un proyecto entregado.
   Es el momento donde hoy se pierde plata en silencio: si nadie lo abre,
   se dejó de facturar sin haberlo decidido. */
export async function abrirMantenimiento(
  proyectoId: string,
  montoMensual: string,
  desde: string,
  copiarReparto: boolean
): Promise<Resultado> {
  const n = parseFloat(montoMensual.replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'Poné el abono mensual.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('pasar_a_mantenimiento', {
    p_proyecto: proyectoId,
    p_monto_mensual: n,
    p_desde: desde || new Date().toISOString().slice(0, 10),
    p_copiar_reparto: copiarReparto,
  })

  if (error) return { ok: false, error: traducir(error.message) }

  revalidatePath('/proyecto', 'layout')
  revalidatePath('/tablero')
  revalidatePath('/cuentas', 'layout')
  revalidatePath('/hoy')
  return { ok: true }
}

export async function cambiarProgramaYResponsables(
  proyectoId: string,
  campo: 'programa' | 'responsable_tecnico_id',
  valor: string
): Promise<Resultado> {
  return guardar(proyectoId, { [campo]: valor.trim() || null })
}

export async function sumarAlEquipo(
  proyectoId: string,
  personaId: string,
  rol: string
): Promise<Resultado> {
  if (!personaId) return { ok: false, error: 'Elegí a quién sumar.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('sumar_al_equipo', {
    p_proyecto: proyectoId,
    p_persona: personaId,
    p_rol: rol,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/proyecto', 'layout')
  return { ok: true }
}

export async function sacarDelEquipo(asignacionId: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('sacar_del_equipo', { p_asignacion: asignacionId })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/proyecto', 'layout')
  return { ok: true }
}

/* Entregado, facturado y pagado son tres hechos con fechas propias.
   Se puede cobrar sin haber facturado, y facturar mucho después. */
export async function fecharHito(
  hitoId: string,
  campo: 'entregado_at' | 'facturado_at',
  fecha: string
): Promise<Resultado> {
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('hitos')
    .update({ [campo]: fecha ? new Date(fecha + 'T12:00:00').toISOString() : null }, { count: 'exact' })
    .eq('id', hitoId)
    .select('id')

  if (error) return { ok: false, error: traducir(error.message) }
  if (count === 0) return { ok: false, error: 'No tenés permiso para cambiar esta entrega.' }

  revalidatePath('/proyecto', 'layout')
  revalidatePath('/tablero')
  revalidatePath('/hoy')
  return { ok: true }
}
