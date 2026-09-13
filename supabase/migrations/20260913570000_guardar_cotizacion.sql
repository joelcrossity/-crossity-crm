-- ------------------------------------------------------------------
-- Guardar la cotización por etapas, entera y de una vez.
--
-- Se llama guardar_etapas y no guardar_cotizacion porque ese nombre ya
-- lo tiene la que guarda el dólar del día. Dos cosas distintas que en
-- castellano se dicen igual: la cotización de una moneda y la de un
-- trabajo.
--
-- Las etapas se editan juntas —se agrega una, se corrige un monto, se
-- borra otra— y guardarlas de a una dejaría estados intermedios donde
-- el total no es el que nadie acordó. Va todo en una sola operación.
--
-- Lo que ya arrancó no se toca. Una etapa activa puede tener porciones
-- repartidas, plata facturada o cobrada; borrarla o cambiarle el monto
-- desde el cotizador rompería cuentas que ya existen. La cotización
-- edita lo que todavía es propuesta.
-- ------------------------------------------------------------------

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

  for r in select * from jsonb_array_elements(coalesce(p_etapas, '[]'::jsonb)) loop
    v_id := nullif(r->>'id', '')::uuid;

    if v_id is null then
      insert into hitos (proyecto_id, orden, titulo, entregable, monto_neto, moneda,
                         casa_cotizacion, cotizacion_pactada, vence_at, activo)
      values (p_proyecto,
              (r->>'orden')::int,
              r->>'titulo',
              nullif(r->>'entregable',''),
              (r->>'monto')::numeric,
              coalesce(nullif(r->>'moneda',''), 'ARS'),
              nullif(r->>'casa',''),
              nullif(r->>'cotizacion','')::numeric,
              nullif(r->>'vence','')::date,
              false)
      returning id into v_id;
    else
      -- Solo lo que sigue siendo propuesta.
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

  -- Las que se sacaron de la lista: se borran solo si nunca arrancaron.
  delete from hitos
   where proyecto_id = p_proyecto and activo = false and not (id = any(v_ids));

  -- El monto de la oportunidad es la suma de lo cotizado. Escribirlo a
  -- mano al lado de las etapas sería tener dos números que se separan.
  update proyectos set monto_neto = v_total where id = p_proyecto;

  return v_total;
end;
$$;

grant execute on function guardar_etapas(uuid, jsonb) to authenticated;

comment on function guardar_etapas is
  'Reemplaza la cotización de una oportunidad. Solo toca etapas que todavía son propuesta: las activas ya tienen plata repartida y cuentas que dependen de ellas.';
