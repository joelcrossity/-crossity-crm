-- ------------------------------------------------------------------
-- La cuenta de qué cae en una columna estaba mal.
--
-- Para la columna sin detalle —la que recoge lo que no encaja en las
-- demás de su color— contaba todos los proyectos del color, no solo los
-- sobrantes. Con eso, "Frenado" figuraba con los dos grises que en
-- realidad están en "Comenzar", y no se podía borrar una columna vacía.
--
-- Es la misma regla que usa el tablero para dibujar. Ahora vive en una
-- función y la usan los dos, que era lo que había que hacer desde el
-- principio: dos versiones de la misma regla se separan solas.
-- ------------------------------------------------------------------

create or replace function cae_en_columna(p_proyecto uuid, p_clave text)
returns boolean
language sql stable
as $$
  select case
    when c.detalle is not null then
      c.detalle = case c.color::text
                    when 'verde' then p.subestado::text
                    when 'gris'  then p.motivo_gris::text
                    else p.motivo_rojo::text end
    else
      -- La que no define detalle se queda con lo que no cayó en
      -- ninguna de las que sí lo definen.
      not exists (
        select 1 from columnas_tablero o
         where o.color = c.color and o.detalle is not null
           and o.detalle = case c.color::text
                             when 'verde' then p.subestado::text
                             when 'gris'  then p.motivo_gris::text
                             else p.motivo_rojo::text end)
  end
  from proyectos p, columnas_tablero c
  where p.id = p_proyecto and c.clave = p_clave
    and p.color::text = c.color::text;
$$;

grant execute on function cae_en_columna(uuid, text) to authenticated;


create or replace function borrar_columna(p_clave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col   columnas_tablero%rowtype;
  v_n     integer;
  v_queda integer;
begin
  if not es_direccion() then
    raise exception 'Solo dirección cambia las columnas del tablero.';
  end if;

  select * into v_col from columnas_tablero where clave = p_clave;
  if not found then raise exception 'Esa columna no existe.'; end if;

  select count(*) into v_n
    from proyectos p
   where p.tipo = 'proyecto' and (p.etapa is null or p.etapa = 'ganado')
     and p.archivado_at is null
     and coalesce(cae_en_columna(p.id, p_clave), false);

  if v_n > 0 then
    raise exception 'No se puede borrar: hay % proyecto(s) en esa columna.', v_n
      using hint = 'Movelos a otra columna primero.';
  end if;

  -- Si es la única sin detalle de su color, hay que asegurarse de que
  -- nadie de ese color quede sin dónde caer más adelante.
  if v_col.detalle is null then
    select count(*) into v_queda
      from columnas_tablero
     where color = v_col.color and clave <> p_clave and detalle is null;

    if v_queda = 0 then
      select count(*) into v_n
        from proyectos p
       where p.tipo = 'proyecto' and (p.etapa is null or p.etapa = 'ganado')
         and p.archivado_at is null and p.color::text = v_col.color::text;

      if v_n > 0 then
        raise exception
          'Es la única columna que recoge lo que no encaja en las demás de su color, y hay % proyecto(s) de ese color.', v_n
          using hint = 'Sin ella, un proyecto con un motivo no contemplado desaparecería del tablero.';
      end if;
    end if;
  end if;

  delete from columnas_tablero where clave = p_clave;
end;
$$;

grant execute on function borrar_columna(text) to authenticated;
