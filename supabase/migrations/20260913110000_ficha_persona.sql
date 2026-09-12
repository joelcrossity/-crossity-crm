-- ============================================================
-- La ficha de una persona: qué le queda por hacer y qué se le debe.
--
-- Casi todo esto ya estaba en el modelo y no hacía falta ninguna tabla
-- nueva. Vale la pena decir por qué, porque la tentación era crear una
-- tabla `tareas`:
--
--   Lo que alguien tiene por hacer YA existe: son las entregas de los
--   proyectos donde está asignado y que todavía no se entregaron. Crear
--   una tabla de tareas al lado habría partido la verdad en dos —una
--   entrega marcada como hecha y una tarea que sigue abierta— y esa
--   desincronización no se arregla, se administra para siempre.
--
--   Lo que se le debe también existe: son sus porciones. Nada nuevo.
--
-- Lo que sí faltaba son tres lecturas: qué le queda por hacer ordenado
-- por cliente, si algo está trabado y por qué, y cuánto tiene encima.
-- ============================================================

-- ------------------------------------------------------------
-- Lo que le queda por hacer.
--
-- Hereda la RLS de hitos y proyectos: cada uno ve las suyas, y quien ve
-- todo ve las de todos. La "dependencia" no es un campo nuevo: sale de
-- mirar por qué el proyecto está detenido.
-- ------------------------------------------------------------

create or replace view v_pendientes
with (security_invoker = true)
as
select
  h.id,
  h.titulo,
  h.entregable,
  h.orden,
  h.monto_neto,
  h.moneda,
  h.fecha_comprometida,
  h.vence_at,
  p.id            as proyecto_id,
  p.codigo        as proyecto_codigo,
  p.nombre        as proyecto,
  p.color,
  p.motivo_gris,
  p.prioridad,
  o.id            as organizacion_id,
  o.codigo        as cliente_codigo,
  o.nombre_canonico as cliente,
  a.persona_id,
  a.rol           as rol_en_el_proyecto,

  -- Qué tan urgente, en una sola columna para poder ordenar.
  case
    when p.color = 'gris' then 'trabado'
    when h.fecha_comprometida < current_date then 'vencida'
    when h.fecha_comprometida <= current_date + 7 then 'esta_semana'
    else 'en_curso'
  end as urgencia,

  -- Por qué está trabada, dicho en castellano. No es un campo: se
  -- deduce del estado, así que no se puede desactualizar.
  case
    when p.color <> 'gris' then null
    when p.motivo_gris = 'esperando_anticipo' then 'No entró el anticipo del cliente'
    when p.motivo_gris = 'pausado_cliente'    then 'El cliente lo pausó'
    when p.motivo_gris = 'dormido'            then 'Se durmió y nadie lo movió'
    else 'El proyecto está frenado'
  end as trabada_porque,

  (h.fecha_comprometida - current_date) as dias_para_entregar
from hitos h
join proyectos p      on p.id = h.proyecto_id
join organizaciones o on o.id = p.organizacion_id
join asignaciones a   on a.proyecto_id = p.id and a.hasta is null
where h.entregado_at is null
  and p.archivado_at is null
  and p.color in ('verde', 'gris')
  and p.tipo = 'proyecto';

grant select on v_pendientes to authenticated;

comment on view v_pendientes is
  'Lo que alguien tiene por hacer son las entregas de sus proyectos. Una tabla de tareas al lado habría partido la verdad en dos: una entrega marcada hecha y una tarea abierta, y eso no se arregla, se administra para siempre.';

-- ------------------------------------------------------------
-- Cuánto tiene encima cada uno.
--
-- No hay una capacidad real cargada en ningún lado —nadie declaró que
-- Tomás trabaja treinta horas semanales— así que esto no es un
-- porcentaje de ocupación, es un conteo. Se llama carga y no capacidad
-- a propósito: inventar un denominador daría un número preciso y falso.
-- ------------------------------------------------------------

