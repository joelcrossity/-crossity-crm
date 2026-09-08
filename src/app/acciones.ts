'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/* `ir` es adónde navegar después. El redirect del servidor se pierde
   cuando la acción se llama desde una transición, así que la navegación
   la hace el cliente con lo que devolvemos acá. */
export type Resultado = { ok: true; ir?: string } | { ok: false; error: string }

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

/* ------------------------------------------------------------------
   Altas. Sin esto el sistema es un visor de lo que alguien cargó
   alguna vez.
   ------------------------------------------------------------------ */

type AltaCuenta = { id: string; codigo: string } | { error: string }

async function altaDeCuenta(nombre: string, alias: string[]): Promise<AltaCuenta> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizaciones')
    .insert({ nombre_canonico: nombre, alias })
    .select('id, codigo')
    .single()

  if (error || !data) return { error: error?.message ?? 'No se pudo crear el cliente' }

  // Toda cuenta arranca con una razón social y una marca con su mismo
  // nombre. Las que facturan por varias se agregan después.
  await supabase.from('razones_sociales').insert({
    organizacion_id: data.id, razon_social: nombre, es_principal: true,
  })
  await supabase.from('marcas').insert({
    organizacion_id: data.id, nombre, es_principal: true,
  })

  return { id: data.id as string, codigo: data.codigo as string }
}

export async function crearCliente(datos: FormData): Promise<Resultado> {
  const nombre = String(datos.get('nombre') ?? '').trim()
  if (!nombre) return { ok: false, error: 'Poné el nombre del cliente.' }

  const alias = String(datos.get('alias') ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)

  const r = await altaDeCuenta(nombre, alias)
  if ('error' in r) {
    if (r.error.includes('duplicate')) return { ok: false, error: 'Ya existe un cliente con ese nombre.' }
    return { ok: false, error: traducir(r.error) }
  }

  revalidatePath('/cuentas', 'layout')
  revalidatePath('/hoy')
  return { ok: true, ir: `/cuentas/${r.codigo}` }
}

export async function crearProyecto(datos: FormData): Promise<Resultado> {
  let organizacion_id = String(datos.get('cliente') ?? '')
  const clienteNuevo = String(datos.get('cliente_nuevo') ?? '').trim()
  const nombre = String(datos.get('nombre') ?? '').trim()
  const arranca = String(datos.get('arranca') ?? 'oportunidad')

  if (!nombre) return { ok: false, error: 'Poné el nombre del proyecto.' }

  // El proyecto casi siempre aparece antes que el cliente: si es alguien
  // nuevo, se da de alta acá mismo y no en otra pantalla.
  if (organizacion_id === 'nuevo') {
    if (!clienteNuevo) return { ok: false, error: 'Poné el nombre del cliente nuevo.' }
    const r = await altaDeCuenta(clienteNuevo, [])
    if ('error' in r) {
      if (r.error.includes('duplicate')) return { ok: false, error: 'Ya existe un cliente con ese nombre.' }
      return { ok: false, error: traducir(r.error) }
    }
    organizacion_id = r.id
  }

  if (!organizacion_id) return { ok: false, error: 'Elegí el cliente.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proyectos')
    .insert(
      arranca === 'oportunidad'
        ? { organizacion_id, nombre, color: 'amarillo', etapa: 'interes' }
        : { organizacion_id, nombre, color: 'verde', subestado: 'en_curso' }
    )
    .select('codigo')
    .single()

  if (error) return { ok: false, error: traducir(error.message) }

  revalidatePath('/tablero')
  revalidatePath('/pipeline')
  revalidatePath('/hoy')
  revalidatePath('/cuentas', 'layout')
  return { ok: true, ir: `/proyecto/${data.codigo}` }
}

/* ------------------------------------------------------------------
   Alta completa, la del asistente: cliente, proyecto y sus entregas
   en una sola operación.

   Cada hito lleva su fecha, qué entrega y cuánto se cobra. Los tres
   datos juntos, porque separados no sirven: una fecha sin entregable no
   dice qué se comprometió, y un monto sin fecha no dice cuándo entra.
   ------------------------------------------------------------------ */

