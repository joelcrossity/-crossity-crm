-- ------------------------------------------------------------------
-- El dólar de cada pago: hereda, se puede pisar, y se congela al pagar.
--
-- Lo normal es que no cambie nunca: el tipo de cambio se arregla por
-- contrato y vale para todo el proyecto. Por eso hereda solo y no hay
-- que elegirlo en cada pago.
--
-- Pero puede haber una renegociación, y ahí aparece el problema real:
-- si el pago siempre heredara del proyecto, cambiar el dólar del
-- proyecto reescribiría lo que ya se pagó. Alguien que cobró en marzo a
-- 1.100 pasaría a figurar cobrado a 1.500, y la liquidación de marzo
-- dejaría de cerrar contra lo que efectivamente se transfirió.
--
-- Entonces: mientras está pendiente, sigue al proyecto —si se
-- renegocia, lo pendiente se actualiza solo, que es lo que uno espera—.
-- Al liquidarse, se estampa la cotización que se usó y desde ahí no se
-- mueve más. Lo pagado es un hecho, no una fórmula.
--
-- Y se puede pisar a mano antes de pagar, para el caso puntual: un pago
-- en billete, o uno que se acordó a otro valor por única vez.
-- ------------------------------------------------------------------

create or replace function cotizacion_de_porcion(p_porcion uuid)
returns numeric
language sql stable
as $$
  select coalesce(
    -- Lo estampado manda: si está, ya se decidió.
    po.cotizacion_pago,
    case when po.moneda = 'ARS' then 1
         else cotizacion_del_proyecto(h.proyecto_id) end
  )
  from porciones po join hitos h on h.id = po.hito_id
  where po.id = p_porcion;
$$;

grant execute on function cotizacion_de_porcion(uuid) to authenticated;

comment on function cotizacion_de_porcion is
  'A qué dólar se paga esta porción. La estampada si la tiene; si no, la del proyecto. Pesos siempre 1.';


-- Al pasar a liquidado se estampa lo que valía en ese momento. Va por
-- trigger y no lo escribe quien liquida: un campo que hay que acordarse
-- de completar queda vacío la primera vez que alguien se apura, y
-- entonces el pago vuelve a seguir al proyecto sin que nadie lo note.
create or replace function congelar_cotizacion_al_pagar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'liquidado' and old.estado is distinct from 'liquidado' then
    if new.cotizacion_pago is null then
      new.cotizacion_pago := cotizacion_de_porcion(new.id);
    end if;
    if new.moneda_pago is null then
      new.moneda_pago := coalesce(new.moneda_pago, new.moneda);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists porciones_congelar on porciones;
create trigger porciones_congelar
  before update on porciones
  for each row execute function congelar_cotizacion_al_pagar();


-- Pisar el dólar de un pago antes de que se pague.
create or replace function fijar_cotizacion_de_pago(
  p_porcion uuid, p_cotizacion numeric, p_moneda char(3) default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v porciones%rowtype;
begin
  if not puede_persona('cargar_cobros') then
    raise exception 'No tenés el permiso para tocar las liquidaciones.';
  end if;

  select * into v from porciones where id = p_porcion;
  if not found then raise exception 'Esa porción no existe.'; end if;

  if v.estado = 'liquidado' then
    raise exception 'Ese pago ya se liquidó: su cotización quedó fija.'
      using hint = 'Si hubo un error, hay que revertir la liquidación primero.';
  end if;

  if p_cotizacion is not null and p_cotizacion <= 0 then
    raise exception 'La cotización tiene que ser mayor que cero.';
  end if;

  update porciones
     set cotizacion_pago = p_cotizacion,
         moneda_pago = coalesce(p_moneda, moneda_pago)
   where id = p_porcion;
end;
$$;

grant execute on function fijar_cotizacion_de_pago(uuid, numeric, char) to authenticated;


-- El reparto, con lo que cada porción vale en pesos hoy y si ese número
-- está fijo o todavía se mueve.
drop view if exists v_reparto;
create view v_reparto
with (security_invoker = true)
as
select
  pa.proyecto_id,
  pa.persona_id,
  pe.nombre        as persona,
  pa.concepto,
  po.id            as porcion_id,
  po.hito_id,
  h.titulo         as entrega,
  po.monto,
  po.moneda,
  po.estado,
  po.monto_pagado,
  po.moneda_pago,
  po.cotizacion_pago,
  cotizacion_de_porcion(po.id)                          as cotizacion,
  round(po.monto * cotizacion_de_porcion(po.id), 2)     as en_pesos,
  -- Fijo cuando ya se estampó: o porque se liquidó, o porque alguien lo
  -- pisó a mano. Si no, sigue al proyecto y puede cambiar.
  (po.cotizacion_pago is not null)                      as cotizacion_fija
from porciones po
join participaciones pa on pa.id = po.participacion_id
join personas pe        on pe.id = pa.persona_id
join hitos h            on h.id = po.hito_id;

grant select on v_reparto to authenticated;
