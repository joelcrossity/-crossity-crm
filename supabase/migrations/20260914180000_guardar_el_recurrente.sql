-- Agregué la columna recurrente y me olvidé de leerla al guardar, así
-- que el abono cotizado entraba como un pago de una sola vez: sumaba al
-- total del proyecto y descuadraba las cuotas. Los dos síntomas venían
-- de lo mismo.
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
  v_rec boolean;
begin
  if not (ve_todo() or participa_en(p_proyecto)) then
    raise exception 'No tenés permiso sobre esta oportunidad.';
  end if;
  if not puede_persona('cambiar_montos') then
    raise exception 'No tenés el permiso para cambiar montos.'
      using hint = 'Se activa en Sistema → Usuarios y roles.';
  end if;

  select coalesce(max(orden), 0) into v_base
    from hitos where proyecto_id = p_proyecto and activo and etapa_id is null;

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
      v_rec := coalesce((c->>'recurrente')::boolean, false);

      if v_cid is null then
        insert into componentes (etapa_id, orden, nombre, detalle, estado, monto, moneda, recurrente)
        values (v_eid, v_sub, c->>'nombre', nullif(c->>'detalle',''),
                coalesce(nullif(c->>'estado',''), 'cotizado'),
                nullif(c->>'monto','')::numeric,
                coalesce(nullif(c->>'moneda',''), 'USD'), v_rec)
        returning id into v_cid;
      else
        update componentes set orden = v_sub, nombre = c->>'nombre',
               detalle = nullif(c->>'detalle',''),
               estado = coalesce(nullif(c->>'estado',''), 'cotizado'),
               monto = nullif(c->>'monto','')::numeric,
               moneda = coalesce(nullif(c->>'moneda',''), 'USD'),
               recurrente = v_rec
         where id = v_cid and etapa_id = v_eid;
      end if;
      v_comps := v_comps || v_cid;

      -- Lo recurrente no suma al total: es otra plata.
      if coalesce(c->>'estado', 'cotizado') = 'cotizado' and not v_rec then
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

  delete from hitos where proyecto_id = p_proyecto and activo = false
     and not (id = any(v_cuotas));
  delete from componentes
   where etapa_id in (select id from etapas_cotizacion where proyecto_id = p_proyecto)
     and not (id = any(v_comps));
  delete from etapas_cotizacion where proyecto_id = p_proyecto and not (id = any(v_etapas));

  update proyectos set monto_neto = v_total where id = p_proyecto;
  return v_total;
end;
$$;

grant execute on function guardar_propuesta(uuid, jsonb) to authenticated;
