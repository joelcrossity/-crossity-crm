-- ============================================================
-- Definiciones de Joel del 31/08.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Naranja para lo terminado; rojo queda para lo que salió mal.
-- ------------------------------------------------------------

update proyectos set color = 'naranja', motivo_rojo = null
 where color = 'rojo' and motivo_rojo = 'entregado';

alter table proyectos drop constraint if exists rojo_con_motivo;

alter table proyectos
  add constraint rojo_con_motivo check (
    (color = 'rojo') = (motivo_rojo is not null)
  ),
  -- entregado deja de ser un motivo de rojo: es el naranja entero
  add constraint rojo_es_mal_final check (
    motivo_rojo is null or motivo_rojo in ('perdido', 'descartado')
  ),
  add constraint naranja_sin_motivo check (
    color <> 'naranja' or (motivo_rojo is null and motivo_gris is null)
  );

comment on constraint rojo_es_mal_final on proyectos is
  'Terminar bien y perder no pueden compartir color, o la tasa de conversión no se puede leer.';

-- ------------------------------------------------------------
-- 2. El project manager ve lo que tiene a su cargo, no todo el CRM.
-- ------------------------------------------------------------

create or replace function ve_todo()
returns boolean
language sql
stable
as $$ select es_direccion() or es_admin() or es_coordinacion() $$;

-- Ser responsable de un proyecto cuenta como estar en él.
create or replace function participa_en(p_proyecto uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from proyectos p
     where p.id = p_proyecto and p.responsable_id = persona_actual()
  ) or exists (
    select 1 from asignaciones a
     where a.proyecto_id = p_proyecto
       and a.persona_id = persona_actual()
       and a.hasta is null
  ) or exists (
    select 1 from participaciones pa
     where pa.proyecto_id = p_proyecto
       and pa.persona_id = persona_actual()
  )
$$;

-- Acá hay dos economías distintas y hasta ahora estaban juntas:
--
--   la del cliente  — cuánto se le cotizó, qué se le facturó, si pagó.
--   la de adentro   — qué se le paga a cada uno por ese trabajo.
--
-- El project manager y el vendedor necesitan la primera para hacer su
-- trabajo, y no tienen por qué ver la segunda.

-- Economía con el cliente: el PM la ve en los proyectos que maneja.
create or replace function ve_facturacion_de(p_proyecto uuid)
returns boolean
language sql
stable
as $$
  select es_direccion() or es_admin()
      or ((es_pm() or tiene_rol('vendedor')) and participa_en(p_proyecto))
      or apertura_abierta_en(p_proyecto)
$$;

-- Economía de adentro: costos y arreglos. No la ve el PM.
create or replace function ve_economia_de(p_proyecto uuid)
returns boolean
language sql
stable
as $$
  select es_direccion() or es_admin() or apertura_abierta_en(p_proyecto)
$$;

comment on function ve_economia_de is
  'Un desarrollador contratado a monto fijo entra como gasto, no como participación: por eso los gastos revelan el arreglo tanto como las participaciones, y van del mismo lado de la línea.';

-- Los cobros son economía del cliente, no de adentro.
drop policy if exists cobros_lectura on cobros;
create policy cobros_lectura on cobros for select to authenticated
  using (
    es_direccion() or es_admin()
    or exists (
      select 1 from hitos h
       where h.id = cobros.hito_id
         and ve_facturacion_de(h.proyecto_id)
    )
  );

-- ------------------------------------------------------------
-- 3. El arranque y el cobro son dos canales separados.
--
-- Deja de ser una excepción que hay que justificar y pasa a ser una
-- política del proyecto: hay trabajos que arrancan contra anticipo y
-- otros que arrancan y se cobran por su lado. Los dos son legítimos y
-- los dos quedan registrados.
-- ------------------------------------------------------------

alter table proyectos
  add column requiere_anticipo boolean not null default true;

comment on column proyectos.requiere_anticipo is
  'Falso no es una excepción: es la otra forma de trabajar, la que se usa con el Estado y con clientes de confianza.';

