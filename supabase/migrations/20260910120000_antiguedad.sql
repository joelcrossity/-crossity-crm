-- ============================================================
-- Antigüedad de deuda.
--
-- Tomado de SUINO, que tiene el botón "Antigüedad de deuda" al lado de
-- la cuenta corriente. Es la diferencia entre saber cuánto te deben y
-- saber qué tan mal está.
--
-- Un saldo de un millón repartido en facturas de esta semana es una
-- empresa sana. El mismo millón con noventa días encima es un problema.
-- El total solo no distingue las dos cosas, y por eso mirarlo tranquiliza
-- de más.
-- ============================================================

create or replace view v_antiguedad
with (security_invoker = true)
as
select
  o.id              as organizacion_id,
  o.codigo          as cliente_codigo,
  o.nombre_canonico as cliente,
  h.moneda,
  coalesce(sum(h.monto_neto) filter (where dias <= 30), 0)               as al_dia,
  coalesce(sum(h.monto_neto) filter (where dias between 31 and 60), 0)   as d31_60,
  coalesce(sum(h.monto_neto) filter (where dias between 61 and 90), 0)   as d61_90,
  coalesce(sum(h.monto_neto) filter (where dias > 90), 0)                as mas_de_90,
  coalesce(sum(h.monto_neto), 0)                                         as total
from organizaciones o
join proyectos p on p.organizacion_id = o.id
join lateral (
  select h.monto_neto, h.moneda, (current_date - h.facturado_at::date) as dias
    from hitos h
   where h.proyecto_id = p.id
     and h.facturado_at is not null
     and h.cobrado_at is null
) h on true
group by o.id, o.codigo, o.nombre_canonico, h.moneda
having coalesce(sum(h.monto_neto), 0) > 0;

grant select on v_antiguedad to authenticated;

comment on view v_antiguedad is
  'Un millón en facturas de esta semana es una empresa sana; el mismo millón con noventa días encima es un problema. El total solo no distingue las dos cosas.';
