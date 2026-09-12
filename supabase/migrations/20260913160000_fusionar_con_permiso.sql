-- ------------------------------------------------------------------
-- fusionar_clientes salió SECURITY DEFINER sin validar quién llama.
--
-- SECURITY DEFINER corre con los permisos del dueño de la función, así
-- que saltea la RLS entera: cualquiera con cuenta podía fusionar dos
-- clientes, y de paso mover a la vista de otro todo lo que colgaba del
-- que desaparece. Tiene que ser definer para poder tocar las trece
-- tablas de una, así que la validación va adentro.
--
-- Dirección y administración, no coordinación: fusionar borra una fila
-- y reescribe a quién pertenece el trabajo de años. No es una acción
-- del día a día.
-- ------------------------------------------------------------------

create or replace function fusionar_clientes(p_de uuid, p_hacia uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_nombre text;
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración pueden fusionar clientes.';
  end if;

  if p_de = p_hacia then
    raise exception 'Es el mismo cliente.';
  end if;

  if not exists (select 1 from organizaciones where id = p_de)
     or not exists (select 1 from organizaciones where id = p_hacia) then
    raise exception 'Alguno de los dos clientes ya no existe.';
  end if;

  select nombre_canonico into v_nombre from organizaciones where id = p_de;

  -- Todo lo que apunta al que se va, pasa a apuntar al que queda.
  for r in
    select tc.table_name as tabla, k.column_name as col
    from information_schema.table_constraints tc
    join information_schema.key_column_usage k
      on k.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage c
      on c.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and c.table_name = 'organizaciones'
      and c.column_name = 'id'
      and tc.table_schema = 'public'
  loop
    execute format('update public.%I set %I = $1 where %I = $2', r.tabla, r.col, r.col)
      using p_hacia, p_de;
  end loop;

  -- El nombre viejo sobrevive como alias, para que no se vuelva a crear.
  update organizaciones
     set alias = (
       select array_agg(distinct a)
       from unnest(coalesce(alias, '{}') || array[v_nombre]) a
       where a is not null and a <> nombre_canonico
     )
   where id = p_hacia;

  delete from organizaciones where id = p_de;
end;
$$;

revoke execute on function fusionar_clientes(uuid, uuid) from public;
grant execute on function fusionar_clientes(uuid, uuid) to authenticated;