alter table proyectos drop constraint if exists excepcion_anticipo_justificada;

create or replace function generar_hitos(
  p_proyecto uuid,
  p_esquema  esquema_cobro default null,
  p_cuotas   integer default 6
)
returns void
language plpgsql
as $$
declare
  v_esquema esquema_cobro;
  v_monto   numeric(14,2);
  v_fecha   date;
  v_exige   boolean;
  i         integer;
begin
  select coalesce(p_esquema, esquema_cobro), coalesce(monto_neto, 0),
         fecha_comprometida, requiere_anticipo
    into v_esquema, v_monto, v_fecha, v_exige
    from proyectos where id = p_proyecto;

  if exists (select 1 from hitos where proyecto_id = p_proyecto) then
    raise exception 'El proyecto % ya tiene hitos', p_proyecto;
  end if;

  if v_esquema = 'cincuenta_cincuenta' then
    insert into hitos (proyecto_id, orden, titulo, porcentaje, monto_neto, es_anticipo, fecha_comprometida)
    values (p_proyecto, 1, 'Anticipo para arrancar', 50, round(v_monto * 0.5, 2), true, null),
           (p_proyecto, 2, 'Saldo contra entrega',   50, round(v_monto * 0.5, 2), false, v_fecha);
  elsif v_esquema = 'adelantado' then
    insert into hitos (proyecto_id, orden, titulo, porcentaje, monto_neto, es_anticipo, fecha_comprometida)
    values (p_proyecto, 1, 'Pago total por adelantado', 100, v_monto, true, null);
  elsif v_esquema = 'mensual' then
    for i in 1..p_cuotas loop
      insert into hitos (proyecto_id, orden, titulo, porcentaje, monto_neto, es_anticipo, fecha_comprometida)
      values (p_proyecto, i, 'Mes ' || i, round(100.0 / p_cuotas, 3),
              round(v_monto / p_cuotas, 2), i = 1,
              (coalesce(v_fecha, current_date) + ((i - 1) || ' month')::interval)::date);
    end loop;
  elsif v_esquema = 'por_hitos' then
    for i in 1..4 loop
      insert into hitos (proyecto_id, orden, titulo, porcentaje, monto_neto, es_anticipo, fecha_comprometida)
      values (p_proyecto, i, 'Entrega ' || i, 25, round(v_monto * 0.25, 2), i = 1, null);
    end loop;
  end if;

  -- Sólo espera el anticipo el que lo exige. El resto arranca cuando
  -- se decide arrancar, y el cobro corre por su carril.
  if v_esquema <> 'a_convenir' and v_exige then
    update proyectos
       set color = 'gris', motivo_gris = 'esperando_anticipo', subestado = null
     where id = p_proyecto and color not in ('rojo', 'naranja');
  end if;
end;
$$;

-- Trabajando sin haber cobrado el anticipo: no está mal, pero hay que verlo.
create or replace view v_trabajando_sin_cobrar
with (security_invoker = true)
as
select
  p.id, p.codigo, p.nombre,
  o.nombre_canonico as cliente,
  p.monto_neto, p.moneda,
  p.fecha_inicio,
  (select coalesce(sum(c.monto), 0) from cobros c
     join hitos h on h.id = c.hito_id where h.proyecto_id = p.id) as cobrado
from proyectos p
join organizaciones o on o.id = p.organizacion_id
where p.color = 'verde'
  and not exists (
    select 1 from hitos h
     where h.proyecto_id = p.id and h.es_anticipo and h.cobrado_at is not null
  );

grant select on v_trabajando_sin_cobrar to authenticated;

-- ------------------------------------------------------------
-- 4. Adelantos: la empresa le paga a alguien antes de cobrarle al cliente.
--
-- Para la persona está cobrado; para la empresa no entró todavía. Es
-- plata propia puesta a cuenta de un cobro futuro, y por eso tiene que
-- verse distinta de una liquidación común.
-- ------------------------------------------------------------

alter table porciones
  add column adelantada boolean not null default false;

