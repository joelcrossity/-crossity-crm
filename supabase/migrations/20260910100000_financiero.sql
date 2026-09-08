-- ============================================================
-- Lo que falta para que administración cierre.
--
-- Cuatro agujeros, y ninguno es de cálculo: son datos que hoy no
-- existen en ningún lado y por eso las pantallas no pueden mostrarlos.
--
--   1. La factura que el profesional le tiene que hacer a Crossity.
--      Sabemos cuánto le debemos; no sabemos si ya facturó. Y sin la
--      factura no se puede pagar.
--   2. Los costos fijos de la empresa. `gastos` exige proyecto, así que
--      el alquiler, las herramientas y los sueldos no entran a ningún
--      lado y el cashflow queda mintiendo por optimista.
--   3. La proyección. Todo lo que hay es pasado; lo que se necesita
--      para decidir es el mes que viene.
--   4. El estado de resultado por proyecto: qué entró, qué salió y qué
--      queda, en una sola fila.
-- ============================================================

-- ------------------------------------------------------------
-- 1. La factura que nos deben hacer.
--
-- Va en la porción y no en una tabla aparte porque la porción ya es la
-- unidad de "cuánto le debo a quién por qué trabajo". Una tabla nueva
-- obligaría a mantener las dos en línea.
-- ------------------------------------------------------------

alter table porciones
  add column factura_at     date,
  add column factura_numero text;

comment on column porciones.factura_at is
  'Cuándo nos facturó. Sabíamos cuánto le debíamos y no si ya había facturado, que es lo que traba el pago.';

create index porciones_sin_factura on porciones (estado)
  where estado = 'a_liquidar' and factura_at is null;

-- ------------------------------------------------------------
-- 2. Costos fijos de la empresa.
--
-- No cuelgan de un proyecto y por eso no entraban en ningún lado. Sin
-- ellos el cashflow miente por optimista: muestra lo que entra y solo
-- una parte de lo que sale.
-- ------------------------------------------------------------

create type periodicidad as enum ('mensual', 'bimestral', 'trimestral', 'semestral', 'anual');

create table costos_fijos (
  id            uuid primary key default gen_random_uuid(),
  concepto      text not null,
  proveedor     text,
  monto         numeric(14,2) not null,
  moneda        char(3) not null default 'ARS' references monedas(codigo),
  cada          periodicidad not null default 'mensual',
  dia_del_mes   smallint,
  desde         date not null default current_date,
  hasta         date,
  notas         text,
  created_at    timestamptz not null default now(),

  constraint monto_positivo check (monto > 0),
  constraint dia_valido check (dia_del_mes is null or dia_del_mes between 1 and 28)
);

comment on table costos_fijos is
  'Lo que sale todos los meses pase lo que pase. Sin esto el cashflow solo mira los ingresos.';

comment on column costos_fijos.dia_del_mes is
  'Hasta 28: los meses cortos no deben mover un vencimiento de lugar.';

alter table costos_fijos enable row level security;

create policy costos_lectura on costos_fijos for select to authenticated
  using (es_direccion() or es_admin());
create policy costos_alta on costos_fijos for insert to authenticated
  with check (es_direccion() or es_admin());
create policy costos_cambio on costos_fijos for update to authenticated
  using (es_direccion() or es_admin()) with check (es_direccion() or es_admin());
create policy costos_baja on costos_fijos for delete to authenticated
  using (es_direccion() or es_admin());

grant select, insert, update, delete on costos_fijos to authenticated;

-- Cuántas veces al año se paga: sirve para llevar todo a mensual.
create or replace function veces_por_ano(p periodicidad)
returns numeric
language sql
immutable
as $$
  select case p
    when 'mensual' then 12 when 'bimestral' then 6 when 'trimestral' then 4
    when 'semestral' then 2 else 1 end::numeric
$$;

-- ------------------------------------------------------------
-- 3. Lo que hay que facturar, de los dos lados.
-- ------------------------------------------------------------

-- Al cliente: se entregó y todavía no salió la factura.
create or replace view v_por_facturar
with (security_invoker = true)
as
select
  h.id,
  h.titulo,
  h.monto_neto,
  h.moneda,
  p.alicuota_iva,
  round(h.monto_neto * (1 + p.alicuota_iva / 100), 2) as con_iva,
  h.entregado_at,
  (current_date - h.entregado_at::date) as dias_desde_la_entrega,
  p.codigo as proyecto_codigo,
  p.nombre as proyecto,
  o.nombre_canonico as cliente,
  r.razon_social,
  r.cuit
from hitos h
join proyectos p      on p.id = h.proyecto_id
join organizaciones o on o.id = p.organizacion_id
left join razones_sociales r on r.organizacion_id = o.id and r.es_principal
where h.entregado_at is not null
  and h.facturado_at is null;

grant select on v_por_facturar to authenticated;

comment on view v_por_facturar is
  'Se entregó y no se facturó. Cada día acá es un día que la plata no empieza a correr.';

-- De los profesionales: nos deben la factura para poder pagarles.
create or replace view v_facturas_a_recibir
with (security_invoker = true)
as
select
  po.id,
  pe.id     as persona_id,
  coalesce(pe.nombre, 'Crossity') as persona,
  po.monto,
  h.moneda,
  h.titulo  as entrega,
  p.codigo  as proyecto_codigo,
  p.nombre  as proyecto,
  pa.concepto
