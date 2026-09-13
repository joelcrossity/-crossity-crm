-- v_archivados suma lo propio de un abono: cuánto valía por mes y entre
-- qué fechas estuvo vigente. Sin eso, un mantenimiento archivado se ve
-- en el historial como un proyecto cualquiera y no se puede contestar
-- la única pregunta que uno le hace: cuánto dejaba de facturar por mes
-- y hasta cuándo estuvo.
create or replace view v_archivados
with (security_invoker = true)
as
select
  p.id, p.codigo, p.nombre,
  o.nombre_canonico as cliente,
  o.codigo          as cliente_codigo,
  p.tipo, p.etapa, p.color,
  p.motivo_gris, p.motivo_rojo, p.subestado,
  p.monto_neto, p.moneda, p.fecha_comprometida,
  p.archivado_at,
  cerrado_at(p.id, p.color::text) as cerrado_at,
  quien.nombre      as archivado_por,
  resp.nombre       as responsable,
  s.nombre          as servicio,
  (p.etapa is not null and p.etapa <> 'ganado') as era_oportunidad,
  coalesce((select sum(h.monto_neto) from hitos h
             where h.proyecto_id = p.id and h.cobrado_at is not null), 0) as cobrado,
  -- Lo del abono.
  (p.tipo = 'mantenimiento') as era_abono,
  p.monto_mensual,
  p.vigencia_desde,
  p.vigencia_hasta,
  p.plan
from proyectos p
join organizaciones o   on o.id = p.organizacion_id
left join personas quien on quien.id = p.archivado_por
left join personas resp  on resp.id = p.responsable_id
left join servicios s    on s.id = p.servicio_id
where p.archivado_at is not null;

grant select on v_archivados to authenticated;
