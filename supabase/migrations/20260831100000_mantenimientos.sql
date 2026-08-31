-- ============================================================
-- Proyecto y mantenimiento: la misma forma, distinta naturaleza.
--
-- Un proyecto termina. Un mantenimiento no: se renueva o se cae.
-- Casi siempre el mantenimiento nace de un proyecto entregado, pero
-- a veces arranca solo (se toma un sistema ajeno, o es un abono desde
-- el día uno).
-- ============================================================

create type tipo_trabajo as enum ('proyecto', 'mantenimiento');

alter table proyectos
  add column tipo            tipo_trabajo not null default 'proyecto',
  -- de qué proyecto viene este mantenimiento. Null si arrancó solo.
  add column origen_id       uuid references proyectos(id) on delete set null,
  add column vigencia_desde  date,
  add column vigencia_hasta  date,
  add column monto_mensual   numeric(14,2),
  add column renovacion_automatica boolean not null default false;

comment on column proyectos.origen_id is
  'La trazabilidad del pasaje: de qué construcción salió este mantenimiento.';

comment on column proyectos.vigencia_hasta is
  'Null es lo normal: un mantenimiento vigente no tiene fecha de fin, tiene fecha de baja.';

alter table proyectos
  add constraint mantenimiento_tiene_vigencia check (
    tipo <> 'mantenimiento' or vigencia_desde is not null
  ),
  add constraint origen_solo_en_mantenimiento check (
    origen_id is null or tipo = 'mantenimiento'
  ),
  add constraint origen_no_es_si_mismo check (
    origen_id is null or origen_id <> id
  );

-- Un mantenimiento sano se cobra por mes.
create or replace function esquema_por_defecto()
returns trigger
language plpgsql
as $$
begin
  if NEW.tipo = 'mantenimiento' and NEW.esquema_cobro = 'a_convenir' then
    NEW.esquema_cobro := 'mensual';
  end if;
  return NEW;
end;
$$;

create trigger proyectos_esquema_por_defecto
  before insert on proyectos
  for each row execute function esquema_por_defecto();

-- ------------------------------------------------------------
-- El pasaje. Entregar no es terminar: es el momento en que
-- empieza a facturarse todos los meses, y es justo donde hoy
-- se pierde plata por no registrarlo.
-- ------------------------------------------------------------

create or replace function pasar_a_mantenimiento(
  p_proyecto       uuid,
  p_monto_mensual  numeric,
  p_desde          date default current_date,
  p_copiar_reparto boolean default true
)
returns uuid
language plpgsql
as $$
declare
  v_origen  proyectos%rowtype;
  v_nuevo   uuid;
begin
  select * into v_origen from proyectos where id = p_proyecto;

  if v_origen.id is null then
    raise exception 'No existe el proyecto %', p_proyecto;
  end if;

  if v_origen.tipo = 'mantenimiento' then
    raise exception 'El % ya es un mantenimiento', v_origen.codigo;
  end if;

  if exists (select 1 from proyectos where origen_id = p_proyecto) then
    raise exception 'El % ya tiene su mantenimiento', v_origen.codigo;
  end if;

  insert into proyectos (
    organizacion_id, contrato_id, nombre, unidad, tipo, origen_id,
    color, subestado, esquema_cobro, monto_mensual, vigencia_desde,
    responsable_id, renovacion_automatica, condicion, es_producto_propio
  ) values (
    v_origen.organizacion_id, v_origen.contrato_id,
    'Mantenimiento · ' || v_origen.nombre,
    v_origen.unidad, 'mantenimiento', v_origen.id,
    'verde', 'en_curso', 'mensual', p_monto_mensual, p_desde,
    v_origen.responsable_id, true, 'normal', v_origen.es_producto_propio
  ) returning id into v_nuevo;

  -- El reparto suele continuar, pero se puede editar: mantener no es
  -- lo mismo que construir, y el que construyó puede no ser el que mantiene.
  if p_copiar_reparto then
    insert into participaciones (proyecto_id, persona_id, es_crossity, concepto, porcentaje, apertura)
    select v_nuevo, persona_id, es_crossity, concepto, porcentaje, apertura
      from participaciones where proyecto_id = p_proyecto;
  end if;

  insert into actualizaciones (proyecto_id, tipo, texto, canal)
  values (v_nuevo, 'administrativo',
          'Nace del proyecto ' || v_origen.codigo || '. Abono mensual desde el '
            || to_char(p_desde, 'DD/MM/YYYY') || '.',
          'sistema');

  insert into actualizaciones (proyecto_id, tipo, texto, canal)
  values (p_proyecto, 'administrativo',
          'Entregado y pasado a mantenimiento.', 'sistema');

  return v_nuevo;
end;
$$;

comment on function pasar_a_mantenimiento is
  'Entregar un proyecto sin abrir su mantenimiento es dejar de facturar sin haberlo decidido.';

-- ------------------------------------------------------------
-- Ingreso recurrente. Un número que hoy no existe en ningún lado.
-- ------------------------------------------------------------

create or replace view v_recurrentes
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico as cliente,
  p.monto_mensual,
  p.vigencia_desde,
  p.vigencia_hasta,
  p.renovacion_automatica,
  p.color,
  orig.codigo as viene_de,
  (p.vigencia_hasta is not null and p.vigencia_hasta <= current_date + 60) as vence_pronto
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join proyectos orig on orig.id = p.origen_id
where p.tipo = 'mantenimiento'
  and p.color <> 'rojo';

comment on view v_recurrentes is
  'Cuánto entra todos los meses pase lo que pase. La base de la empresa que no depende de vender de nuevo.';

-- Proyectos entregados que nunca pasaron a mantenimiento.
-- Cada fila acá es plata que se dejó de facturar sin decidirlo.
create or replace view v_sin_mantenimiento
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico as cliente,
  p.fecha_comprometida
from proyectos p
join organizaciones o on o.id = p.organizacion_id
where p.tipo = 'proyecto'
  and p.color = 'rojo'
  and p.motivo_rojo = 'entregado'
  and not exists (select 1 from proyectos m where m.origen_id = p.id);

grant select on v_recurrentes, v_sin_mantenimiento to authenticated;
