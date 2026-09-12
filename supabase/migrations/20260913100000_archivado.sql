-- ============================================================
-- Archivado e historial.
--
-- La decisión de fondo: archivar NO es un estado más.
--
-- Un proyecto ya tiene estado —en vivo, frenado, terminado, perdido— y
-- una oportunidad tiene etapa. Agregar "archivado" a esa lista sería el
-- error: obligaría a elegir entre decir CÓMO terminó algo y decir que
-- ya no querés verlo, cuando son dos cosas independientes.
--
-- Un proyecto puede estar terminado y seguir a la vista porque estás por
-- abrirle el abono. Y puede estar perdido hace dos años y no molestar a
-- nadie. El estado dice cómo cerró; el archivado dice si sigue en el
-- escritorio.
--
-- Por eso va como una marca aparte, y como fecha en vez de sí/no: una
-- fecha contesta además "cuándo", que es justo lo que la pantalla de
-- historial necesita mostrar y ordenar.
-- ============================================================

alter table proyectos
  add column archivado_at   timestamptz,
  add column archivado_por  uuid references personas(id) on delete set null;

comment on column proyectos.archivado_at is
  'Null es activo. Fecha en vez de sí/no porque contesta además cuándo, que es lo que el historial ordena.';

create index proyectos_activos on proyectos (color) where archivado_at is null;
create index proyectos_archivados on proyectos (archivado_at desc) where archivado_at is not null;

-- ------------------------------------------------------------
-- Las vistas de trabajo diario dejan de mostrar lo archivado.
-- ------------------------------------------------------------

drop view if exists v_tablero;

create view v_tablero
with (security_invoker = true)
as
select
  p.id, p.codigo, p.nombre,
  o.nombre_canonico as cliente,
  o.codigo          as cliente_codigo,
  p.color, p.subestado, p.motivo_gris, p.prioridad, p.fecha_comprometida,
  p.es_producto_propio, p.condicion, p.tipo,
  r.nombre          as responsable,
  (current_date - p.fecha_comprometida) as dias_de_atraso,
  extract(day from now() - coalesce(
      (select max(a.ocurrido_at) from actualizaciones a where a.proyecto_id = p.id),
      p.created_at))::int as dias_sin_novedades
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas r  on r.id = p.responsable_id
where p.tipo = 'proyecto'
  and (p.etapa is null or p.etapa = 'ganado')
  and p.archivado_at is null;

drop view if exists v_pipeline;

create view v_pipeline
with (security_invoker = true)
as
select
  p.id, p.codigo, p.nombre,
  o.nombre_canonico as cliente,
  p.etapa, p.nurturing, p.origen, p.origen_detalle,
  p.monto_neto, p.moneda, p.proxima_accion, p.proximo_seguimiento,
  pe.nombre as vendedor,
  (p.proximo_seguimiento is null)                                        as sin_agendar,
  (p.proximo_seguimiento < now())                                        as seguimiento_vencido,
  (p.etapa in ('cotizado','negociacion') and p.nurturing <> 'completado') as negocia_sin_base,
  (p.etapa in ('cotizado','negociacion') and p.monto_neto is null)        as cotizado_sin_monto,
  (p.color = 'gris' and p.motivo_gris = 'no_se_dio')                     as enfriada
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas pe on pe.id = p.responsable_id
where p.etapa is not null
  and p.etapa <> 'ganado'
  and p.archivado_at is null
  and (p.color = 'amarillo' or (p.color = 'gris' and p.motivo_gris = 'no_se_dio'));

grant select on v_tablero, v_pipeline to authenticated;

-- ------------------------------------------------------------
-- El historial.
--
-- Hereda la RLS de proyectos: quien solo ve los suyos, ve solo los
-- suyos archivados. No hace falta ninguna regla nueva, y eso es
-- deseable — una regla nueva es una que se puede olvidar de aplicar.
-- ------------------------------------------------------------

