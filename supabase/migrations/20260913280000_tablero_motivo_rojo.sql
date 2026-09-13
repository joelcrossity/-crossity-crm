-- v_tablero suma motivo_rojo. El tablero ya parte el verde por fase y
-- el gris por motivo; si mañana alguien parte el rojo —perdido contra
-- descartado, que son cosas muy distintas para mirar el año— el dato
-- tiene que estar ahí. Va al final: create or replace view deja agregar
-- columnas pero no meterlas en el medio.
create or replace view v_tablero
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
      p.created_at))::int as dias_sin_novedades,
  p.motivo_rojo
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas r  on r.id = p.responsable_id
where p.tipo = 'proyecto'
  and (p.etapa is null or p.etapa = 'ganado')
  and p.archivado_at is null;

grant select on v_tablero to authenticated;
