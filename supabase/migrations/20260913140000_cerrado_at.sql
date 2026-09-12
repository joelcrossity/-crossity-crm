-- ------------------------------------------------------------------
-- Cuándo se cerró.
--
-- No había fecha de cierre en ningún lado. proyectos tiene created_at,
-- fecha_comprometida, fecha_inicio y archivado_at, y ninguna dice
-- cuándo el trabajo dejó de estar abierto: archivado_at es cuándo salió
-- del escritorio, que pasa después y a veces nunca.
--
-- El dato existía igual, en eventos: cada cambio de color quedó
-- registrado con su fecha. Así que la fecha de cierre se deriva en vez
-- de agregar una columna que habría que acordarse de escribir en cada
-- camino que cierra un proyecto.
--
-- Se toma el paso al color que el proyecto tiene HOY, no a cualquier
-- color de cierre: uno que se dio por perdido, se reabrió y se terminó
-- bien tiene que decir cuándo se terminó, no cuándo se había perdido.
--
-- Queda null para los que se cerraron antes de que esto se registrara.
-- Null y no created_at: poner la fecha de alta bajo el rótulo
-- "Terminado el" es escribir algo falso, y una fecha falsa es peor que
-- ninguna porque nadie la sale a verificar.
-- ------------------------------------------------------------------

create index if not exists eventos_color_idx
  on eventos (proyecto_id, created_at desc)
  where campo = 'color';

create or replace function cerrado_at(p_proyecto uuid, p_color text)
returns timestamptz
language sql
stable
security invoker
as $$
  select case when p_color in ('naranja', 'rojo') then (
    select max(e.created_at)
    from eventos e
    where e.proyecto_id = p_proyecto
      and e.campo = 'color'
      and e.valor_nuevo = p_color
  ) end;
$$;

comment on function cerrado_at is
  'Cuándo el proyecto pasó al estado de cierre en el que está hoy. Null si sigue abierto o si el cambio es anterior al registro de eventos.';

grant execute on function cerrado_at(uuid, text) to authenticated;

-- Las dos vistas que alimentan las listas de terminados.

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
  cerrado_at(p.id, p.color::text) as cerrado_at,
  extract(day from now() - coalesce(
      (select max(a.ocurrido_at) from actualizaciones a where a.proyecto_id = p.id),
      p.created_at))::int as dias_sin_novedades
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas r  on r.id = p.responsable_id
where p.tipo = 'proyecto'
  and (p.etapa is null or p.etapa = 'ganado')
  and p.archivado_at is null;

grant select on v_tablero to authenticated;

drop view if exists v_archivados;
create view v_archivados
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
  cerrado_at(p.id, p.color::text) as cerrado_at,
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