create or replace view v_archivados
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico as cliente,
  o.codigo          as cliente_codigo,
  p.tipo,
  p.etapa,
  p.color,
  p.motivo_gris,
  p.motivo_rojo,
  p.subestado,
  p.monto_neto,
  p.moneda,
  p.fecha_comprometida,
  p.archivado_at,
  quien.nombre      as archivado_por,
  resp.nombre       as responsable,
  s.nombre          as servicio,
  -- Qué es: lo que sigue en el embudo es una oportunidad; lo demás,
  -- trabajo que existió.
  (p.etapa is not null and p.etapa <> 'ganado') as era_oportunidad,
  coalesce((select sum(h.monto_neto) from hitos h
             where h.proyecto_id = p.id and h.cobrado_at is not null), 0) as cobrado
from proyectos p
join organizaciones o   on o.id = p.organizacion_id
left join personas quien on quien.id = p.archivado_por
left join personas resp  on resp.id = p.responsable_id
left join servicios s    on s.id = p.servicio_id
where p.archivado_at is not null;

grant select on v_archivados to authenticated;

comment on view v_archivados is
  'Hereda la RLS de proyectos: quien ve solo los suyos, ve solo los suyos archivados. Una regla nueva sería una que se puede olvidar de aplicar.';

-- ------------------------------------------------------------
-- Lo que ya se podría archivar.
--
-- Cerrado hace más de un mes y todavía en el escritorio. Se sugiere,
-- no se hace solo: que algo desaparezca de la pantalla sin que nadie lo
-- pida es la forma más rápida de que la gente deje de confiar en lo que
-- ve. Con un click, y avisando cuántos son.
-- ------------------------------------------------------------

create or replace view v_para_archivar
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico as cliente,
  p.color,
  p.etapa,
  (p.etapa is not null and p.etapa <> 'ganado') as era_oportunidad,
  greatest(
    extract(day from now() - coalesce(
      (select max(a.ocurrido_at) from actualizaciones a where a.proyecto_id = p.id),
      p.created_at))::int,
    0
  ) as dias_quieto
from proyectos p
join organizaciones o on o.id = p.organizacion_id
where p.archivado_at is null
  and (
    p.color in ('naranja', 'rojo')
    or (p.color = 'gris' and p.motivo_gris = 'no_se_dio')
  )
  and coalesce(
    (select max(a.ocurrido_at) from actualizaciones a where a.proyecto_id = p.id),
    p.created_at
  ) < now() - interval '30 days';

grant select on v_para_archivar to authenticated;

-- ------------------------------------------------------------
-- Archivar y restaurar.
--
-- Quien puede tocar el proyecto puede archivarlo: no hace falta un
-- permiso nuevo, porque archivar no destruye nada ni cambia un número.
-- Se apoya en la política de escritura que ya existe.
-- ------------------------------------------------------------

create or replace function archivar(p_proyecto uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update proyectos
     set archivado_at = now(),
         archivado_por = persona_actual()
   where id = p_proyecto
     and archivado_at is null;

  if not found then
    raise exception 'No se pudo archivar: o no existe, o ya estaba archivado, o no tenés permiso';
  end if;
end;
$$;

create or replace function desarchivar(p_proyecto uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update proyectos
     set archivado_at = null,
         archivado_por = null
   where id = p_proyecto
     and archivado_at is not null;

  if not found then
    raise exception 'No se pudo restaurar: o no existe, o no estaba archivado, o no tenés permiso';
  end if;
end;
$$;

-- Archivar de una todo lo que ya está cerrado hace rato.
create or replace function archivar_lo_cerrado()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare v_cuantos integer;
begin
  update proyectos p
     set archivado_at = now(),
         archivado_por = persona_actual()
   where p.id in (select v.id from v_para_archivar v);

  get diagnostics v_cuantos = row_count;
  return v_cuantos;
end;
$$;

grant execute on function archivar(uuid) to authenticated;
grant execute on function desarchivar(uuid) to authenticated;
grant execute on function archivar_lo_cerrado() to authenticated;

comment on function archivar is
  'Va con security invoker a propósito: quien puede editar el proyecto puede archivarlo, y quien no, no. La política de escritura que ya existe alcanza.';
