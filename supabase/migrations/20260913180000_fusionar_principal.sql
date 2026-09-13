-- ------------------------------------------------------------------
-- La fusión chocaba contra "una sola principal por cliente".
--
-- razones_sociales y marcas tienen un índice único parcial: una sola
-- fila con es_principal por organización. Si los dos clientes que se
-- fusionan tienen su razón social principal —y los dos la tienen,
-- porque se cargaron por separado como clientes completos—, mover las
-- filas del que se va rompe el índice y la fusión aborta entera.
--
-- Se resuelve bajándole la marca a las que llegan, y solo si el que
-- queda ya tiene la suya: si no tuviera, la que llega es la única y
-- tiene que conservarla.
--
-- Las tablas no van escritas a mano: se buscan por tener la columna
-- es_principal y una clave foránea a organizaciones. Hoy son dos; el
-- día que aparezca una tercera, esto la va a incluir sin que nadie se
-- acuerde de venir a agregarla.
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
  v_tiene boolean;
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

  -- Primero, destrabar las marcas de "principal" que van a colisionar.
  for r in
    select c.table_name as tabla
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'es_principal'
      and exists (
        select 1
        from information_schema.table_constraints tc
        join information_schema.key_column_usage k
          on k.constraint_name = tc.constraint_name
        join information_schema.constraint_column_usage u
          on u.constraint_name = tc.constraint_name
        where tc.table_name = c.table_name
          and tc.constraint_type = 'FOREIGN KEY'
          and u.table_name = 'organizaciones'
          and k.column_name = 'organizacion_id'
      )
  loop
    execute format(
      'select exists (select 1 from public.%I where organizacion_id = $1 and es_principal)',
      r.tabla)
      into v_tiene using p_hacia;

    if v_tiene then
      execute format(
        'update public.%I set es_principal = false where organizacion_id = $1 and es_principal',
        r.tabla)
        using p_de;
    end if;
  end loop;

  -- Ahora sí: todo lo que apunta al que se va, pasa al que queda.
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
