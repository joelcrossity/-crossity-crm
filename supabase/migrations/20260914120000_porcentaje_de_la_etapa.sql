-- ------------------------------------------------------------------
-- El porcentaje de una entrega es de su etapa, no del proyecto.
--
-- reajustar_hitos reparte el total del proyecto entre todos los hitos
-- según su porcentaje, y corre solo cada vez que cambia el monto del
-- proyecto. Con una cotización plana está bien: los porcentajes suman
-- 100 y el reparto es el que se acordó.
--
-- Con dos etapas se rompe. "50 / 50" en la primera y "30 / 40 / 30" en
-- la segunda suman 200, así que repartir el total entre esos cinco
-- números le da la mitad a cada etapa: dos etapas de 10.000 y 8.000
-- terminaban las dos en 9.000. Los montos que el cliente aprobó
-- desaparecían solos al guardar.
--
-- La causa de fondo es que el porcentaje cambió de significado. En una
-- cotización por etapas, 50% quiere decir la mitad de ESA etapa, y el
-- reparto por proyecto no tiene forma de saberlo.
--
-- Entonces en las cotizaciones por etapas el monto es la verdad y el
-- porcentaje no se guarda: se calcula para mostrarlo, dividiendo la
-- entrega por el total de su etapa. Un número guardado que además se
-- puede deducir es un número que va a contradecir al otro.
--
-- Y reajustar_hitos se abstiene cuando el proyecto tiene etapas, por si
-- queda algún porcentaje viejo dando vueltas.
-- ------------------------------------------------------------------

create or replace function reajustar_hitos(p_proyecto uuid)
returns void
language plpgsql
as $$
declare
  v_monto     numeric(14,2);
  v_congelado numeric(14,2);
  v_pct_libre numeric;
begin
  -- Con etapas, los montos los puso la cotización y no se tocan.
  if exists (select 1 from etapas_cotizacion where proyecto_id = p_proyecto) then
    return;
  end if;

  select coalesce(monto_neto, 0) into v_monto from proyectos where id = p_proyecto;

  select coalesce(sum(monto_neto), 0) into v_congelado
    from hitos where proyecto_id = p_proyecto and facturado_at is not null;

  select coalesce(sum(porcentaje), 0) into v_pct_libre
    from hitos where proyecto_id = p_proyecto and facturado_at is null;

  if v_pct_libre <= 0 then
    return;
  end if;

  update hitos
     set monto_neto = round((v_monto - v_congelado) * (porcentaje / v_pct_libre), 2)
   where proyecto_id = p_proyecto
     and facturado_at is null;
end;
$$;


-- El guardado deja de escribir el porcentaje: el monto es la verdad.
create or replace function guardar_cotizacion_por_etapas(p_proyecto uuid, p_etapas jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total    numeric := 0;
  v_etapas   uuid[] := array[]::uuid[];
  v_entregas uuid[] := array[]::uuid[];
  e          jsonb;
  h          jsonb;
  v_eid      uuid;
  v_hid      uuid;
  v_orden    integer := 0;
  v_sub      integer;
begin
  if not (ve_todo() or participa_en(p_proyecto)) then
    raise exception 'No tenés permiso sobre esta oportunidad.';
  end if;
  if not puede_persona('cambiar_montos') then
    raise exception 'No tenés el permiso para cambiar montos.'
      using hint = 'Se activa en Sistema → Usuarios y roles.';
  end if;

  update etapas_cotizacion set orden = orden + 10000 where proyecto_id = p_proyecto;
  update hitos set orden = orden + 10000 where proyecto_id = p_proyecto and activo = false;

  for e in select * from jsonb_array_elements(coalesce(p_etapas, '[]'::jsonb)) loop
    v_orden := v_orden + 1;
    v_eid := nullif(e->>'id', '')::uuid;

    if v_eid is null then
      insert into etapas_cotizacion (proyecto_id, orden, nombre, alcance)
      values (p_proyecto, v_orden, e->>'nombre', nullif(e->>'alcance',''))
      returning id into v_eid;
    else
      update etapas_cotizacion
         set orden = v_orden, nombre = e->>'nombre', alcance = nullif(e->>'alcance','')
       where id = v_eid and proyecto_id = p_proyecto;
    end if;
    v_etapas := v_etapas || v_eid;

    v_sub := 0;
    for h in select * from jsonb_array_elements(coalesce(e->'entregas', '[]'::jsonb)) loop
      v_sub := v_sub + 1;
      v_hid := nullif(h->>'id', '')::uuid;

      if v_hid is null then
        insert into hitos (proyecto_id, etapa_id, orden, titulo, entregable,
                           monto_neto, moneda, casa_cotizacion, cotizacion_pactada,
                           vence_at, es_anticipo, activo)
        values (p_proyecto, v_eid, v_orden * 100 + v_sub,
                h->>'titulo', nullif(h->>'entregable',''),
                (h->>'monto')::numeric,
                coalesce(nullif(h->>'moneda',''), 'ARS'),
                nullif(h->>'casa',''), nullif(h->>'cotizacion','')::numeric,
                nullif(h->>'vence','')::date,
                coalesce((h->>'es_anticipo')::boolean, v_sub = 1),
                false)
        returning id into v_hid;
      else
        update hitos
           set etapa_id = v_eid,
               orden = v_orden * 100 + v_sub,
               titulo = h->>'titulo',
               entregable = nullif(h->>'entregable',''),
               porcentaje = null,
               monto_neto = (h->>'monto')::numeric,
               moneda = coalesce(nullif(h->>'moneda',''), 'ARS'),
               casa_cotizacion = nullif(h->>'casa',''),
               cotizacion_pactada = nullif(h->>'cotizacion','')::numeric,
               vence_at = nullif(h->>'vence','')::date
         where id = v_hid and proyecto_id = p_proyecto and activo = false;
      end if;

      v_entregas := v_entregas || v_hid;
      v_total := v_total + (h->>'monto')::numeric;
    end loop;
  end loop;

  delete from hitos
   where proyecto_id = p_proyecto and activo = false and not (id = any(v_entregas));
  delete from etapas_cotizacion
   where proyecto_id = p_proyecto and not (id = any(v_etapas));

  update proyectos p
     set monto_neto = (select coalesce(sum(x.monto_neto), 0) from hitos x where x.proyecto_id = p.id)
   where p.id = p_proyecto;

  return v_total;
end;
$$;

grant execute on function guardar_cotizacion_por_etapas(uuid, jsonb) to authenticated;


-- Las entregas de una cotización, con su porcentaje calculado sobre la
-- etapa a la que pertenecen.
drop view if exists v_entregas_cotizadas;
create view v_entregas_cotizadas
with (security_invoker = true)
as
select
  h.id as hito_id, h.proyecto_id, h.etapa_id,
  e.nombre as etapa, e.orden as etapa_orden,
  h.orden, h.titulo, h.entregable,
  h.monto_neto, h.moneda, h.vence_at, h.es_anticipo, h.activo,
  h.casa_cotizacion, h.cotizacion_pactada,
  (select coalesce(sum(x.monto_neto), 0) from hitos x where x.etapa_id = h.etapa_id) as total_etapa,
  case when (select coalesce(sum(x.monto_neto), 0) from hitos x where x.etapa_id = h.etapa_id) > 0
       then round(h.monto_neto * 100
                  / (select sum(x.monto_neto) from hitos x where x.etapa_id = h.etapa_id), 1)
  end as porcentaje_de_la_etapa
from hitos h
join etapas_cotizacion e on e.id = h.etapa_id;

grant select on v_entregas_cotizadas to authenticated;
