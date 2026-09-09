-- La moneda faltaba en la vista de abonos: sin ella no se pueden sumar
-- por separado, y sumar dólares con pesos en una sola cifra es peor que
-- no mostrar nada.
drop view if exists v_recurrentes;

create view v_recurrentes
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico as cliente,
  p.monto_mensual,
  p.moneda,
  p.modalidad,
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

grant select on v_recurrentes to authenticated;