export type HitoNuevo = {
  titulo: string
  entregable: string
  monto: string
  fecha: string
}

export type ProyectoNuevo = {
  clienteId: string
  clienteNuevo: string
  nombre: string
  monto: string
  moneda: string
  programa: string
  responsableId: string
  responsableTecnicoId: string
  arranca: 'proyecto' | 'oportunidad'
  hitos: HitoNuevo[]
}

export async function crearProyectoCompleto(d: ProyectoNuevo): Promise<Resultado> {
  if (!d.nombre.trim()) return { ok: false, error: 'Poné el nombre del proyecto.' }

  let organizacion_id = d.clienteId
  if (organizacion_id === 'nuevo') {
    if (!d.clienteNuevo.trim()) return { ok: false, error: 'Poné el nombre del cliente nuevo.' }
    const r = await altaDeCuenta(d.clienteNuevo.trim(), [])
    if ('error' in r) {
      if (r.error.includes('duplicate')) return { ok: false, error: 'Ya existe un cliente con ese nombre.' }
      return { ok: false, error: traducir(r.error) }
    }
    organizacion_id = r.id
  }
  if (!organizacion_id) return { ok: false, error: 'Elegí el cliente.' }

  const numero = (v: string) => {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const hitos = d.hitos.filter((h) => h.titulo.trim() || numero(h.monto) || h.fecha)
  const total = numero(d.monto) ?? hitos.reduce((a, h) => a + (numero(h.monto) ?? 0), 0)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proyectos')
    .insert({
      organizacion_id,
      nombre: d.nombre.trim(),
      moneda: d.moneda,
      monto_neto: total || null,
      programa: d.programa.trim() || null,
      responsable_id: d.responsableId || null,
      responsable_tecnico_id: d.responsableTecnicoId || null,
      esquema_cobro: hitos.length > 0 ? 'por_hitos' : 'a_convenir',
      // Con entregas cargadas, el proyecto nace esperando el anticipo.
      // Sin entregas, arranca donde diga el asistente.
      ...(d.arranca === 'oportunidad'
        ? { color: 'amarillo', etapa: 'interes' }
        : { color: 'verde', subestado: 'en_curso' }),
      fecha_comprometida: hitos.length > 0 ? (hitos[hitos.length - 1].fecha || null) : null,
    })
    .select('id, codigo')
    .single()

  if (error || !data) return { ok: false, error: traducir(error?.message ?? 'No se pudo crear') }

  if (hitos.length > 0) {
    const { error: eh } = await supabase.from('hitos').insert(
      hitos.map((h, i) => ({
        proyecto_id: data.id,
        orden: i + 1,
        titulo: h.titulo.trim() || `Entrega ${i + 1}`,
        entregable: h.entregable.trim() || null,
        monto_neto: numero(h.monto) ?? 0,
        porcentaje: total > 0 ? Math.round(((numero(h.monto) ?? 0) / total) * 10000) / 100 : null,
        fecha_comprometida: h.fecha || null,
        es_anticipo: i === 0,
      }))
    )
    if (eh) return { ok: false, error: `El proyecto se creó pero fallaron las entregas: ${traducir(eh.message)}` }
  }

  revalidatePath('/tablero')
  revalidatePath('/pipeline')
  revalidatePath('/hoy')
  revalidatePath('/cuentas', 'layout')
  return { ok: true, ir: `/proyecto/${data.codigo}` }
}

/* ------------------------------------------------------------------
   El cliente también se edita. Lo que se ve, se toca.
   ------------------------------------------------------------------ */

async function guardarCliente(id: string, cambios: Record<string, unknown>): Promise<Resultado> {
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('organizaciones')
    .update(cambios, { count: 'exact' })
    .eq('id', id)
    .select('id')

  if (error) {
    if (error.message.includes('duplicate')) return { ok: false, error: 'Ya existe otro cliente así.' }
    return { ok: false, error: traducir(error.message) }
  }
  if (count === 0) return { ok: false, error: 'No tenés permiso para cambiar este cliente.' }

  revalidatePath('/cuentas', 'layout')
  revalidatePath('/tablero')
  return { ok: true }
}

export async function cambiarCliente(
  id: string,
  campo: 'nombre_canonico' | 'cuit' | 'notas',
  valor: string
): Promise<Resultado> {
  if (campo === 'nombre_canonico' && !valor.trim()) {
    return { ok: false, error: 'El cliente necesita un nombre.' }
  }
  return guardarCliente(id, { [campo]: valor.trim() || null })
}

/* Los alias no son prolijidad: son contra qué resuelve el sistema a quién
   pertenece un mensaje que llega escrito de cualquier forma. */
export async function cambiarAlias(id: string, texto: string): Promise<Resultado> {
  const alias = texto.split(',').map((a) => a.trim()).filter(Boolean)
  return guardarCliente(id, { alias })
}

export async function agregarRazonSocial(
  organizacion_id: string,
  razon_social: string,
  cuit: string
): Promise<Resultado> {
  if (!razon_social.trim()) return { ok: false, error: 'Poné la razón social.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('razones_sociales')
    .insert({ organizacion_id, razon_social: razon_social.trim(), cuit: cuit.trim() || null })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/cuentas', 'layout')
  return { ok: true }
}

export async function agregarMarca(organizacion_id: string, nombre: string): Promise<Resultado> {
  if (!nombre.trim()) return { ok: false, error: 'Poné el nombre de la marca.' }
  const supabase = await createClient()
  const { error } = await supabase.from('marcas').insert({ organizacion_id, nombre: nombre.trim() })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/cuentas', 'layout')
  return { ok: true }
}

export async function agregarContacto(
  organizacion_id: string,
  nombre: string,
  rol: string,
  email: string,
  telefono: string
): Promise<Resultado> {
  if (!nombre.trim()) return { ok: false, error: 'Poné el nombre del contacto.' }
  const supabase = await createClient()
  const { error } = await supabase.from('contactos').insert({
    organizacion_id,
    nombre: nombre.trim(),
    rol: rol.trim() || null,
    email: email.trim() || null,
    telefono: telefono.trim() || null,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/cuentas', 'layout')
  return { ok: true }
}

export async function borrarDelCliente(
  tabla: 'razones_sociales' | 'marcas' | 'contactos',
  id: string
): Promise<Resultado> {
  const supabase = await createClient()
  const { error, count } = await supabase.from(tabla).delete({ count: 'exact' }).eq('id', id).select('id')
  if (error) {
    if (error.message.includes('violates foreign key'))
      return { ok: false, error: 'No se puede borrar: hay proyectos que la usan.' }
    return { ok: false, error: traducir(error.message) }
  }
  if (count === 0) return { ok: false, error: 'No tenés permiso para borrarlo.' }
  revalidatePath('/cuentas', 'layout')
  return { ok: true }
}

/* ------------------------------------------------------------------
   El recorrido comercial: de una charla suelta a proyecto.

   La misma fila avanza de etapa y al ganarse se vuelve proyecto. No se
   crea un registro nuevo: por eso la conversación del primer día y la
   entrega del último cuelgan del mismo hilo.
   ------------------------------------------------------------------ */

export async function cambiarOrigen(proyectoId: string, origen: string): Promise<Resultado> {
  return guardar(proyectoId, { origen: origen || null })
}

export async function cambiarProximaAccion(
  proyectoId: string,
  accion: string,
  cuando: string,
): Promise<Resultado> {
  return guardar(proyectoId, {
    proxima_accion: accion.trim() || null,
    proximo_seguimiento: cuando || null,
  })
}

export async function ganarOportunidad(
  proyectoId: string,
  esquema: string,
): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('ganar_oportunidad', {
    p_proyecto: proyectoId,
    p_esquema: esquema,
  })
  if (error) return { ok: false, error: traducir(error.message) }

  const { data } = await supabase.from('proyectos').select('codigo').eq('id', proyectoId).single()
  revalidatePath('/', 'layout')
  return { ok: true, ir: data ? `/proyecto/${data.codigo}` : undefined }
}

export async function perderOportunidad(
  proyectoId: string,
  motivo: 'no_se_dio' | 'perdido',
  detalle: string,
): Promise<Resultado> {
  return motivo === 'no_se_dio'
    ? guardar(proyectoId, {
        color: 'gris',
        motivo_gris: 'no_se_dio',
        motivo_condicion: detalle.trim() || null,
        proxima_accion: null,
        proximo_seguimiento: null,
      })
    : guardar(proyectoId, {
        color: 'rojo',
        motivo_rojo: 'perdido',
        motivo_condicion: detalle.trim() || null,
        proxima_accion: null,
        proximo_seguimiento: null,
      })
}

/* ------------------------------------------------------------------
   Anotar una charla.

   El momento más frágil de todo el recorrido: alguien se interesó y
   todavía no hay proyecto, ni alcance, ni monto. Si en ese momento hay
   que llenar un formulario, no se carga y se pierde.

   Se pide lo mínimo: de quién, qué se habló, de dónde salió y cuándo se
   vuelve. Todo lo demás se completa cuando exista.
   ------------------------------------------------------------------ */

export type Charla = {
  clienteId: string
  clienteNuevo: string
  tema: string
  loHablado: string
  origen: string
  cuando: string
  referidoPor: string
  referidoNota: string
}

export async function anotarCharla(c: Charla): Promise<Resultado> {
  if (!c.loHablado.trim()) return { ok: false, error: 'Escribí de qué hablaron.' }

  let organizacion_id = c.clienteId
  if (organizacion_id === 'nuevo') {
    if (!c.clienteNuevo.trim()) return { ok: false, error: 'Poné de quién es la charla.' }
    const r = await altaDeCuenta(c.clienteNuevo.trim(), [])
    if ('error' in r) {
      if (r.error.includes('duplicate'))
        return { ok: false, error: 'Ya existe un cliente con ese nombre. Elegilo de la lista.' }
      return { ok: false, error: traducir(r.error) }
    }
    organizacion_id = r.id
  }
  if (!organizacion_id) return { ok: false, error: 'Elegí de quién es la charla.' }

  const supabase = await createClient()

  // Quien lo trajo se anota ahora, que es cuando se sabe. El porcentaje
  // lo acuerda administración cuando haya monto: son dos momentos.
  let referido_por: string | null = null
  if (c.referidoPor.trim()) {
    const { data: id } = await supabase.rpc('referente', { p_nombre: c.referidoPor.trim() })
    referido_por = (id as string) ?? null
  }

  const { data, error } = await supabase
    .from('proyectos')
    .insert({
      organizacion_id,
      // Sin nombre todavía: se llama por lo que se habló hasta que tenga uno.
      nombre: c.tema.trim() || 'Por definir',
      referido_por,
      referido_nota: c.referidoNota.trim() || null,
      color: 'amarillo',
      etapa: 'interes',
      esquema_cobro: 'a_convenir',
      origen: c.origen || null,
      proxima_accion: 'Volver a hablar',
      proximo_seguimiento: c.cuando || null,
    })
    .select('id, codigo')
    .single()

  if (error || !data) return { ok: false, error: traducir(error?.message ?? 'No se pudo anotar') }

  // La charla misma queda como primera novedad: es el día uno del hilo.
  await cargarNovedad(data.id as string, 'comercial', c.loHablado.trim())

  revalidatePath('/', 'layout')
  return { ok: true, ir: `/proyecto/${data.codigo}` }
}


export async function cambiarReferido(
  proyectoId: string,
  nombre: string,
  nota: string,
): Promise<Resultado> {
  const supabase = await createClient()

  let referido_por: string | null = null
  if (nombre.trim()) {
    const { data, error } = await supabase.rpc('referente', { p_nombre: nombre.trim() })
    if (error) return { ok: false, error: traducir(error.message) }
    referido_por = data as string
  }

  return guardar(proyectoId, { referido_por, referido_nota: nota.trim() || null })
}

export async function marcarLeido(): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('marcar_leido')
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}
