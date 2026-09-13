-- El orden también tiene un check de positivo, así que sacar las filas
-- del camino en negativo tampoco va. Se corren hacia arriba, a un rango
-- donde no hay nada: una cotización de diez mil etapas no existe.
create or replace function guardar_etapas(p_proyecto uuid, p_etapas jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric := 0;
  v_ids   uuid[];
  r       jsonb;
  v_id    uuid;
begin
  if not (ve_todo() or participa_en(p_proyecto)) then
    raise exception 'No tenés permiso sobre esta oportunidad.';
  end if;
  if not puede_persona('cambiar_montos') then
    raise exception 'No tenés el permiso para cambiar montos.'
      using hint = 'Se activa en Sistema → Usuarios y roles.';
  end if;

  v_ids := array[]::uuid[];

  update hitos set orden = orden + 10000
   where proyecto_id = p_proyecto and activo = false;

  for r in select * from jsonb_array_elements(coalesce(p_etapas, '[]'::jsonb)) loop
    v_id := nullif(r->>'id', '')::uuid;

    if v_id is null then
      insert into hitos (proyecto_id, orden, titulo, entregable, monto_neto, moneda,
                         casa_cotizacion, cotizacion_pactada, vence_at, activo)
      values (p_proyecto, (r->>'orden')::int, r->>'titulo', nullif(r->>'entregable',''),
              (r->>'monto')::numeric, coalesce(nullif(r->>'moneda',''), 'ARS'),
              nullif(r->>'casa',''), nullif(r->>'cotizacion','')::numeric,
              nullif(r->>'vence','')::date, false)
      returning id into v_id;
    else
      update hitos
         set orden = (r->>'orden')::int,
             titulo = r->>'titulo',
             entregable = nullif(r->>'entregable',''),
             monto_neto = (r->>'monto')::numeric,
             moneda = coalesce(nullif(r->>'moneda',''), 'ARS'),
             casa_cotizacion = nullif(r->>'casa',''),
             cotizacion_pactada = nullif(r->>'cotizacion','')::numeric,
             vence_at = nullif(r->>'vence','')::date
       where id = v_id and proyecto_id = p_proyecto and activo = false;
    end if;

    v_ids := v_ids || v_id;
    v_total := v_total + (r->>'monto')::numeric;
  end loop;

  delete from hitos
   where proyecto_id = p_proyecto and activo = false and not (id = any(v_ids));

  update proyectos p
     set monto_neto = (select coalesce(sum(h.monto_neto), 0) from hitos h where h.proyecto_id = p.id)
   where p.id = p_proyecto;

  return v_total;
end;
$$;

grant execute on function guardar_etapas(uuid, jsonb) to authenticated;
