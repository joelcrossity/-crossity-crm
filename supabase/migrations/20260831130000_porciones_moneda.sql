-- ============================================================
-- La plata de cada uno, con su moneda.
--
-- Si el proyecto es en dólares, la parte de cada uno es en dólares.
-- Recién al pagar se decide en qué moneda sale y a qué cambio.
-- ============================================================

alter table porciones
  add column moneda char(3) not null default 'ARS' references monedas(codigo);

-- Lo que efectivamente se pagó, que puede ser en otra moneda.
alter table porciones
  add column moneda_pago     char(3) references monedas(codigo),
  add column cotizacion_pago numeric(14,4),
  add column monto_pagado    numeric(14,2);

comment on column porciones.monto_pagado is
  'Se llena al liquidar. Deja ver la diferencia entre lo que se debía y lo que salió.';

alter table porciones
  add constraint pago_completo check (
    estado <> 'liquidado'
    or (moneda_pago is not null and monto_pagado is not null)
  );

-- La porción hereda la moneda de su hito.
create or replace function porcion_hereda_moneda()
returns trigger
language plpgsql
as $$
begin
  select moneda into NEW.moneda from hitos where id = NEW.hito_id;
  return NEW;
end;
$$;

create trigger porciones_heredan_moneda
  before insert on porciones
  for each row execute function porcion_hereda_moneda();

-- ------------------------------------------------------------
-- Las vistas de posición pasan a estar abiertas por moneda.
-- Un total único mezclando pesos y dólares sería un número que
-- no significa nada, y peor: uno en el que alguien confiaría.
-- ------------------------------------------------------------

drop view if exists v_mi_posicion;
create view v_mi_posicion
with (security_invoker = true)
as
select
  pa.persona_id,
  po.moneda,
  sum(po.monto) filter (where po.estado = 'comprometido') as comprometido,
  sum(po.monto) filter (where po.estado = 'devengado')    as devengado,
  sum(po.monto) filter (where po.estado = 'a_liquidar')   as a_liquidar,
  sum(po.monto) filter (where po.estado = 'liquidado')    as liquidado,
  count(distinct pa.proyecto_id)                          as proyectos
from porciones po
join participaciones pa on pa.id = po.participacion_id
group by pa.persona_id, po.moneda;

drop view if exists v_posicion_general;
create view v_posicion_general
with (security_invoker = true)
as
select
  coalesce(pe.nombre, 'Crossity · gestión') as participante,
  pa.persona_id,
  pa.es_crossity,
  po.moneda,
  sum(po.monto) filter (where po.estado = 'devengado')  as devengado,
  sum(po.monto) filter (where po.estado = 'a_liquidar') as a_liquidar,
  sum(po.monto) filter (where po.estado = 'liquidado')  as liquidado,
  count(distinct pa.proyecto_id)                        as proyectos
from porciones po
join participaciones pa on pa.id = po.participacion_id
left join personas pe   on pe.id = pa.persona_id
group by pe.nombre, pa.persona_id, pa.es_crossity, po.moneda;

-- Cuando hace falta un solo número —el total de la empresa— se convierte
-- explícitamente y a una fecha, nunca por descuido.
create or replace view v_posicion_en_pesos
with (security_invoker = true)
as
select
  participante,
  persona_id,
  es_crossity,
  sum(devengado  * coalesce(cotizacion_a(moneda), 0)) as devengado_ars,
  sum(a_liquidar * coalesce(cotizacion_a(moneda), 0)) as a_liquidar_ars,
  sum(liquidado  * coalesce(cotizacion_a(moneda), 0)) as liquidado_ars,
  bool_or(cotizacion_a(moneda) is null)               as falta_cotizacion
from v_posicion_general
group by participante, persona_id, es_crossity;

comment on view v_posicion_en_pesos is
  'falta_cotizacion avisa que el número está incompleto en vez de mentir con un cero.';

-- El recurrente también se lee por moneda.
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

grant select on v_mi_posicion, v_posicion_general, v_posicion_en_pesos, v_recurrentes
  to authenticated;
