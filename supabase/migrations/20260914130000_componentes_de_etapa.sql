-- ------------------------------------------------------------------
-- Los componentes de una etapa, separados de sus cuotas.
--
-- La propuesta de AMCAP lo muestra claro y yo lo tenía mezclado:
--
--   Etapa 1 (MVP)   monto cerrado
--      Anticipo 50% a la firma          ← esto es una CUOTA
--      Saldo    50% contra entrega      ← esto es una CUOTA
--   Etapa 2
--      Agente operativo en grupo  1.537 ← esto es un COMPONENTE
--      Corrida diaria             1.342 ← esto es un COMPONENTE
--      Reglas de cobro por file  bonif. ← esto es un COMPONENTE
--
-- Son dos cosas distintas. El componente dice qué recibe el cliente y
-- cuánto cuesta: es el alcance, y su suma da el total de la etapa. La
-- cuota dice cuándo paga ese total. La Etapa 1 ya tiene sus cuotas
-- acordadas y la Etapa 2 todavía no: tiene precio y no tiene forma de
-- pago, porque no se vendió.
--
-- Tenerlas juntas obligaba a inventar una cuota por cada componente, y
-- entonces vender dos de los tres componentes de una etapa no se podía
-- expresar sin rehacer todo.
--
-- Y hay una tercera clase de línea que la propuesta también usa: lo
-- "abierto a especificación". Alcance que el cliente ya vio y que
-- todavía no se puede cotizar porque falta relevarlo. No tiene monto y
-- no suma, pero existe: es la venta que sigue, y hoy se perdía en el
-- PDF.
-- ------------------------------------------------------------------

create table if not exists componentes (
  id          uuid primary key default gen_random_uuid(),
  etapa_id    uuid not null references etapas_cotizacion(id) on delete cascade,
  orden       integer not null,
  nombre      text not null,
  detalle     text,
  estado      text not null default 'cotizado',
  monto       numeric(14,2),
  moneda      char(3) not null default 'USD',
  created_at  timestamptz not null default now(),
  unique (etapa_id, orden)
);

alter table componentes drop constraint if exists componente_coherente;
alter table componentes add constraint componente_coherente check (
  (estado = 'cotizado'    and monto is not null and monto > 0) or
  -- Bonificado es un precio decidido, no un precio ausente: se muestra
  -- para que se vea qué se está regalando.
  (estado = 'bonificado'  and monto is not null and monto >= 0) or
  (estado = 'sin_cotizar' and monto is null)
);

comment on table componentes is
  'Qué incluye una etapa y cuánto cuesta cada parte. Su suma da el total. Las cuotas (hitos) dicen cuándo se paga ese total: son otra cosa.';
comment on column componentes.estado is
  'cotizado: tiene precio. bonificado: se regala y se muestra para que se vea. sin_cotizar: alcance presentado que necesita relevamiento antes de poder ponerle número.';

create index if not exists componentes_por_etapa on componentes (etapa_id);

alter table componentes enable row level security;

drop policy if exists componentes_lectura on componentes;
create policy componentes_lectura on componentes for select to authenticated
  using (exists (select 1 from etapas_cotizacion e
                  where e.id = etapa_id and (ve_todo() or participa_en(e.proyecto_id))));

drop policy if exists componentes_escritura on componentes;
create policy componentes_escritura on componentes for all to authenticated
  using (exists (select 1 from etapas_cotizacion e
                  where e.id = etapa_id and (ve_todo() or participa_en(e.proyecto_id))))
  with check (exists (select 1 from etapas_cotizacion e
                  where e.id = etapa_id and (ve_todo() or participa_en(e.proyecto_id))));

grant select, insert, update, delete on componentes to authenticated;


-- ------------------------------------------------------------------
-- La etapa, con sus dos caras.
--
-- El total sale de los componentes. Lo cotizado y lo bonificado se
-- cuentan aparte: saber que se regalaron 600 dólares es un dato, y
-- sumarlos al total sería facturar lo que se regaló.
-- ------------------------------------------------------------------

drop view if exists v_cotizacion;
create view v_cotizacion
with (security_invoker = true)
as
select
  e.id as etapa_id, e.proyecto_id, p.codigo,
  o.nombre_canonico as cliente,
  e.orden, e.nombre, e.alcance,

  (select count(*) from componentes c where c.etapa_id = e.id)                          as componentes,
  (select coalesce(sum(c.monto), 0) from componentes c
    where c.etapa_id = e.id and c.estado = 'cotizado')                                  as total,
  (select coalesce(sum(c.monto), 0) from componentes c
    where c.etapa_id = e.id and c.estado = 'bonificado')                                as bonificado,
  (select count(*) from componentes c where c.etapa_id = e.id and c.estado = 'sin_cotizar') as sin_cotizar,
  (select min(c.moneda) from componentes c where c.etapa_id = e.id)                     as moneda,

  (select count(*) from hitos h where h.etapa_id = e.id)                                as cuotas,
  (select coalesce(sum(h.monto_neto), 0) from hitos h where h.etapa_id = e.id)          as repartido,
  (select bool_and(h.activo) from hitos h where h.etapa_id = e.id)                      as arrancada,
  (select bool_or(h.activo) from hitos h where h.etapa_id = e.id)                       as arrancada_en_parte
from etapas_cotizacion e
join proyectos p      on p.id = e.proyecto_id
join organizaciones o on o.id = p.organizacion_id;

grant select on v_cotizacion to authenticated;


-- ------------------------------------------------------------------
-- Lo que se presentó y todavía no se puede cotizar.
--
-- Por cliente, para que aparezca en su ficha junto a lo ya cotizado. Es
-- alcance que el cliente vio: alguien tiene que volver a levantarlo, y
-- si no está en ningún lado nadie lo hace.
-- ------------------------------------------------------------------

drop view if exists v_sin_cotizar;
create view v_sin_cotizar
with (security_invoker = true)
as
select
  c.id as componente_id,
  e.proyecto_id, e.id as etapa_id,
  p.codigo, p.nombre as trabajo,
  p.organizacion_id, o.nombre_canonico as cliente,
  e.nombre as etapa, e.orden as etapa_orden,
  c.orden, c.nombre, c.detalle,
  p.color, p.etapa as etapa_pipeline
from componentes c
join etapas_cotizacion e on e.id = c.etapa_id
join proyectos p         on p.id = e.proyecto_id
join organizaciones o    on o.id = p.organizacion_id
where c.estado = 'sin_cotizar' and p.archivado_at is null;

grant select on v_sin_cotizar to authenticated;

comment on view v_sin_cotizar is
  'Alcance presentado al cliente que necesita relevamiento antes de poder cotizarse. Es la venta que sigue: sin esto se pierde en el PDF de la propuesta.';
