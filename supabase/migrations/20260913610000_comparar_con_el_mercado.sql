-- ------------------------------------------------------------------
-- "A cuánto está hoy" se compara contra el mercado, no contra "pactado".
--
-- Una etapa cotizada a un dólar pactado guardaba casa = 'pactado', y la
-- vista pedía la cotización de hoy para esa casa. No existe: pactado no
-- es un mercado, es un acuerdo. Así que el campo salía vacío justo en
-- el caso donde más importa —el de la etapa cotizada hace meses a un
-- número fijo— y el aviso de la corrida no aparecía nunca.
--
-- Contra qué comparar: si la etapa fijó un número, contra el dólar que
-- usa el proyecto; y si el proyecto también pactó, contra el blue, que
-- es el que la gente mira para saber cuánto se movió.
-- ------------------------------------------------------------------

drop view if exists v_precotizado;
create view v_precotizado
with (security_invoker = true)
as
select
  h.id as hito_id, h.proyecto_id, p.codigo,
  p.nombre as trabajo, p.organizacion_id,
  o.nombre_canonico as cliente,
  p.etapa, p.color, h.orden,
  h.titulo as etapa_nombre, h.entregable,
  h.monto_neto, h.moneda, h.vence_at,
  coalesce(h.casa_cotizacion, p.casa_cotizacion) as casa,
  cotizacion_del_hito(h.id) as cotizacion_acordada,
  -- Contra el mercado: la primera casa real de la cadena.
  cotizacion_de('USD',
    case
      when coalesce(h.casa_cotizacion, '') not in ('', 'pactado') then h.casa_cotizacion
      when p.casa_cotizacion <> 'pactado' then p.casa_cotizacion
      else 'blue'
    end) as cotizacion_hoy,
  case when h.moneda = 'ARS' then h.monto_neto
       else round(h.monto_neto * cotizacion_del_hito(h.id), 2) end as en_pesos,
  (p.etapa = 'ganado' or p.etapa is null) as ya_es_proyecto
from hitos h
join proyectos p      on p.id = h.proyecto_id
join organizaciones o on o.id = p.organizacion_id
where h.activo = false and p.archivado_at is null;

grant select on v_precotizado to authenticated;
