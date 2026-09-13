-- ------------------------------------------------------------------
-- Registrar un pago a alguien del equipo.
--
-- Era la mitad que faltaba del circuito de la plata. Todo el camino
-- estaba: la participación, las porciones por entrega, el pase
-- automático a "a liquidar" cuando el cliente paga. Lo que no había era
-- la forma de decir "le transferí". Sin eso, "listo para transferirle"
-- crece para siempre y nadie sabe qué se pagó.
--
-- No crea un egreso aparte en las cajas. La caja no lleva saldo propio:
-- cuenta los cobros y los pagos que ya existen, así que alcanza con
-- decirle a la porción de qué caja salió. Un egreso separado sería
-- anotar la misma salida dos veces, y a la larga una de las dos queda
-- mal.
--
-- Se paga en la moneda de la caja. Si la porción está en dólares y la
-- caja en pesos, se convierte con la cotización de esa porción —que el
-- trigger deja congelada— y queda registrado cuánto se transfirió de
-- verdad, no cuánto valía en teoría.
-- ------------------------------------------------------------------

create or replace function registrar_pago(
  p_porciones uuid[],
  p_fecha     date default current_date,
  p_caja      uuid default null,
  p_notas     text default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_liq      uuid;
  v_moneda   char(3);
  v_total    numeric := 0;
  r          record;
  v_pagado   numeric;
  v_cot      numeric;
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración registran pagos al equipo.';
  end if;

  if p_porciones is null or array_length(p_porciones, 1) is null then
    raise exception 'No elegiste ninguna entrega para pagar.';
  end if;

  if p_caja is not null then
    select moneda into v_moneda from cajas where id = p_caja and activa;
    if v_moneda is null then raise exception 'Esa caja no existe o está apagada.'; end if;
  end if;

  -- Todas tienen que estar listas. Pagar algo que el cliente todavía no
  -- pagó es adelantar plata, y eso es una decisión aparte que ya tiene
  -- su propio circuito.
  if exists (select 1 from porciones where id = any(p_porciones) and estado <> 'a_liquidar') then
    raise exception 'Alguna de esas entregas no está lista para liquidar.'
      using hint = 'Solo se paga lo que el cliente ya pagó.';
  end if;

  insert into liquidaciones (periodo, fecha, notas)
  values (date_trunc('month', p_fecha)::date, p_fecha, p_notas)
  returning id into v_liq;

  for r in select * from porciones where id = any(p_porciones) loop
    v_cot := cotizacion_de_porcion(r.id);

    -- Cuánto sale efectivamente de la caja, en la moneda de la caja.
    if p_caja is null or v_moneda = r.moneda then
      v_pagado := r.monto;
    elsif r.moneda = 'USD' and v_moneda = 'ARS' then
      v_pagado := round(r.monto * v_cot, 2);
    elsif r.moneda = 'ARS' and v_moneda = 'USD' then
      if coalesce(v_cot, 0) <= 0 then
        raise exception 'Falta la cotización para pagar en dólares una porción en pesos.';
      end if;
      v_pagado := round(r.monto / v_cot, 2);
    else
      v_pagado := r.monto;
    end if;

    update porciones
       set estado         = 'liquidado',
           liquidacion_id = v_liq,
           caja_id        = p_caja,
           monto_pagado   = v_pagado,
           moneda_pago    = coalesce(v_moneda, r.moneda)
     where id = r.id;

    v_total := v_total + v_pagado;
  end loop;

  return v_total;
end;
$$;

grant execute on function registrar_pago(uuid[], date, uuid, text) to authenticated;

comment on function registrar_pago is
  'Marca entregas como pagadas y las cuelga de una caja. No crea un egreso aparte: la caja cuenta las porciones que la apuntan.';


-- Deshacer un pago mal cargado. Devuelve las porciones a "a liquidar" y
-- les saca la cotización congelada, para que vuelvan a seguir al
-- proyecto mientras están pendientes.
create or replace function revertir_pago(p_liquidacion uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración revierten pagos.';
  end if;

  update porciones
     set estado = 'a_liquidar', liquidacion_id = null, caja_id = null,
         monto_pagado = null, cotizacion_pago = null, moneda_pago = null
   where liquidacion_id = p_liquidacion;

  delete from liquidaciones where id = p_liquidacion;
end;
$$;

grant execute on function revertir_pago(uuid) to authenticated;


-- ------------------------------------------------------------------
-- Lo que se le pagó a cada uno: cuándo, de qué caja y por qué entrega.
-- ------------------------------------------------------------------

drop view if exists v_pagos_hechos;
create view v_pagos_hechos
with (security_invoker = true)
as
select
  l.id            as liquidacion_id,
  l.fecha,
  l.periodo,
  l.notas,
  pa.persona_id,
  pe.nombre       as persona,
  p.codigo,
  p.nombre        as proyecto,
  h.titulo        as entrega,
  po.id           as porcion_id,
  po.monto,
  po.moneda,
  po.monto_pagado,
  po.moneda_pago,
  po.cotizacion_pago,
  c.nombre        as caja,
  po.factura_numero,
  po.factura_at
from porciones po
join liquidaciones l    on l.id = po.liquidacion_id
join participaciones pa on pa.id = po.participacion_id
join personas pe        on pe.id = pa.persona_id
join hitos h            on h.id = po.hito_id
join proyectos p        on p.id = h.proyecto_id
left join cajas c       on c.id = po.caja_id;

grant select on v_pagos_hechos to authenticated;
