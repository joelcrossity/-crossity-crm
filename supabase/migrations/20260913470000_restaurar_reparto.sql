-- ------------------------------------------------------------------
-- v_reparto vuelve a ser lo que era.
--
-- Al agregar la cotización por porción la reescribí entera: le cambié
-- la granularidad —de una fila por participación a una por porción— y
-- le puse un join a personas. Dos errores en el mismo movimiento.
--
-- El primero rompió la sección de reparto de la ficha del proyecto, que
-- espera columnas que mi versión no tenía: concepto, porcentaje,
-- apertura, es_crossity, quien, devengado, ya_movio. No lo detectó el
-- compilador porque esa consulta viene tipada como Record<string,
-- unknown>, que acepta cualquier forma.
--
-- El segundo escondió la mitad de las porciones. Las participaciones de
-- Crossity tienen persona_id vacío —es la agencia, no una persona— así
-- que un join interno contra personas las descarta. Por eso el original
-- usaba left join y coalesce(pe.nombre, 'Crossity'): ya estaba resuelto
-- y lo pisé.
--
-- Lo mío va a v_porciones, que es lo que en realidad es: el detalle
-- entrega por entrega. Las dos cosas hacen falta y son distintas.
-- ------------------------------------------------------------------

drop view if exists v_reparto;
create view v_reparto
with (security_invoker = true)
as
select
  pa.id,
  pa.proyecto_id,
  pa.concepto,
  pa.porcentaje,
  pa.apertura,
  pa.es_crossity,
  pa.persona_id,
  coalesce(pe.nombre, 'Crossity') as quien,
  (select coalesce(sum(po.monto), 0) from porciones po where po.participacion_id = pa.id) as devengado,
  (select count(*) from porciones po
    where po.participacion_id = pa.id and po.estado in ('a_liquidar','liquidado')) as ya_movio
from participaciones pa
left join personas pe on pe.id = pa.persona_id;

grant select on v_reparto to authenticated;


-- El detalle por entrega, con su cotización. Left join a personas por la
-- misma razón: la parte de Crossity también se liquida.
drop view if exists v_porciones;
create view v_porciones
with (security_invoker = true)
as
select
  po.id            as porcion_id,
  pa.proyecto_id,
  pa.persona_id,
  coalesce(pe.nombre, 'Crossity') as quien,
  pa.es_crossity,
  pa.concepto,
  pa.porcentaje,
  po.hito_id,
  h.titulo         as entrega,
  h.orden          as etapa,
  h.entregado_at,
  h.facturado_at   as entrega_facturada,
  h.cobrado_at     as entrega_cobrada,
  h.vence_at,
  p.codigo,
  p.nombre         as proyecto,
  o.nombre_canonico as cliente,
  po.monto,
  po.moneda,
  po.estado,
  po.monto_pagado,
  po.moneda_pago,
  po.liquidacion_id,
  cotizacion_de_porcion(po.id)                      as cotizacion,
  round(po.monto * cotizacion_de_porcion(po.id), 2) as en_pesos,
  (po.cotizacion_pago is not null)                  as cotizacion_fija
from porciones po
join participaciones pa  on pa.id = po.participacion_id
left join personas pe    on pe.id = pa.persona_id
join hitos h             on h.id = po.hito_id
join proyectos p         on p.id = h.proyecto_id
join organizaciones o    on o.id = p.organizacion_id;

grant select on v_porciones to authenticated;


-- Y el historial de pagos: mismo arreglo.
drop view if exists v_pagos_hechos;
create view v_pagos_hechos
with (security_invoker = true)
as
select
  l.id as liquidacion_id, l.fecha, l.periodo, l.notas,
  pa.persona_id,
  coalesce(pe.nombre, 'Crossity') as persona,
  pa.es_crossity,
  p.codigo, p.nombre as proyecto, h.titulo as entrega,
  po.id as porcion_id, po.monto, po.moneda,
  po.monto_pagado, po.moneda_pago, po.cotizacion_pago,
  c.nombre as caja, po.factura_numero, po.factura_at
from porciones po
join liquidaciones l     on l.id = po.liquidacion_id
join participaciones pa  on pa.id = po.participacion_id
left join personas pe    on pe.id = pa.persona_id
join hitos h             on h.id = po.hito_id
join proyectos p         on p.id = h.proyecto_id
left join cajas c        on c.id = po.caja_id;

grant select on v_pagos_hechos to authenticated;
