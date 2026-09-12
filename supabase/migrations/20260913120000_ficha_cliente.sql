-- ============================================================
-- Lo que le faltaba a la ficha del cliente.
--
-- El avance de un proyecto se mide por plata entregada, no por cantidad
-- de entregas: una que vale la mitad del proyecto no pesa lo mismo que
-- una que vale el trece por ciento. Ese cálculo estaba repetido en tres
-- pantallas; acá queda en un solo lugar.
--
-- Y las interacciones: lo que se habló con un cliente está repartido
-- entre las novedades de todos sus proyectos. Nadie lo ve junto, que es
-- justo como se necesita antes de una reunión.
-- ============================================================

create or replace view v_avance
with (security_invoker = true)
as
select
  p.id           as proyecto_id,
  p.organizacion_id,
  coalesce(sum(h.monto_neto), 0)                                           as total,
  coalesce(sum(h.monto_neto) filter (where h.entregado_at is not null), 0) as entregado,
  coalesce(sum(h.monto_neto) filter (where h.facturado_at is not null), 0) as facturado,
  coalesce(sum(h.monto_neto) filter (where h.cobrado_at is not null), 0)   as cobrado,
  case
    when coalesce(sum(h.monto_neto), 0) = 0 then 0
    else round(
      100 * sum(h.monto_neto) filter (where h.entregado_at is not null)
      / sum(h.monto_neto)
    )
  end                                                                      as pct_entregado,
  case
    when coalesce(sum(h.monto_neto), 0) = 0 then 0
    else round(
      100 * sum(h.monto_neto) filter (where h.cobrado_at is not null)
      / sum(h.monto_neto)
    )
  end                                                                      as pct_cobrado,
  count(h.id)                                                              as entregas,
  count(h.id) filter (where h.entregado_at is not null)                    as entregas_hechas
from proyectos p
left join hitos h on h.proyecto_id = p.id
group by p.id, p.organizacion_id;

grant select on v_avance to authenticated;

comment on view v_avance is
  'El avance se mide por plata entregada, no por cantidad de entregas: una que vale la mitad del proyecto no pesa lo mismo que una que vale el trece por ciento.';

-- ------------------------------------------------------------
-- Todo lo que se habló con un cliente, junto.
--
-- Hereda la RLS de actualizaciones, que ya filtra por tipo: lo
-- comercial lo ven dirección, PM y vendedores, y nadie más.
-- ------------------------------------------------------------

create or replace view v_interacciones
with (security_invoker = true)
as
select
  a.id,
  p.organizacion_id,
  a.ocurrido_at,
  a.tipo,
  a.canal,
  a.texto,
  pe.nombre  as quien,
  p.codigo   as proyecto_codigo,
  p.nombre   as proyecto,
  (p.etapa is not null and p.etapa <> 'ganado') as era_oportunidad
from actualizaciones a
join proyectos p      on p.id = a.proyecto_id
left join personas pe on pe.id = a.autor_id;

grant select on v_interacciones to authenticated;

comment on view v_interacciones is
  'Lo hablado con un cliente está repartido entre las novedades de todos sus proyectos. Nadie lo ve junto, que es justo como se necesita antes de una reunión.';