create or replace view v_carga
with (security_invoker = true)
as
select
  pe.id            as persona_id,
  pe.nombre,
  count(distinct a.proyecto_id) filter (where p.color = 'verde')   as proyectos_en_vivo,
  count(distinct a.proyecto_id) filter (where p.color = 'gris')    as proyectos_trabados,
  count(h.id) filter (where h.entregado_at is null)                as entregas_pendientes,
  count(h.id) filter (
    where h.entregado_at is null and h.fecha_comprometida < current_date
  )                                                                as entregas_vencidas,
  count(h.id) filter (
    where h.entregado_at is null
      and h.fecha_comprometida between current_date and current_date + 7
  )                                                                as entregas_esta_semana,
  min(h.fecha_comprometida) filter (where h.entregado_at is null)  as proxima_entrega
from personas pe
left join asignaciones a on a.persona_id = pe.id and a.hasta is null
left join proyectos p    on p.id = a.proyecto_id
                        and p.archivado_at is null
                        and p.tipo = 'proyecto'
                        and p.color in ('verde', 'gris')
left join hitos h        on h.proyecto_id = p.id
where pe.activa
group by pe.id, pe.nombre;

grant select on v_carga to authenticated;

comment on view v_carga is
  'Se llama carga y no capacidad porque nadie declaró cuántas horas trabaja cada uno. Inventar ese denominador daría un porcentaje preciso y falso.';

-- ------------------------------------------------------------
-- La posición de una persona, para su ficha.
--
-- v_mi_posicion muestra la propia. Esto muestra la de cualquiera, y por
-- eso el filtro es explícito: o sos vos, o ves la plata de todos.
-- ------------------------------------------------------------

create or replace view v_posicion_de
with (security_invoker = true)
as
select
  pa.persona_id,
  p.id       as proyecto_id,
  p.codigo   as proyecto_codigo,
  p.nombre   as proyecto,
  o.nombre_canonico as cliente,
  pa.concepto,
  pa.porcentaje,
  h.moneda,
  coalesce(sum(po.monto) filter (where po.estado = 'comprometido'), 0) as comprometido,
  coalesce(sum(po.monto) filter (where po.estado = 'devengado'), 0)    as devengado,
  coalesce(sum(po.monto) filter (where po.estado = 'a_liquidar'), 0)   as a_liquidar,
  coalesce(sum(po.monto) filter (where po.estado = 'liquidado'), 0)    as liquidado,
  bool_or(po.factura_at is null and po.estado = 'a_liquidar')          as falta_su_factura
from participaciones pa
join proyectos p      on p.id = pa.proyecto_id
join organizaciones o on o.id = p.organizacion_id
left join porciones po on po.participacion_id = pa.id
left join hitos h      on h.id = po.hito_id
where pa.persona_id is not null
  and (pa.persona_id = persona_actual() or es_direccion() or es_admin())
group by pa.persona_id, p.id, p.codigo, p.nombre, o.nombre_canonico,
         pa.concepto, pa.porcentaje, h.moneda;

grant select on v_posicion_de to authenticated;

comment on view v_posicion_de is
  'El filtro es explícito porque acá se pide la plata de alguien por su id: o sos vos, o ves la de todos. No alcanza con heredar la RLS de porciones.';

-- ------------------------------------------------------------
-- La agenda de una persona: lo suyo, con su cliente.
-- ------------------------------------------------------------

create or replace view v_agenda_persona
with (security_invoker = true)
as
select
  'e' || h.id             as clave,
  a.persona_id,
  'entrega'::text         as clase,
  h.fecha_comprometida    as fecha,
  h.titulo,
  p.nombre                as proyecto,
  p.codigo,
  o.nombre_canonico       as cliente,
  (h.fecha_comprometida < current_date) as vencido
from hitos h
join proyectos p      on p.id = h.proyecto_id
join organizaciones o on o.id = p.organizacion_id
join asignaciones a   on a.proyecto_id = p.id and a.hasta is null
where h.fecha_comprometida is not null
  and h.entregado_at is null
  and p.archivado_at is null
  and p.color in ('verde', 'amarillo', 'gris');

grant select on v_agenda_persona to authenticated;
