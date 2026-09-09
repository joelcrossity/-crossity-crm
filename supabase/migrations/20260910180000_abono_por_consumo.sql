-- ============================================================
-- Abonos por consumo.
--
-- Hasta ahora un abono era un número fijo por mes. Pero hay servicios
-- que se liquidan a mes vencido según lo que se usó: el agente
-- conversacional cobra por conversación, un hosting por tráfico. Ahí el
-- monto no se sabe hasta que el mes terminó.
--
-- Forzar esos a un monto fijo tiene una consecuencia concreta: el
-- cashflow proyecta un número que no es, y la factura sale mal o sale
-- tarde porque alguien tiene que ir a buscar el consumo a otro lado.
--
-- Tres modalidades, porque las tres existen:
--   fijo             tanto por mes, pase lo que pase
--   consumo          todo variable, a mes vencido
--   fijo_mas_consumo un piso mensual y lo que se pase encima
-- ============================================================

create type modalidad_abono as enum ('fijo', 'consumo', 'fijo_mas_consumo');

alter table proyectos
  add column modalidad        modalidad_abono not null default 'fijo',
  add column unidad_consumo   text,
  add column precio_unitario  numeric(14,4),
  add column incluido_en_base numeric(14,2);

comment on column proyectos.unidad_consumo is
  'Qué se cuenta: conversaciones, mensajes, horas, GB. Sin la unidad, un número suelto no se puede discutir con el cliente.';

comment on column proyectos.incluido_en_base is
  'Cuánto entra en el piso mensual antes de empezar a cobrar por unidad. Solo en fijo_mas_consumo.';

-- La modalidad solo tiene sentido en un mantenimiento.
alter table proyectos
  add constraint modalidad_solo_en_abono check (
    modalidad = 'fijo' or tipo = 'mantenimiento'
  );

-- ------------------------------------------------------------
-- Lo que se consumió cada mes.
-- ------------------------------------------------------------

create table consumos (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos(id) on delete cascade,
  periodo      date not null,                  -- siempre el día 1 del mes
  cantidad     numeric(14,4) not null,
  precio_unitario numeric(14,4),               -- congelado: el precio pudo cambiar después
  monto        numeric(14,2) not null,
  notas        text,
  facturado_at date,
  cobrado_at   date,
  cargado_por  uuid references personas(id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint cantidad_no_negativa check (cantidad >= 0),
  constraint periodo_es_dia_uno check (extract(day from periodo) = 1)
);

create unique index consumos_un_mes on consumos (proyecto_id, periodo);
create index consumos_sin_cobrar on consumos (proyecto_id) where cobrado_at is null;

comment on table consumos is
  'Un renglón por mes cerrado. El precio queda congelado en el renglón: si mañana sube, lo ya liquidado no cambia.';

comment on column consumos.periodo is
  'Siempre el día 1: el mes es el período, no una fecha suelta, y así dos cargas del mismo mes chocan en vez de duplicarse.';

alter table consumos enable row level security;

create policy consumos_lectura on consumos for select to authenticated
  using (ve_todo() or participa_en(proyecto_id));
create policy consumos_alta on consumos for insert to authenticated with check (ve_todo());
create policy consumos_cambio on consumos for update to authenticated
  using (ve_todo()) with check (ve_todo());
create policy consumos_baja on consumos for delete to authenticated using (ve_todo());

grant select, insert, update, delete on consumos to authenticated;

-- ------------------------------------------------------------
-- Cargar un mes. El monto se calcula, no se escribe: escribirlo a mano
-- es garantizar que algún día no coincida con cantidad por precio.
-- ------------------------------------------------------------

create or replace function anotar_consumo(
  p_proyecto uuid,
  p_periodo  date,
  p_cantidad numeric,
  p_notas    text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p       proyectos%rowtype;
  v_precio  numeric;
  v_extra   numeric;
  v_monto   numeric;
  v_persona uuid;
begin
  select * into v_p from proyectos where id = p_proyecto;

  if v_p.tipo is distinct from 'mantenimiento' then
    raise exception 'El consumo solo se carga en un abono';
  end if;

  v_precio := coalesce(v_p.precio_unitario, 0);

  if v_p.modalidad = 'fijo_mas_consumo' then
    -- Solo se cobra lo que pasa del incluido en el piso.
    v_extra := greatest(p_cantidad - coalesce(v_p.incluido_en_base, 0), 0);
    v_monto := coalesce(v_p.monto_mensual, 0) + round(v_extra * v_precio, 2);
  elsif v_p.modalidad = 'consumo' then
    v_monto := round(p_cantidad * v_precio, 2);
  else
    v_monto := coalesce(v_p.monto_mensual, 0);
  end if;

  select persona_id into v_persona from usuarios where id = auth.uid();

  insert into consumos (proyecto_id, periodo, cantidad, precio_unitario, monto, notas, cargado_por)
  values (p_proyecto, date_trunc('month', p_periodo)::date, p_cantidad, v_precio, v_monto, p_notas, v_persona)
  on conflict (proyecto_id, periodo) do update
    set cantidad = excluded.cantidad,
        precio_unitario = excluded.precio_unitario,
        monto = excluded.monto,
        notas = coalesce(excluded.notas, consumos.notas);

  return v_monto;
end;
$$;

grant execute on function anotar_consumo(uuid, date, numeric, text) to authenticated;

-- ------------------------------------------------------------
-- Lo recurrente, ahora contando los variables por su promedio real.
--
-- Un abono por consumo no aporta cero al mes: aporta lo que viene
-- aportando. Contarlo como cero haría que el piso de la empresa parezca
-- más bajo de lo que es y que las decisiones se tomen sobre un número
-- pesimista.
-- ------------------------------------------------------------

create or replace view v_recurrente
with (security_invoker = true)
as
select
  'entra'::text     as lado,
  p.nombre          as concepto,
  o.nombre_canonico as quien,
  case p.modalidad
    when 'fijo' then p.monto_mensual
    else coalesce(
      (select avg(c.monto) from consumos c
        where c.proyecto_id = p.id
          and c.periodo >= (current_date - interval '3 months')),
      p.monto_mensual, 0)
  end               as mensual,
  p.moneda,
  p.codigo
from proyectos p
join organizaciones o on o.id = p.organizacion_id
where p.tipo = 'mantenimiento'
  and p.color = 'verde'

union all

select
  'sale',
  c.concepto,
  coalesce(c.proveedor, '—'),
  round(c.monto * veces_por_ano(c.cada) / 12, 2),
  c.moneda,
  null
from costos_fijos c
where c.desde <= current_date
  and (c.hasta is null or c.hasta >= current_date);

grant select on v_recurrente to authenticated;

comment on view v_recurrente is
  'Los abonos por consumo cuentan por su promedio de los últimos tres meses: contarlos como cero haría parecer el piso de la empresa más bajo de lo que es.';

-- Los meses cargados y todavía sin cobrar entran en la agenda.
create or replace view v_consumos
with (security_invoker = true)
as
select
  c.id,
  c.proyecto_id,
  c.periodo,
  c.cantidad,
  c.precio_unitario,
  c.monto,
  c.notas,
  c.facturado_at,
  c.cobrado_at,
  p.codigo   as proyecto_codigo,
  p.nombre   as proyecto,
  p.moneda,
  p.unidad_consumo,
  o.nombre_canonico as cliente
from consumos c
join proyectos p      on p.id = c.proyecto_id
join organizaciones o on o.id = p.organizacion_id;

grant select on v_consumos to authenticated;