comment on column porciones.adelantada is
  'Se pagó antes de que el cliente pagara. Es caja de la empresa a riesgo, no una liquidación normal.';

alter table porciones drop constraint if exists pago_completo;

alter table porciones
  add constraint pago_completo check (
    estado <> 'liquidado'
    or (moneda_pago is not null and monto_pagado is not null)
  );

create or replace function adelantar_porcion(
  p_porcion    uuid,
  p_monto      numeric,
  p_moneda     char(3),
  p_cotizacion numeric default 1
)
returns void
language plpgsql
as $$
declare v_estado estado_porcion;
begin
  select estado into v_estado from porciones where id = p_porcion;

  if v_estado = 'liquidado' then
    raise exception 'Esa porción ya se pagó';
  end if;

  update porciones
     set estado = 'liquidado',
         adelantada = (v_estado <> 'a_liquidar'),
         moneda_pago = p_moneda,
         monto_pagado = p_monto,
         cotizacion_pago = p_cotizacion
   where id = p_porcion;
end;
$$;

comment on function adelantar_porcion is
  'Sirve para las dos cosas: liquidar lo que ya entró, y adelantar lo que todavía no. La diferencia queda marcada sola.';

-- Cuánta plata propia hay puesta esperando que pague el cliente.
create or replace view v_adelantos_pendientes
with (security_invoker = true)
as
select
  coalesce(pe.nombre, 'Crossity · gestión') as participante,
  p.codigo, p.nombre as proyecto,
  o.nombre_canonico  as cliente,
  po.monto_pagado, po.moneda_pago,
  h.facturado_at is not null as facturado,
  h.cobrado_at   is not null as cobrado_al_cliente
from porciones po
join participaciones pa on pa.id = po.participacion_id
join hitos h  on h.id = po.hito_id
join proyectos p on p.id = h.proyecto_id
join organizaciones o on o.id = p.organizacion_id
left join personas pe on pe.id = pa.persona_id
where po.adelantada
  and h.cobrado_at is null;

comment on view v_adelantos_pendientes is
  'Plata de la empresa adelantada sobre cobros que todavía no entraron. Es exposición, no gasto.';

grant select on v_adelantos_pendientes to authenticated;

-- ------------------------------------------------------------
-- 5. Vistas que miraban el rojo con motivo entregado.
-- ------------------------------------------------------------

drop view if exists v_sin_mantenimiento;
create view v_sin_mantenimiento
with (security_invoker = true)
as
select p.id, p.codigo, p.nombre, o.nombre_canonico as cliente, p.fecha_comprometida
from proyectos p
join organizaciones o on o.id = p.organizacion_id
where p.tipo = 'proyecto'
  and p.color = 'naranja'
  and not exists (select 1 from proyectos m where m.origen_id = p.id);

drop view if exists v_recurrentes;
create view v_recurrentes
with (security_invoker = true)
as
select p.id, p.codigo, p.nombre, o.nombre_canonico as cliente,
       p.monto_mensual, p.moneda, p.vigencia_desde, p.vigencia_hasta,
       p.renovacion_automatica, p.color, orig.codigo as viene_de,
       (p.vigencia_hasta is not null and p.vigencia_hasta <= current_date + 60) as vence_pronto
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join proyectos orig on orig.id = p.origen_id
where p.tipo = 'mantenimiento'
  and p.color not in ('rojo', 'naranja');

drop view if exists v_reparto_incompleto;
create view v_reparto_incompleto
with (security_invoker = true)
as
select p.id, p.codigo, p.nombre, o.nombre_canonico as cliente,
       coalesce(sum(pa.porcentaje), 0) as suma_porcentajes,
       100 - coalesce(sum(pa.porcentaje), 0) as diferencia
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join participaciones pa on pa.proyecto_id = p.id
where p.color in ('verde', 'gris')
group by p.id, p.codigo, p.nombre, o.nombre_canonico
having coalesce(sum(pa.porcentaje), 0) <> 100;

grant select on v_sin_mantenimiento, v_recurrentes, v_reparto_incompleto to authenticated;
