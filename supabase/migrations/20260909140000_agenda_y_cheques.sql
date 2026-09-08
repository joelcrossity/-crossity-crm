-- ============================================================
-- La agenda, y los cheques.
--
-- SUINO tiene tres pantallas separadas: cronograma de pagos, cheques y
-- vencimientos. Con su volumen está bien. Acá conviene al revés: una
-- sola agenda con todo lo que tiene fecha, porque el problema no es
-- tener muchos vencimientos sino tenerlos repartidos en la cabeza de
-- una persona.
--
-- Cuatro cosas tienen fecha y hoy no están juntas en ningún lado:
--   qué hay que entregar, qué nos tienen que pagar, qué cheque se cobra
--   y a quién hay que transferirle.
-- ============================================================

-- ------------------------------------------------------------
-- Cuándo tiene que pagar el cliente.
--
-- Entregar y cobrar son dos fechas distintas: se entrega el 15 y se
-- paga a treinta días. Sin esta columna la única fecha era la de
-- entrega, y por eso la cobranza no se podía anticipar.
-- ------------------------------------------------------------

alter table hitos add column vence_at date;

comment on column hitos.vence_at is
  'Cuándo tiene que estar pagada. Distinta de la fecha de entrega: se entrega el 15 y se cobra a treinta días.';

-- ------------------------------------------------------------
-- Cheques.
--
-- Un cheque a noventa días es plata que existe y todavía no está. Sin
-- registrarlo, o se cuenta como cobrado —y no lo está— o se olvida.
-- ------------------------------------------------------------

create type tipo_cheque  as enum ('recibido', 'emitido');
create type estado_cheque as enum ('en_cartera', 'depositado', 'entregado', 'acreditado', 'rechazado');

create table cheques (
  id              uuid primary key default gen_random_uuid(),
  tipo            tipo_cheque not null default 'recibido',
  numero          text not null,
  banco           text,
  importe         numeric(14,2) not null,
  moneda          char(3) not null default 'ARS' references monedas(codigo),
  fecha_cobro     date not null,
  estado          estado_cheque not null default 'en_cartera',
  es_echeq        boolean not null default false,

  -- De quién vino, o a quién se entregó.
  organizacion_id uuid references organizaciones(id) on delete set null,
  proyecto_id     uuid references proyectos(id) on delete set null,
  persona_id      uuid references personas(id) on delete set null,

  notas           text,
  registrado_por  uuid references personas(id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint importe_positivo check (importe > 0)
);

create index cheques_por_fecha on cheques (fecha_cobro)
  where estado in ('en_cartera', 'depositado');

comment on table cheques is
  'Plata que existe y todavía no está. Un cheque a noventa días no es un cobro: es una fecha.';

alter table cheques enable row level security;

create policy cheques_lectura on cheques for select to authenticated
  using (es_direccion() or es_admin());
create policy cheques_alta on cheques for insert to authenticated
  with check (es_direccion() or es_admin());
create policy cheques_cambio on cheques for update to authenticated
  using (es_direccion() or es_admin()) with check (es_direccion() or es_admin());
create policy cheques_baja on cheques for delete to authenticated
  using (es_direccion() or es_admin());

grant select, insert, update, delete on cheques to authenticated;

-- ------------------------------------------------------------
-- La agenda: todo lo que tiene fecha, en una sola lista.
--
-- Hereda la RLS de cada tabla. Las porciones ya filtran por persona,
-- así que cada uno ve en la agenda sus propios cobros y los de nadie
-- más, sin que la vista tenga que saber nada de eso.
-- ------------------------------------------------------------

create or replace view v_agenda
with (security_invoker = true)
as
-- Lo que hay que entregar
select
  'e' || h.id                as clave,
  'entrega'::text            as clase,
  h.fecha_comprometida       as fecha,
  h.titulo                   as titulo,
  p.nombre                   as proyecto,
  p.codigo                   as codigo,
  o.nombre_canonico          as cliente,
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

-- Lo que nos tienen que pagar
select
  'c' || h.id, 'cobro',
  coalesce(h.vence_at, h.fecha_comprometida),
  'Cobrar ' || h.titulo,
  p.nombre, p.codigo, o.nombre_canonico,
  h.monto_neto, h.moneda,
  (coalesce(h.vence_at, h.fecha_comprometida) < current_date)
from hitos h
join proyectos p      on p.id = h.proyecto_id
join organizaciones o on o.id = p.organizacion_id
where coalesce(h.vence_at, h.fecha_comprometida) is not null
  and h.cobrado_at is null
  and h.entregado_at is not null

union all

-- Cheques que se cobran
select
  'q' || c.id, 'cheque', c.fecha_cobro,
  case c.tipo when 'recibido' then 'Cobrar cheque ' else 'Se debita cheque ' end || c.numero,
  coalesce(p.nombre, '—'), p.codigo, coalesce(o.nombre_canonico, '—'),
  c.importe, c.moneda,
  (c.fecha_cobro < current_date)
from cheques c
left join proyectos p      on p.id = c.proyecto_id
left join organizaciones o on o.id = c.organizacion_id
where c.estado in ('en_cartera', 'depositado')

union all

-- Lo que hay que transferirle a cada uno: la plata ya entró
select
  'l' || po.id, 'pago', current_date,
  'Transferir a ' || coalesce(pe.nombre, 'Crossity'),
  p.nombre, p.codigo, o.nombre_canonico,
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
  'Entregas, cobros, cheques y transferencias en una sola lista. El problema nunca fue tener vencimientos: fue tenerlos repartidos en la cabeza de una persona.';
