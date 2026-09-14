-- ------------------------------------------------------------------
-- Agregar una etapa a un pipeline que ya tenía entregas reventaba.
--
-- El orden de un hito es único por proyecto. Al guardar la propuesta yo
-- sacaba del camino solo los inactivos, porque asumí que una
-- oportunidad todavía no cotizada no tenía entregas. No es cierto: hay
-- oportunidades con entregas ya generadas y activas —C-0037-01 tiene
-- dos, en los órdenes 1 y 2— y la primera etapa nueva pedía el orden 1.
-- Chocaba, y el error que salía era el del índice, que no explica nada.
--
-- Se arregla calculando desde dónde numerar: por encima del último
-- orden que hay entre los hitos que esta función no toca. Los que sí
-- toca se corren fuera del camino antes, como ya se hacía.
--
-- Numerar desde un lugar seguro en vez de asumir que el lugar está
-- libre: el supuesto se rompe en cuanto aparece un dato que no se
-- previó, y siempre aparece.
-- ------------------------------------------------------------------

create or replace function guardar_propuesta(p_proyecto uuid, p_etapas jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total    numeric := 0;
  v_etapas   uuid[] := array[]::uuid[];
  v_comps    uuid[] := array[]::uuid[];
  v_cuotas   uuid[] := array[]::uuid[];
  e jsonb; c jsonb; h jsonb;
  v_eid uuid; v_cid uuid; v_hid uuid;
  v_orden integer := 0; v_sub integer;
  v_base integer;
begin
  if not (ve_todo() or participa_en(p_proyecto)) then
    raise exception 'No tenés permiso sobre esta oportunidad.';
  end if;
  if not puede_persona('cambiar_montos') then
    raise exception 'No tenés el permiso para cambiar montos.'
      using hint = 'Se activa en Sistema → Usuarios y roles.';
  end if;

  -- Desde dónde numerar: arriba de todo lo que esta función no mueve,
  -- que son las entregas activas que no pertenecen a ninguna etapa.
  select coalesce(max(orden), 0) into v_base
    from hitos
   where proyecto_id = p_proyecto and activo and etapa_id is null;

  -- Lo que sí se mueve, fuera del camino.
  update etapas_cotizacion set orden = orden + 100000 where proyecto_id = p_proyecto;
  update hitos set orden = orden + 100000
   where proyecto_id = p_proyecto and (activo = false or etapa_id is not null);
  update componentes set orden = orden + 100000
   where etapa_id in (select id from etapas_cotizacion where proyecto_id = p_proyecto);

  for e in select * from jsonb_array_elements(coalesce(p_etapas, '[]'::jsonb)) loop
    v_orden := v_orden + 1;
    v_eid := nullif(e->>'id', '')::uuid;

    if v_eid is null then
      insert into etapas_cotizacion (proyecto_id, orden, nombre, alcance)
      values (p_proyecto, v_orden, e->>'nombre', nullif(e->>'alcance',''))
      returning id into v_eid;
    else
      update etapas_cotizacion set orden = v_orden, nombre = e->>'nombre',
             alcance = nullif(e->>'alcance','')
       where id = v_eid and proyecto_id = p_proyecto;
    end if;
    v_etapas := v_etapas || v_eid;

    v_sub := 0;
    for c in select * from jsonb_array_elements(coalesce(e->'componentes', '[]'::jsonb)) loop
      v_sub := v_sub + 1;
      v_cid := nullif(c->>'id', '')::uuid;

      if v_cid is null then
        insert into componentes (etapa_id, orden, nombre, detalle, estado, monto, moneda)
        values (v_eid, v_sub, c->>'nombre', nullif(c->>'detalle',''),
                coalesce(nullif(c->>'estado',''), 'cotizado'),
                nullif(c->>'monto','')::numeric,
                coalesce(nullif(c->>'moneda',''), 'USD'))
        returning id into v_cid;
      else
        update componentes set orden = v_sub, nombre = c->>'nombre',
               detalle = nullif(c->>'detalle',''),
               estado = coalesce(nullif(c->>'estado',''), 'cotizado'),
               monto = nullif(c->>'monto','')::numeric,
               moneda = coalesce(nullif(c->>'moneda',''), 'USD')
         where id = v_cid and etapa_id = v_eid;
      end if;
      v_comps := v_comps || v_cid;

      if coalesce(c->>'estado', 'cotizado') = 'cotizado' then
        v_total := v_total + coalesce((c->>'monto')::numeric, 0);
      end if;
    end loop;

    v_sub := 0;
    for h in select * from jsonb_array_elements(coalesce(e->'cuotas', '[]'::jsonb)) loop
      v_sub := v_sub + 1;
      v_hid := nullif(h->>'id', '')::uuid;

      if v_hid is null then
        insert into hitos (proyecto_id, etapa_id, orden, titulo, entregable,
                           monto_neto, moneda, casa_cotizacion, cotizacion_pactada,
                           vence_at, es_anticipo, activo)
        values (p_proyecto, v_eid, v_base + v_orden * 100 + v_sub,
                h->>'titulo', nullif(h->>'entregable',''),
                (h->>'monto')::numeric,
                coalesce(nullif(h->>'moneda',''), 'USD'),
                nullif(h->>'casa',''), nullif(h->>'cotizacion','')::numeric,
                nullif(h->>'vence','')::date,
                coalesce((h->>'es_anticipo')::boolean, v_sub = 1), false)
        returning id into v_hid;
      else
        update hitos set etapa_id = v_eid, orden = v_base + v_orden * 100 + v_sub,
               titulo = h->>'titulo', entregable = nullif(h->>'entregable',''),
               porcentaje = null,
               monto_neto = (h->>'monto')::numeric,
               moneda = coalesce(nullif(h->>'moneda',''), 'USD'),
               casa_cotizacion = nullif(h->>'casa',''),
               cotizacion_pactada = nullif(h->>'cotizacion','')::numeric,
               vence_at = nullif(h->>'vence','')::date
         where id = v_hid and proyecto_id = p_proyecto;
      end if;
      v_cuotas := v_cuotas || v_hid;
    end loop;
  end loop;

  delete from hitos
   where proyecto_id = p_proyecto and activo = false and not (id = any(v_cuotas));
  delete from componentes
   where etapa_id in (select id from etapas_cotizacion where proyecto_id = p_proyecto)
     and not (id = any(v_comps));
  delete from etapas_cotizacion where proyecto_id = p_proyecto and not (id = any(v_etapas));

  update proyectos set monto_neto = v_total where id = p_proyecto;
  return v_total;
end;
$$;

grant execute on function guardar_propuesta(uuid, jsonb) to authenticated;

-- La versión plana anterior ya no la llama nadie y arrastraba el mismo
-- supuesto. Se va para que no la use alguien sin saberlo.
drop function if exists guardar_etapas(uuid, jsonb);
drop function if exists guardar_cotizacion_por_etapas(uuid, jsonb);
