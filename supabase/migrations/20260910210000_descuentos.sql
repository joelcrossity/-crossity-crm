-- ============================================================
-- Lo que se descuenta antes de repartir, a la vista.
--
-- Los gastos y los impuestos ya se restaban de la base de reparto desde
-- el primer día, pero —igual que pasaba con el reparto— no había
-- pantalla para verlos ni cargarlos. El cálculo estaba bien y era
-- invisible, que en la práctica es como si no estuviera: si nadie puede
-- cargar la retención, la retención se descuenta a mano en otro lado y
-- el sistema queda mintiendo.
--
-- Nada de esto agrega lógica nueva. Es la ventana a lo que ya pasaba.
-- ============================================================

-- Los conceptos que se repiten. Que estén escritos evita dos cosas:
-- que cada uno los escriba distinto y que haya que acordarse del
-- porcentaje del impuesto al cheque cada vez.
create table conceptos_impuesto (
  clave        text primary key,
  etiqueta     text not null,
  alicuota     numeric(6,3),
  jurisdiccion text not null default 'nacional',
  ayuda        text,
  orden        integer not null default 100
);

insert into conceptos_impuesto (clave, etiqueta, alicuota, jurisdiccion, ayuda, orden) values
  ('debitos_creditos', 'Impuesto al cheque', 0.6, 'nacional',
   'Débitos y créditos bancarios. Se aplica sobre el monto que entra', 10),
  ('retencion_iibb',   'Retención de Ingresos Brutos', null, 'provincial',
   'La que retiene el cliente al pagarnos', 20),
  ('retencion_ganancias', 'Retención de Ganancias', null, 'nacional',
   'La que retiene el cliente al pagarnos', 30),
  ('retencion_iva',    'Retención de IVA', null, 'nacional',
   'La que retiene el cliente al pagarnos', 40),
  ('comision_bancaria','Comisión bancaria o de pasarela', null, 'nacional',
   'Lo que se queda el banco o Mercado Pago', 50),
  ('otro',             'Otro', null, 'nacional', 'Cualquier otra cosa que se descuente', 90);

alter table conceptos_impuesto enable row level security;
create policy conceptos_lectura on conceptos_impuesto for select to authenticated using (true);
grant select on conceptos_impuesto to authenticated;

comment on table conceptos_impuesto is
  'Que estén escritos evita que cada uno los nombre distinto y que haya que acordarse del 0,6 % cada vez.';

-- ------------------------------------------------------------
-- Todo lo que se descuenta de un proyecto, en una sola lista.
--
-- Un gasto y una retención no son lo mismo contablemente, pero para la
-- pregunta que se hace acá —qué se va antes de repartir— son la misma
-- columna, y separarlos en dos pantallas obliga a sumar de cabeza.
-- ------------------------------------------------------------

create or replace view v_descuentos
with (security_invoker = true)
as
select
  'g' || g.id            as clave,
  g.id,
  g.proyecto_id,
  g.hito_id,
  'gasto'::text          as clase,
  g.descripcion          as concepto,
  g.proveedor            as detalle,
  g.costo_real           as monto,
  g.neto,
  g.alicuota_iva         as alicuota,
  g.iva_discriminado,
  g.fecha,
  h.titulo               as entrega
from gastos g
left join hitos h on h.id = g.hito_id

union all

select
  'i' || i.id,
  i.id,
  i.proyecto_id,
  i.hito_id,
  'impuesto',
  i.concepto,
  i.jurisdiccion,
  i.monto,
  i.monto,
  i.alicuota,
  true,
  i.created_at::date,
  h.titulo
from impuestos i
left join hitos h on h.id = i.hito_id;

grant select on v_descuentos to authenticated;

comment on view v_descuentos is
  'Un gasto y una retención no son lo mismo contablemente, pero para la pregunta de acá —qué se va antes de repartir— son la misma columna.';

-- ------------------------------------------------------------
-- Cargar un impuesto o retención.
--
-- Se puede dar el monto directo o una alícuota sobre una base; lo
-- segundo es lo común en las retenciones y calcularlo a mano es la
-- forma más fácil de equivocarse por un decimal.
-- ------------------------------------------------------------

create or replace function anotar_impuesto(
  p_proyecto uuid,
  p_hito     uuid,
  p_concepto text,
  p_jurisdiccion text,
  p_alicuota numeric,
  p_base     numeric,
  p_monto    numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_monto numeric;
  v_id    uuid;
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración cargan impuestos';
  end if;

  v_monto := coalesce(p_monto, round(coalesce(p_base, 0) * coalesce(p_alicuota, 0) / 100, 2));

  if v_monto <= 0 then
    raise exception 'El descuento tiene que ser mayor a cero';
  end if;

  insert into impuestos (proyecto_id, hito_id, jurisdiccion, concepto, alicuota, monto)
  values (p_proyecto, p_hito, coalesce(p_jurisdiccion, 'nacional'), p_concepto, p_alicuota, v_monto)
  returning id into v_id;

  -- El reparto se rehace: lo que se descuenta cambia lo que hay para todos.
  perform recalcular_porciones(h.id) from hitos h where h.proyecto_id = p_proyecto;
  return v_id;
end;
$$;

create or replace function anotar_gasto(
  p_proyecto    uuid,
  p_hito        uuid,
  p_descripcion text,
  p_proveedor   text,
  p_neto        numeric,
  p_alicuota    numeric,
  p_discriminado boolean,
  p_fecha       date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not (es_direccion() or es_admin() or es_pm()) then
    raise exception 'No tenés permiso para cargar gastos en este proyecto';
  end if;

  if p_neto <= 0 then
    raise exception 'El gasto tiene que ser mayor a cero';
  end if;

  insert into gastos (proyecto_id, hito_id, descripcion, proveedor, neto, alicuota_iva,
                      iva_discriminado, fecha)
  values (p_proyecto, p_hito, trim(p_descripcion), nullif(trim(p_proveedor), ''),
          p_neto, coalesce(p_alicuota, 21), coalesce(p_discriminado, true),
          coalesce(p_fecha, current_date))
  returning id into v_id;

  perform recalcular_porciones(h.id) from hitos h where h.proyecto_id = p_proyecto;
  return v_id;
end;
$$;

create or replace function borrar_descuento(p_clase text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_proyecto uuid;
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración borran descuentos';
  end if;

  if p_clase = 'gasto' then
    select proyecto_id into v_proyecto from gastos where id = p_id;
    delete from gastos where id = p_id;
  else
    select proyecto_id into v_proyecto from impuestos where id = p_id;
    delete from impuestos where id = p_id;
  end if;

  perform recalcular_porciones(h.id) from hitos h where h.proyecto_id = v_proyecto;
end;
$$;

grant execute on function anotar_impuesto(uuid, uuid, text, text, numeric, numeric, numeric) to authenticated;
grant execute on function anotar_gasto(uuid, uuid, text, text, numeric, numeric, boolean, date) to authenticated;
grant execute on function borrar_descuento(text, uuid) to authenticated;
