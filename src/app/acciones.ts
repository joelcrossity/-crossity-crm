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
  campo: 'entregado_at' | 'facturado_at' | 'vence_at',
  fecha: string
): Promise<Resultado> {
  const supabase = await createClient()
  /* vence_at es una fecha a secas, no un instante: cuando tiene que
     estar pagada, no a qué hora pasó algo. */
  const valor =
    campo === 'vence_at'
      ? fecha || null
      : fecha
        ? new Date(fecha + 'T12:00:00').toISOString()
        : null

  const { error, count } = await supabase
    .from('hitos')
    .update({ [campo]: valor }, { count: 'exact' })
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
  iva: string
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
      alicuota_iva: Number(d.iva ?? 21),
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

  const supabaseTmp = await createClient()

  let organizacion_id = c.clienteId

  /* Todavía no se sabe de quién es. Espera en la cuenta provisoria en
     vez de no cargarse: la charla que no se carga es la que se pierde. */
  if (organizacion_id === 'sin_definir') {
    const { data } = await supabaseTmp.rpc('cuenta_provisoria')
    organizacion_id = (data as string) ?? ''
    if (!organizacion_id) return { ok: false, error: 'No se pudo abrir la charla sin cliente.' }
  } else if (organizacion_id === 'nuevo') {
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

/* ------------------------------------------------------------------
   Cheques. Un cheque a noventa días no es un cobro: es una fecha.
   ------------------------------------------------------------------ */

export async function registrarCheque(datos: FormData): Promise<Resultado> {
  const numero = String(datos.get('numero') ?? '').trim()
  const bruto = String(datos.get('importe') ?? '').replace(/\./g, '').replace(',', '.')
  const importe = parseFloat(bruto)

  if (!numero) return { ok: false, error: 'Poné el número del cheque.' }
  if (!Number.isFinite(importe) || importe <= 0) return { ok: false, error: 'El importe no se entiende.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: yo } = await supabase
    .from('usuarios').select('persona_id').eq('id', user?.id ?? '').maybeSingle()

  const { error } = await supabase.from('cheques').insert({
    tipo: String(datos.get('tipo') ?? 'recibido'),
    numero,
    banco: String(datos.get('banco') ?? '').trim() || null,
    importe,
    fecha_cobro: String(datos.get('fecha_cobro') ?? ''),
    organizacion_id: String(datos.get('organizacion_id') ?? '') || null,
    es_echeq: datos.get('es_echeq') === 'on',
    registrado_por: yo?.persona_id ?? null,
  })

  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/agenda')
  return { ok: true }
}

export async function cambiarEstadoCheque(id: string, estado: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('cheques')
    .update({ estado }, { count: 'exact' })
    .eq('id', id)
    .select('id')

  if (error) return { ok: false, error: traducir(error.message) }
  if (count === 0) return { ok: false, error: 'No tenés permiso para tocar los cheques.' }
  revalidatePath('/agenda')
  return { ok: true }
}

export async function borrarCheque(id: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.from('cheques').delete().eq('id', id)
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/agenda')
  return { ok: true }
}

/* ------------------------------------------------------------------
   Borrar un proyecto.

   Solo lo que nunca movió plata. Una carga de prueba, una charla mal
   anotada, un duplicado: eso se borra. Un proyecto con un cobro
   registrado o con una parte ya liquidada es historia, y la historia no
   se borra —se cierra con su motivo, que es distinto y deja rastro.
   ------------------------------------------------------------------ */

export async function borrarProyecto(proyectoId: string): Promise<Resultado> {
  const supabase = await createClient()

  const { data: hitos } = await supabase.from('hitos').select('id').eq('proyecto_id', proyectoId)
  const ids = (hitos ?? []).map((h) => h.id as string)

  if (ids.length > 0) {
    const { count: cobros } = await supabase
      .from('cobros').select('id', { count: 'exact', head: true }).in('hito_id', ids)
    if ((cobros ?? 0) > 0)
      return {
        ok: false,
        error: 'Tiene cobros registrados. Cerralo con su motivo en vez de borrarlo.',
      }

    const { count: pagadas } = await supabase
      .from('porciones').select('id', { count: 'exact', head: true })
      .in('hito_id', ids).in('estado', ['a_liquidar', 'liquidado'])
    if ((pagadas ?? 0) > 0)
      return {
        ok: false,
        error: 'Ya hay partes liquidadas o listas para liquidar. Eso es historia y no se borra.',
      }
  }

  const { count: hijos } = await supabase
    .from('proyectos').select('id', { count: 'exact', head: true }).eq('origen_id', proyectoId)
  if ((hijos ?? 0) > 0)
    return { ok: false, error: 'Tiene un mantenimiento que sale de él. Borrá primero el abono.' }

  const { error, count } = await supabase
    .from('proyectos').delete({ count: 'exact' }).eq('id', proyectoId).select('id')

  if (error) return { ok: false, error: traducir(error.message) }
  if (count === 0) return { ok: false, error: 'No tenés permiso para borrar este proyecto.' }

  revalidatePath('/', 'layout')
  return { ok: true, ir: '/tablero' }
}


/* Asignarle el cliente después: la charla se anotó sin saber de quién
   era y ahora sí se sabe. Se mueve de la sala de espera a su cuenta. */
export async function asignarCliente(
  proyectoId: string,
  clienteId: string,
  clienteNuevo: string,
): Promise<Resultado> {
  let organizacion_id = clienteId

  if (organizacion_id === 'nuevo') {
    if (!clienteNuevo.trim()) return { ok: false, error: 'Poné el nombre del cliente.' }
    const r = await altaDeCuenta(clienteNuevo.trim(), [])
    if ('error' in r) {
      if (r.error.includes('duplicate'))
        return { ok: false, error: 'Ya existe un cliente con ese nombre. Elegilo de la lista.' }
      return { ok: false, error: traducir(r.error) }
    }
    organizacion_id = r.id
  }
  if (!organizacion_id) return { ok: false, error: 'Elegí el cliente.' }

  return guardar(proyectoId, { organizacion_id })
}

/* ------------------------------------------------------------------
   Documentos.

   Se guarda el link, no una copia. Los archivos viven en Drive y se
   siguen editando ahí; una copia acá se desactualiza el primer día y
   después nadie sabe cuál es la buena. Lo que el sistema aporta es lo
   que Drive no sabe: qué se mandó, cuándo y en qué versión.
   ------------------------------------------------------------------ */

function urlValida(u: string) {
  try {
    const x = new URL(u)
    return x.protocol === 'https:' || x.protocol === 'http:'
  } catch {
    return false
  }
}

export async function sumarDocumento(datos: FormData): Promise<Resultado> {
  const titulo = String(datos.get('titulo') ?? '').trim()
  const url = String(datos.get('url') ?? '').trim()

  if (!titulo) return { ok: false, error: 'Poné un nombre al documento.' }
  if (!urlValida(url)) return { ok: false, error: 'El link no se entiende. Tiene que empezar con https://' }

  const enviado = String(datos.get('enviado_at') ?? '')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: yo } = await supabase
    .from('usuarios').select('persona_id').eq('id', user?.id ?? '').maybeSingle()

  const { error } = await supabase.from('documentos').insert({
    proyecto_id: String(datos.get('proyecto_id') ?? '') || null,
    organizacion_id: String(datos.get('organizacion_id') ?? '') || null,
    titulo,
    url,
    clase: String(datos.get('clase') ?? 'otro'),
    version: String(datos.get('version') ?? '').trim() || null,
    enviado_at: enviado ? new Date(enviado + 'T12:00:00').toISOString() : null,
    enviado_por: enviado ? (yo?.persona_id ?? null) : null,
    subido_por: yo?.persona_id ?? null,
  })

  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/proyecto', 'layout')
  revalidatePath('/cuentas', 'layout')
  return { ok: true }
}

export async function marcarEnviado(documentoId: string, fecha: string): Promise<Resultado> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: yo } = await supabase
    .from('usuarios').select('persona_id').eq('id', user?.id ?? '').maybeSingle()

  const { error, count } = await supabase
    .from('documentos')
    .update(
      {
        enviado_at: fecha ? new Date(fecha + 'T12:00:00').toISOString() : null,
        enviado_por: fecha ? (yo?.persona_id ?? null) : null,
      },
      { count: 'exact' },
    )
    .eq('id', documentoId)
    .select('id')

  if (error) return { ok: false, error: traducir(error.message) }
  if (count === 0) return { ok: false, error: 'No tenés permiso para tocar este documento.' }
  revalidatePath('/proyecto', 'layout')
  revalidatePath('/cuentas', 'layout')
  return { ok: true }
}