from porciones po
join hitos h            on h.id = po.hito_id
join proyectos p        on p.id = h.proyecto_id
join participaciones pa on pa.id = po.participacion_id
left join personas pe   on pe.id = pa.persona_id
where po.estado = 'a_liquidar'
  and po.factura_at is null
  and not pa.es_crossity;

grant select on v_facturas_a_recibir to authenticated;

comment on view v_facturas_a_recibir is
  'La plata del cliente ya entró y no se puede transferir hasta que facturen. Es el paso que nadie recuerda pedir.';

-- ------------------------------------------------------------
-- 4. El estado de resultado de cada proyecto, en una fila.
-- ------------------------------------------------------------

create or replace view v_posicion_proyecto
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico as cliente,
  p.color,
  p.tipo,
  p.moneda,
  coalesce(p.monto_neto, 0) as acordado,
  coalesce((select sum(h.monto_neto) from hitos h
             where h.proyecto_id = p.id and h.entregado_at is not null), 0) as entregado,
  coalesce((select sum(h.monto_neto) from hitos h
             where h.proyecto_id = p.id and h.facturado_at is not null), 0) as facturado,
  coalesce((select sum(h.monto_neto) from hitos h
             where h.proyecto_id = p.id and h.cobrado_at is not null), 0)   as cobrado,
  coalesce((select sum(g.neto) from gastos g where g.proyecto_id = p.id), 0) as gastos,
  coalesce((select sum(i.monto) from impuestos i where i.proyecto_id = p.id), 0) as impuestos,
  coalesce((select sum(po.monto) from porciones po
             join hitos h on h.id = po.hito_id
             join participaciones pa on pa.id = po.participacion_id
            where h.proyecto_id = p.id and not pa.es_crossity), 0) as para_terceros,
  coalesce((select sum(po.monto) from porciones po
             join hitos h on h.id = po.hito_id
             join participaciones pa on pa.id = po.participacion_id
            where h.proyecto_id = p.id and pa.es_crossity), 0) as para_crossity,
  coalesce((select sum(po.monto) from porciones po
             join hitos h on h.id = po.hito_id
            where h.proyecto_id = p.id and po.estado = 'a_liquidar'), 0) as a_transferir
from proyectos p
join organizaciones o on o.id = p.organizacion_id;

grant select on v_posicion_proyecto to authenticated;

comment on view v_posicion_proyecto is
  'Acordado, entregado, facturado y cobrado son cuatro hechos distintos y acá se ven juntos, que es la única forma de notar dónde se traba.';

-- ------------------------------------------------------------
-- 5. Lo que entra y sale todos los meses, y la proyección.
-- ------------------------------------------------------------

create or replace view v_recurrente
with (security_invoker = true)
as
-- Entra: los abonos vigentes
select
  'entra'::text as lado,
  p.nombre      as concepto,
  o.nombre_canonico as quien,
  p.monto_mensual   as mensual,
  p.moneda,
  p.codigo
from proyectos p
join organizaciones o on o.id = p.organizacion_id
where p.tipo = 'mantenimiento'
  and p.color = 'verde'
  and p.monto_mensual is not null

union all

-- Sale: los costos fijos, llevados a su equivalente mensual
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
  'Lo que pasa todos los meses sin que nadie haga nada. Es el piso sobre el que se apoya todo lo demás.';

-- La proyección: seis meses hacia adelante, mes por mes.
create or replace view v_cashflow
with (security_invoker = true)
as
with meses as (
  select generate_series(
    date_trunc('month', current_date),
    date_trunc('month', current_date) + interval '5 months',
    interval '1 month'
  )::date as mes
)
select
  m.mes,

  -- Cobros comprometidos que vencen ese mes
  coalesce((
    select sum(h.monto_neto * cotizacion_a(h.moneda, current_date))
      from hitos h
      join proyectos p on p.id = h.proyecto_id
     where h.cobrado_at is null
       and date_trunc('month', coalesce(h.vence_at, h.fecha_comprometida)) = m.mes
       and p.color in ('verde', 'amarillo')
  ), 0) as por_cobrar,

  -- Cheques que se cobran ese mes
  coalesce((
    select sum(c.importe * cotizacion_a(c.moneda, current_date))
      from cheques c
     where c.tipo = 'recibido'
       and c.estado in ('en_cartera', 'depositado')
       and date_trunc('month', c.fecha_cobro) = m.mes
  ), 0) as cheques,

  -- Abonos: entran todos los meses mientras estén vigentes
  coalesce((
    select sum(p.monto_mensual * cotizacion_a(p.moneda, current_date))
      from proyectos p
     where p.tipo = 'mantenimiento' and p.color = 'verde' and p.monto_mensual is not null
  ), 0) as abonos,

  -- Sale: lo que hay que transferir (todo en el mes en curso)
  case when m.mes = date_trunc('month', current_date) then coalesce((
    select sum(po.monto * cotizacion_a(h.moneda, current_date))
      from porciones po join hitos h on h.id = po.hito_id
     where po.estado = 'a_liquidar'
  ), 0) else 0 end as a_transferir,

  -- Sale: los costos fijos mensualizados
  coalesce((
    select sum(round(c.monto * veces_por_ano(c.cada) / 12, 2) * cotizacion_a(c.moneda, current_date))
      from costos_fijos c
     where c.desde <= (m.mes + interval '1 month')::date
       and (c.hasta is null or c.hasta >= m.mes)
  ), 0) as costos_fijos
from meses m
order by m.mes;

grant select on v_cashflow to authenticated;

comment on view v_cashflow is
  'Todo llevado a pesos con la cotización de hoy. Seis meses: más allá de eso es adivinar.';
