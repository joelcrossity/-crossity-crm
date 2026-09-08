-- ============================================================
-- Proyectos son los que ya son proyectos.
--
-- v_tablero no filtraba nada, así que todo lo que estaba en el embudo
-- aparecía DOS veces: en Pipeline, donde va, y también en Proyectos
-- —las amarillas en "A seguir" y las enfriadas en "Standby"—.
--
-- La línea es la etapa. Si tiene etapa y no está ganada, todavía se
-- está conversando: es pipeline. Cuando se gana, la etapa queda en
-- 'ganado' y recién ahí es un proyecto.
--
-- Y los mantenimientos salen también, porque ahora tienen su propia
-- pantalla. A un abono no se le pregunta lo mismo que a un proyecto:
-- no tiene entrega ni avance, tiene vigencia.
-- ============================================================

drop view if exists v_tablero;

create view v_tablero
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico            as cliente,
  o.codigo                     as cliente_codigo,
  p.color,
  p.subestado,
  p.motivo_gris,
  p.prioridad,
  p.fecha_comprometida,
  p.es_producto_propio,
  p.condicion,
  p.tipo,
  r.nombre                     as responsable,
  (current_date - p.fecha_comprometida)                       as dias_de_atraso,
  extract(day from now() - coalesce(
      (select max(a.ocurrido_at) from actualizaciones a where a.proyecto_id = p.id),
      p.created_at))::int                                     as dias_sin_novedades
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas r  on r.id = p.responsable_id
where p.tipo = 'proyecto'
  and (p.etapa is null or p.etapa = 'ganado');

grant select on v_tablero to authenticated;

comment on view v_tablero is
  'Solo lo que ya es proyecto. Lo que sigue en el embudo vive en Pipeline y no debe aparecer en los dos lados: aparecer dos veces es la forma más rápida de que dos números de la misma cosa no coincidan.';
