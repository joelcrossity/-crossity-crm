-- v_tablero suma lo que el panel de edición necesita. Va en la vista y
-- no en una consulta aparte al abrir el panel: son cinco campos de la
-- misma fila que ya se está trayendo, y un viaje extra por cada lápiz
-- que se toca se siente.
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
  p.motivo_rojo,
  p.organizacion_id, p.responsable_id, p.fecha_inicio, p.monto_neto, p.descripcion,
  -- Si esta persona puede editarlo, para no ofrecer un lápiz que no
  -- abre nada. La base ya lo frena; esto es para no mentir en pantalla.
  (ve_todo() or participa_en(p.id)) as puedo_editar
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas r  on r.id = p.responsable_id
where p.tipo = 'proyecto'
  and (p.etapa is null or p.etapa = 'ganado')
  and p.archivado_at is null;

grant select on v_tablero to authenticated;