export async function borrarDocumento(documentoId: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.from('documentos').delete().eq('id', documentoId)
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/proyecto', 'layout')
  revalidatePath('/cuentas', 'layout')
  return { ok: true }
}

export async function cambiarCarpeta(
  tabla: 'proyectos' | 'organizaciones',
  id: string,
  url: string,
): Promise<Resultado> {
  const limpio = url.trim()
  if (limpio && !urlValida(limpio))
    return { ok: false, error: 'El link no se entiende. Tiene que empezar con https://' }

  const supabase = await createClient()
  const { error, count } = await supabase
    .from(tabla)
    .update({ carpeta_url: limpio || null }, { count: 'exact' })
    .eq('id', id)
    .select('id')

  if (error) return { ok: false, error: traducir(error.message) }
  if (count === 0) return { ok: false, error: 'No tenés permiso para cambiar esto.' }
  revalidatePath('/proyecto', 'layout')
  revalidatePath('/cuentas', 'layout')
  return { ok: true }
}


/* Enfriar conserva la etapa: que el cliente deje de contestar no borra
   hasta dónde se había llegado. Reflotar la devuelve exactamente ahí. */

export async function enfriar(proyectoId: string, motivo: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('enfriar', {
    p_proyecto: proyectoId,
    p_motivo: motivo.trim() || null,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function reflotar(proyectoId: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reflotar', { p_proyecto: proyectoId })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/* ------------------------------------------------------------------
   Moneda e IVA.

   El monto guardado siempre es NETO. El IVA se deriva: guardarlo
   aparte es garantizar que algún día los dos números no coincidan.
   ------------------------------------------------------------------ */

export async function cambiarMoneda(proyectoId: string, moneda: string): Promise<Resultado> {
  return guardar(proyectoId, { moneda })
}

export async function cambiarIva(
  proyectoId: string,
  alicuota: string,
  nota: string,
): Promise<Resultado> {
  const valor = Number(alicuota)
  if (![0, 10.5, 21, 27].includes(valor))
    return { ok: false, error: 'Esa alícuota no existe.' }

  return guardar(proyectoId, {
    alicuota_iva: valor,
    nota_iva: nota.trim() || null,
  })
}

export async function anotarCotizacion(moneda: string, valor: string): Promise<Resultado> {
  const n = parseFloat(valor.replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'El valor no se entiende.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('anotar_cotizacion', { p_moneda: moneda, p_valor: n })
  if (error) return { ok: false, error: traducir(error.message) }

  revalidatePath('/', 'layout')
  return { ok: true }
}

/* ------------------------------------------------------------------
   Equipo y permisos.

   Los permisos SUMAN, nunca restan: se otorgan sobre lo que el rol ya
   permite. Así una concesión puntual no puede abrir un agujero por
   debajo de las reglas generales.
   ------------------------------------------------------------------ */

export async function cambiarRoles(personaId: string, roles: string[]): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cambiar_roles', {
    p_persona: personaId,
    p_roles: roles,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function otorgarPermiso(
  personaId: string,
  proyectoId: string,
  accion: string,
  motivo: string,
): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('otorgar_permiso', {
    p_persona: personaId,
    p_proyecto: proyectoId,
    p_accion: accion,
    p_motivo: motivo.trim() || null,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function quitarPermiso(
  personaId: string,
  proyectoId: string,
  accion: string,
): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('quitar_permiso', {
    p_persona: personaId,
    p_proyecto: proyectoId,
    p_accion: accion,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/* ------------------------------------------------------------------
   Qué más ofrecerle.

   Ofrecer no abre una lista aparte: abre una oportunidad en el pipeline
   del mismo cliente. Si fuera otra lista sería una cosa más para mirar,
   y las cosas para mirar se dejan de mirar.
   ------------------------------------------------------------------ */

export async function ofrecerServicio(
  organizacionId: string,
  servicioId: string,
  nombreServicio: string,
  notaId?: string,
): Promise<Resultado> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('proyectos')
    .insert({
      organizacion_id: organizacionId,
      servicio_id: servicioId,
      nombre: nombreServicio,
      color: 'amarillo',
      etapa: 'interes',
      esquema_cobro: 'a_convenir',
      origen: 'cliente_existente',
      proxima_accion: `Proponerle ${nombreServicio.toLowerCase()}`,
    })
    .select('id, codigo')
    .single()

  if (error || !data) return { ok: false, error: traducir(error?.message ?? 'No se pudo abrir') }

  // La nota queda atada a la oportunidad que salió de ella.
  if (notaId) {
    await supabase
      .from('notas_de_venta')
      .update({ estado: 'ofrecida', proyecto_id: data.id })
      .eq('id', notaId)
  }

  revalidatePath('/', 'layout')
  return { ok: true, ir: `/proyecto/${data.codigo}` }
}

export async function anotarParaOfrecer(
  organizacionId: string,
  servicioId: string,
  texto: string,
  cuando: string,
): Promise<Resultado> {
  if (!texto.trim()) return { ok: false, error: 'Escribí qué le podemos ofrecer.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: yo } = await supabase
    .from('usuarios').select('persona_id').eq('id', user?.id ?? '').maybeSingle()

  const { error } = await supabase.from('notas_de_venta').insert({
    organizacion_id: organizacionId,
    servicio_id: servicioId || null,
    texto: texto.trim(),
    cuando: cuando || null,
    anotada_por: yo?.persona_id ?? null,
  })

  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/cuentas', 'layout')
  return { ok: true }
}

export async function descartarNota(notaId: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notas_de_venta').update({ estado: 'no_va' }).eq('id', notaId)
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/cuentas', 'layout')
  return { ok: true }
}

export async function cambiarServicio(proyectoId: string, servicioId: string): Promise<Resultado> {
  return guardar(proyectoId, { servicio_id: servicioId || null })
}

/* ------------------------------------------------------------------
   Lo financiero: la factura que nos deben y los costos fijos.
   ------------------------------------------------------------------ */

export async function marcarFacturaRecibida(
  porcionId: string,
  fecha: string,
  numero: string,
): Promise<Resultado> {
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('porciones')
    .update(
      { factura_at: fecha || null, factura_numero: numero.trim() || null },
      { count: 'exact' },
    )
    .eq('id', porcionId)
    .select('id')

  if (error) return { ok: false, error: traducir(error.message) }
  if (count === 0) return { ok: false, error: 'No tenés permiso para tocar las liquidaciones.' }
  revalidatePath('/admin')
  revalidatePath('/mi-posicion')
  return { ok: true }
}

export async function sumarCostoFijo(datos: FormData): Promise<Resultado> {
  const concepto = String(datos.get('concepto') ?? '').trim()
  const bruto = String(datos.get('monto') ?? '').replace(/\./g, '').replace(',', '.')
  const monto = parseFloat(bruto)

  if (!concepto) return { ok: false, error: 'Poné qué es.' }
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: 'El monto no se entiende.' }

  const supabase = await createClient()
  const { error } = await supabase.from('costos_fijos').insert({
    concepto,
    proveedor: String(datos.get('proveedor') ?? '').trim() || null,
    monto,
    cada: String(datos.get('cada') ?? 'mensual'),
  })

  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/admin')
  return { ok: true }
}

export async function borrarCostoFijo(id: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.from('costos_fijos').delete().eq('id', id)
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/admin')
  return { ok: true }
}

/* ------------------------------------------------------------------
   Las etapas del embudo.

   Salieron del código a la base porque el embudo cambia: es la forma en
   que la agencia trabaja y esa forma se ajusta con el tiempo.
   ------------------------------------------------------------------ */

function aClave(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

export async function guardarEtapa(
  clave: string,
  etiqueta: string,
  ayuda: string,
): Promise<Resultado> {
  const nombre = etiqueta.trim()
  if (!nombre) return { ok: false, error: 'La etapa necesita un nombre.' }

  const llave = clave || aClave(nombre)
  if (!llave) return { ok: false, error: 'Ese nombre no sirve como etapa. Poné al menos una letra.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('guardar_etapa', {
    p_clave: llave,
    p_etiqueta: nombre,
    p_ayuda: ayuda.trim() || null,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function moverEtapa(clave: string, hacia: number): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mover_etapa', { p_clave: clave, p_hacia: hacia })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function apagarEtapa(clave: string, activa: boolean): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('apagar_etapa', { p_clave: clave, p_activa: activa })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function renombrarEstado(
  color: string,
  etiqueta: string,
  ayuda: string,
): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('renombrar_estado', {
    p_color: color,
    p_etiqueta: etiqueta,
    p_ayuda: ayuda,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/* ------------------------------------------------------------------
   Un abono que no viene de un proyecto.

   Hay trabajos que arrancan siendo mantenimiento y nunca hubo un
   desarrollo antes: hosting, redes, soporte de algo que hizo otro. La
   base ya lo permitía —el origen es opcional— pero no había por dónde
   cargarlo, así que la única forma era inventar un proyecto para poder
   cerrarlo, que es exactamente el tipo de dato falso que después
   ensucia todos los números.
   ------------------------------------------------------------------ */

export async function crearAbono(datos: FormData): Promise<Resultado> {
  const nombre = String(datos.get('nombre') ?? '').trim()
  const bruto = String(datos.get('monto_mensual') ?? '').replace(/\./g, '').replace(',', '.')
  const mensual = parseFloat(bruto)
  const desde = String(datos.get('vigencia_desde') ?? '')

  if (!nombre) return { ok: false, error: 'Poné de qué es el abono.' }
  if (!Number.isFinite(mensual) || mensual <= 0)
    return { ok: false, error: 'El monto mensual no se entiende.' }
  if (!desde) return { ok: false, error: 'Poné desde cuándo está vigente.' }

  let organizacion_id = String(datos.get('cliente_id') ?? '')
  if (organizacion_id === 'nuevo') {
    const nuevo = String(datos.get('cliente_nuevo') ?? '').trim()
    if (!nuevo) return { ok: false, error: 'Poné el nombre del cliente.' }
    const r = await altaDeCuenta(nuevo, [])
    if ('error' in r) {
      if (r.error.includes('duplicate'))
        return { ok: false, error: 'Ya existe un cliente con ese nombre. Elegilo de la lista.' }
      return { ok: false, error: traducir(r.error) }
    }
    organizacion_id = r.id
  }
  if (!organizacion_id) return { ok: false, error: 'Elegí el cliente.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proyectos')
    .insert({
      organizacion_id,
      nombre,
      tipo: 'mantenimiento',
      color: 'verde',
      subestado: 'en_curso',
      esquema_cobro: 'mensual',
      monto_mensual: mensual,
      moneda: String(datos.get('moneda') ?? 'ARS'),
      vigencia_desde: desde,
      renovacion_automatica: datos.get('renovacion') === 'on',
      responsable_id: String(datos.get('responsable_id') ?? '') || null,
      servicio_id: String(datos.get('servicio_id') ?? '') || null,
      // Sin origen: no salió de ningún proyecto y está bien que así sea.
      requiere_anticipo: false,
    })
    .select('id, codigo')
    .single()

  if (error || !data) return { ok: false, error: traducir(error?.message ?? 'No se pudo crear') }

  revalidatePath('/', 'layout')
  return { ok: true, ir: `/proyecto/${data.codigo}` }
}

/* ------------------------------------------------------------------
   Personas y sus permisos generales.

   El rol trae permisos por defecto; el ajuste por persona los corre en
   cualquiera de las dos direcciones y queda marcado como ajuste. Ver
   quién está fuera de lo que su rol dice es lo que evita que con el
   tiempo los permisos sean un misterio que nadie se anima a tocar.
   ------------------------------------------------------------------ */

export async function guardarPersona(
  personaId: string,
  nombre: string,
  email: string,
  telefono: string,
  activa: boolean,
  esExterna: boolean,
): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('guardar_persona', {
    p_persona: personaId,
    p_nombre: nombre,
    p_email: email,
    p_telefono: telefono,
    p_activa: activa,
    p_es_externa: esExterna,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function crearPersona(datos: FormData): Promise<Resultado> {
  const nombre = String(datos.get('nombre') ?? '').trim()
  if (!nombre) return { ok: false, error: 'Poné el nombre.' }

  const roles = datos.getAll('roles').map(String)

  const supabase = await createClient()
  const { error } = await supabase.rpc('crear_persona', {
    p_nombre: nombre,
    p_email: String(datos.get('email') ?? '').trim() || null,
    p_roles: roles,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function ajustarPermiso(
  personaId: string,
  accion: string,
  otorgado: boolean,
): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('ajustar_permiso', {
    p_persona: personaId,
    p_accion: accion,
    p_otorgado: otorgado,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function soltarPermiso(personaId: string, accion: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('soltar_permiso', {
    p_persona: personaId,
    p_accion: accion,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/* ------------------------------------------------------------------
   El reparto y el cierre de un abono.

   El reparto era la pieza que faltaba: el sistema calculaba porciones y
   liquidaciones a partir de participaciones que no se podían ver desde
   ninguna pantalla. Un número que sale de algo invisible no se puede
   creer.
   ------------------------------------------------------------------ */

export async function guardarReparto(
  proyectoId: string,
  personaId: string,
  concepto: string,
  porcentaje: string,
  apertura: string,
): Promise<Resultado> {
  const pct = parseFloat(porcentaje.replace(',', '.'))
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100)
    return { ok: false, error: 'El porcentaje tiene que estar entre 0 y 100.' }

  const esCrossity = personaId === 'casa'

  const supabase = await createClient()
  const { error } = await supabase.rpc('guardar_reparto', {
    p_proyecto: proyectoId,
    p_persona: esCrossity ? null : personaId,
    p_es_crossity: esCrossity,
    p_concepto: concepto,
    p_porcentaje: pct,
    p_apertura: apertura,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/proyecto', 'layout')
  revalidatePath('/admin')
  return { ok: true }
}

export async function quitarReparto(participacionId: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('quitar_reparto', { p_participacion: participacionId })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/proyecto', 'layout')
  return { ok: true }
}

export async function cambiarVigencia(
  proyectoId: string,
  campo: 'vigencia_desde' | 'vigencia_hasta',
  fecha: string,
): Promise<Resultado> {
  return guardar(proyectoId, { [campo]: fecha || null })
}

export async function cerrarMantenimiento(
  proyectoId: string,
  hasta: string,
  motivo: string,
): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cerrar_mantenimiento', {
    p_proyecto: proyectoId,
    p_hasta: hasta || new Date().toISOString().slice(0, 10),
    p_motivo: motivo.trim() || null,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function reabrirMantenimiento(proyectoId: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reabrir_mantenimiento', { p_proyecto: proyectoId })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/* ------------------------------------------------------------------
   Abonos por consumo.

   Hay servicios que se liquidan a mes vencido según lo que se usó: el
   agente cobra por conversación. Forzarlos a un monto fijo hace que el
   cashflow proyecte un número que no es, y que la factura salga tarde
   porque alguien tiene que ir a buscar el consumo a otro lado.
   ------------------------------------------------------------------ */

export async function cambiarModalidad(
  proyectoId: string,
  modalidad: string,
  unidad: string,
  precio: string,
  incluido: string,
): Promise<Resultado> {
  const numero = (v: string) => {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  return guardar(proyectoId, {
    modalidad,
    unidad_consumo: unidad.trim() || null,
    precio_unitario: numero(precio),
    incluido_en_base: modalidad === 'fijo_mas_consumo' ? numero(incluido) : null,
  })
}

export async function anotarConsumo(
  proyectoId: string,
  periodo: string,
  cantidad: string,
  notas: string,
): Promise<Resultado> {
  const n = parseFloat(cantidad.replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'La cantidad no se entiende.' }
  if (!periodo) return { ok: false, error: 'Elegí de qué mes es.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('anotar_consumo', {
    p_proyecto: proyectoId,
    p_periodo: periodo,
    p_cantidad: n,
    p_notas: notas.trim() || null,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function borrarConsumo(id: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.from('consumos').delete().eq('id', id)
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function fecharConsumo(
  id: string,
  campo: 'facturado_at' | 'cobrado_at',
  fecha: string,
): Promise<Resultado> {
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('consumos')
    .update({ [campo]: fecha || null }, { count: 'exact' })
    .eq('id', id)
    .select('id')
  if (error) return { ok: false, error: traducir(error.message) }
  if (count === 0) return { ok: false, error: 'No tenés permiso para tocar esto.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function moverEstado(color: string, hacia: number): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mover_estado', { p_color: color, p_hacia: hacia })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/* ------------------------------------------------------------------
   Lo que se descuenta antes de repartir.

   Gastos e impuestos ya se restaban de la base de reparto desde el
   primer día, pero no había pantalla para cargarlos. Un cálculo
   correcto e invisible es, en la práctica, un cálculo que no está: si
   nadie puede cargar la retención, la retención se descuenta a mano en
   otro lado y el sistema queda mintiendo.
   ------------------------------------------------------------------ */

function numero(v: string) {
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export async function anotarImpuesto(datos: FormData): Promise<Resultado> {
  const concepto = String(datos.get('concepto') ?? '').trim()
  if (!concepto) return { ok: false, error: 'Poné qué se descuenta.' }

  const alicuota = numero(String(datos.get('alicuota') ?? ''))
  const base = numero(String(datos.get('base') ?? ''))
  const monto = numero(String(datos.get('monto') ?? ''))

  if (monto === null && (alicuota === null || base === null))
    return { ok: false, error: 'Poné el monto, o la alícuota y sobre cuánto se aplica.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('anotar_impuesto', {
    p_proyecto: String(datos.get('proyecto_id') ?? ''),
    p_hito: String(datos.get('hito_id') ?? '') || null,
    p_concepto: concepto,
    p_jurisdiccion: String(datos.get('jurisdiccion') ?? 'nacional'),
    p_alicuota: alicuota,
    p_base: base,
    p_monto: monto,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/proyecto', 'layout')
  revalidatePath('/admin')
  return { ok: true }
}

export async function anotarGasto(datos: FormData): Promise<Resultado> {
  const descripcion = String(datos.get('descripcion') ?? '').trim()
  const neto = numero(String(datos.get('neto') ?? ''))

  if (!descripcion) return { ok: false, error: 'Poné qué se gastó.' }
  if (neto === null || neto <= 0) return { ok: false, error: 'El monto no se entiende.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('anotar_gasto', {
    p_proyecto: String(datos.get('proyecto_id') ?? ''),
    p_hito: String(datos.get('hito_id') ?? '') || null,
    p_descripcion: descripcion,
    p_proveedor: String(datos.get('proveedor') ?? ''),
    p_neto: neto,
    p_alicuota: numero(String(datos.get('alicuota') ?? '21')) ?? 21,
    p_discriminado: datos.get('discriminado') === 'on',
    p_fecha: String(datos.get('fecha') ?? '') || null,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/proyecto', 'layout')
  revalidatePath('/admin')
  return { ok: true }
}

export async function borrarDescuento(clase: string, id: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('borrar_descuento', { p_clase: clase, p_id: id })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/proyecto', 'layout')
  return { ok: true }
}

/* ------------------------------------------------------------------
   Hacer entrar a alguien la primera vez.

   El problema real no era cambiar contraseñas: era que no había forma
   de que una persona nueva entrara nunca. Se resuelve con un enlace de
   un solo uso que se le pasa por donde sea —correo, WhatsApp— y con el
   que la persona se pone SU contraseña.

   Es mejor que asignarle una: una contraseña que vos elegís y le mandás
   pasa por tu pantalla, por el chat y se queda ahí para siempre. Un
   enlace se usa una vez y se vence.
   ------------------------------------------------------------------ */

export type Invitacion = { ok: true; enlace: string; nueva: boolean } | { ok: false; error: string }

export async function invitarPersona(personaId: string): Promise<Invitacion> {
  const supabase = await createClient()

  // Quién pide, antes de tocar nada con la clave de servicio.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: yo } = await supabase
    .from('usuarios')
    .select('personas(roles)')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const roles = (yo?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []
  if (!roles.includes('direccion') && !roles.includes('administracion'))
    return { ok: false, error: 'Solo dirección o administración pueden invitar.' }

  const { data: persona } = await supabase
    .from('personas')
    .select('nombre, email')
    .eq('id', personaId)
    .maybeSingle()

  if (!persona?.email)
    return { ok: false, error: 'Esa persona no tiene correo cargado. Ponéselo primero.' }

  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://crossity-crm-joels-projects-5fc2b32d.vercel.app'

  let admin
  try {
    admin = (await import('@/lib/supabase/admin')).clienteAdmin()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falta la clave de servicio.' }
  }

  // ¿Ya tiene cuenta? Cambia el tipo de enlace, no el resultado.
  const { data: cuentas } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existe = cuentas?.users.find(
    (u) => u.email?.toLowerCase() === persona.email!.toLowerCase(),
  )

  const { data, error } = await admin.auth.admin.generateLink({
    type: existe ? 'recovery' : 'invite',
    email: persona.email,
    options: { redirectTo: `${sitio}/clave` },
  })

  if (error || !data?.properties?.action_link)
    return { ok: false, error: traducir(error?.message ?? 'No se pudo generar el enlace') }

  revalidatePath('/equipo')
  return { ok: true, enlace: data.properties.action_link, nueva: !existe }
}

/* ------------------------------------------------------------------
   Dar de baja a una persona.

   Son dos cosas distintas y confundirlas es cómo se pierde historia sin
   querer. Quitarle el acceso deja de poder entrar pero su nombre sigue
   en los proyectos donde participó: eso es lo que se necesita cuando
   alguien deja el equipo. Borrarla solo tiene sentido si nunca hizo
   nada — una carga de prueba, un duplicado.
   ------------------------------------------------------------------ */

async function soyQuienPuede(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: yo } = await supabase
    .from('usuarios')
    .select('personas(roles)')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const roles = (yo?.personas as unknown as { roles: string[] } | undefined)?.roles ?? []
  return roles.includes('direccion') || roles.includes('administracion')
    ? null
    : 'Solo dirección o administración pueden hacer esto.'
}

export async function quitarAcceso(personaId: string): Promise<Resultado> {
  const noPuede = await soyQuienPuede()
  if (noPuede) return { ok: false, error: noPuede }

  const supabase = await createClient()
  const { data: usuarioId, error } = await supabase.rpc('soltar_usuario', { p_persona: personaId })
  if (error) return { ok: false, error: traducir(error.message) }

  // La cuenta de Supabase la borra el cliente de administración: si
  // quedara viva, la persona podría volver a entrar sin ficha.
  try {
    const admin = (await import('@/lib/supabase/admin')).clienteAdmin()
    await admin.auth.admin.deleteUser(usuarioId as string)
  } catch {
    revalidatePath('/equipo')
    return {
      ok: false,
      error:
        'Se desvinculó la ficha, pero la cuenta sigue viva en Supabase: falta la clave de servicio. ' +
        'Borrala a mano desde Authentication → Users.',
    }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function borrarPersona(personaId: string): Promise<Resultado> {
  const noPuede = await soyQuienPuede()
  if (noPuede) return { ok: false, error: noPuede }

  const supabase = await createClient()
  const { error } = await supabase.rpc('borrar_persona', { p_persona: personaId })
  if (error) return { ok: false, error: traducir(error.message) }

  revalidatePath('/', 'layout')
  return { ok: true }
}

/* ------------------------------------------------------------------
   Los accesos.

   Hay dos padrones: las cuentas de Supabase, que solo sirven para
   entrar, y las personas del CRM, que son quienes participan y cobran.
   Se vinculan por correo y eso falla calladito cuando el orden no es el
   esperado o cuando una letra del correo no coincide. El resultado es
   alguien que entra y no ve nada, sin ningún lugar donde enterarse.

   Esto es ese lugar.
   ------------------------------------------------------------------ */

export type Cuenta = {
  id: string
  email: string
  creada: string
  confirmada: boolean
  ultimoIngreso: string | null
  persona: { id: string; nombre: string } | null
}

export type Accesos =
  | { ok: true; cuentas: Cuenta[]; sinCuenta: { id: string; nombre: string; email: string }[] }
  | { ok: false; error: string }

export async function revisarAccesos(): Promise<Accesos> {
  const noPuede = await soyQuienPuede()
  if (noPuede) return { ok: false, error: noPuede }

  let admin
  try {
    admin = (await import('@/lib/supabase/admin')).clienteAdmin()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falta la clave de servicio.' }
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return { ok: false, error: traducir(error.message) }

  const supabase = await createClient()
  const [{ data: vinculos }, { data: personas }] = await Promise.all([
    supabase.from('usuarios').select('id, personas(id, nombre)'),
    supabase.from('personas').select('id, nombre, email').eq('activa', true).order('nombre'),
  ])

  const porCuenta = new Map(
    ((vinculos ?? []) as Record<string, unknown>[]).map((v) => [
      v.id as string,
      v.personas as unknown as { id: string; nombre: string } | null,
    ]),
  )

  const cuentas: Cuenta[] = data.users.map((u) => ({
    id: u.id,
    email: u.email ?? '(sin correo)',
    creada: u.created_at,
    confirmada: !!u.email_confirmed_at,
    ultimoIngreso: u.last_sign_in_at ?? null,
    persona: porCuenta.get(u.id) ?? null,
  }))

  const conCuenta = new Set([...porCuenta.values()].filter(Boolean).map((p) => p!.id))
  const sinCuenta = ((personas ?? []) as { id: string; nombre: string; email: string | null }[])
    .filter((p) => !conCuenta.has(p.id))
    .map((p) => ({ id: p.id, nombre: p.nombre, email: p.email ?? '' }))

  return { ok: true, cuentas, sinCuenta }
}

export async function vincularCuenta(usuarioId: string, personaId: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('vincular_cuenta', {
    p_usuario: usuarioId,
    p_persona: personaId,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function repararVinculos(): Promise<Resultado> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('reparar_vinculos')
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  const cuantos = typeof data === 'number' ? data : 0
  return cuantos > 0
    ? { ok: true }
    : { ok: false, error: 'No había ninguna cuenta suelta que coincidiera por correo.' }
}

export async function borrarCuentaSuelta(usuarioId: string): Promise<Resultado> {
  const noPuede = await soyQuienPuede()
  if (noPuede) return { ok: false, error: noPuede }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id === usuarioId) return { ok: false, error: 'Esa es tu propia cuenta.' }

  const { data: vinculada } = await supabase.from('usuarios').select('id').eq('id', usuarioId).maybeSingle()
  if (vinculada)
    return { ok: false, error: 'Esa cuenta está vinculada a una persona. Quitale el acceso desde su ficha.' }

  try {
    const admin = (await import('@/lib/supabase/admin')).clienteAdmin()
    const { error } = await admin.auth.admin.deleteUser(usuarioId)
    if (error) return { ok: false, error: traducir(error.message) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falta la clave de servicio.' }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function cambiarAcceso(personaId: string, activo: boolean): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cambiar_acceso', {
    p_persona: personaId,
    p_activo: activo,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/* ------------------------------------------------------------------
   Archivar.

   Archivar no es un estado: el estado dice cómo cerró algo, el
   archivado dice si sigue en el escritorio. Son independientes y por
   eso viven separados.
   ------------------------------------------------------------------ */

export async function archivarProyecto(proyectoId: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('archivar', { p_proyecto: proyectoId })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function desarchivarProyecto(proyectoId: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('desarchivar', { p_proyecto: proyectoId })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function archivarLoCerrado(): Promise<Resultado> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('archivar_lo_cerrado')
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  const cuantos = typeof data === 'number' ? data : 0
  return cuantos > 0
    ? { ok: true }
    : { ok: false, error: 'No había nada cerrado hace más de un mes.' }
}

/* ------------------------------------------------------------------
   Las columnas del tablero.

   No se crean ni se borran: cada una es un recorte de un color que la
   base ya define, y un color nuevo rompería reglas que existen por
   buenas razones. Lo que cambia es cómo se llaman, en qué orden se
   miran, y si molestan todos los días o viven plegadas al pie.
   ------------------------------------------------------------------ */

export async function renombrarColumna(
  clave: string,
  etiqueta: string,
  ayuda: string,
): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('renombrar_columna', {
    p_clave: clave,
    p_etiqueta: etiqueta,
    p_ayuda: ayuda,
  })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function moverColumna(clave: string, hacia: number): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mover_columna', { p_clave: clave, p_hacia: hacia })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function cambiarZona(clave: string, zona: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cambiar_zona', { p_clave: clave, p_zona: zona })
  if (error) return { ok: false, error: traducir(error.message) }
  revalidatePath('/', 'layout')
  return { ok: true }
}
