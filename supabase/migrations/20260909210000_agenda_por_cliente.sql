-- La agenda, también por cliente.
--
-- El calendario general contesta "qué hay esta semana". Sentado con un
-- cliente la pregunta es otra: "qué te debemos y qué nos debés". Es la
-- misma agenda recortada, no otra cosa: si fueran dos listas distintas,
-- el día que no coincidan nadie va a saber cuál creer.
--
-- Se recrea en vez de reemplazarse porque agrega una columna, y
-- `create or replace view` no deja cambiar la forma.

drop view if exists v_agenda;

create view v_agenda
with (security_invoker = true)
as
select
  'e' || h.id                as clave,
  'entrega'::text            as clase,
  h.fecha_comprometida       as fecha,
  h.titulo                   as titulo,
  p.nombre                   as proyecto,
  p.codigo                   as codigo,
  o.nombre_canonico          as cliente,
  o.id                       as organizacion_id,
  h.monto_neto               as monto,
  h.moneda                   as moneda,
  (h.fecha_comprometida < current_date) as vencido
from hitos h
join proyectos p      on p.id = h.proyecto_id
join organizaciones o on o.id = p.organizacion_id
where h.fecha_comprometida is not null
  and h.entregado_at is null
  and p.color in ('verde', 'amarillo')

union all

select
  'c' || h.id, 'cobro',
  coalesce(h.vence_at, h.fecha_comprometida),
  'Cobrar ' || h.titulo,
  p.nombre, p.codigo, o.nombre_canonico, o.id,
  h.monto_neto, h.moneda,
  (coalesce(h.vence_at, h.fecha_comprometida) < current_date)
from hitos h
join proyectos p      on p.id = h.proyecto_id
join organizaciones o on o.id = p.organizacion_id
where coalesce(h.vence_at, h.fecha_comprometida) is not null
  and h.cobrado_at is null
  and h.entregado_at is not null

union all

select
  'q' || c.id, 'cheque', c.fecha_cobro,
  case c.tipo when 'recibido' then 'Cobrar cheque ' else 'Se debita cheque ' end || c.numero,
  coalesce(p.nombre, '—'), p.codigo, coalesce(o.nombre_canonico, '—'), o.id,
  c.importe, c.moneda,
  (c.fecha_cobro < current_date)
from cheques c
left join proyectos p      on p.id = c.proyecto_id
left join organizaciones o on o.id = c.organizacion_id
where c.estado in ('en_cartera', 'depositado')

union all

select
  'l' || po.id, 'pago', current_date,
  'Transferir a ' || coalesce(pe.nombre, 'Crossity'),
  p.nombre, p.codigo, o.nombre_canonico, o.id,
  po.monto, h.moneda,
  false
from porciones po
join hitos h            on h.id = po.hito_id
join proyectos p        on p.id = h.proyecto_id
join organizaciones o   on o.id = p.organizacion_id
join participaciones pa on pa.id = po.participacion_id
left join personas pe   on pe.id = pa.persona_id
where po.estado = 'a_liquidar';

grant select on v_agenda to authenticated;

comment on view v_agenda is
  'Una sola agenda. La del cliente es ésta recortada, no otra lista: si fueran dos, el día que no coincidan nadie sabría cuál creer.';
