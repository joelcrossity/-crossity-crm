-- ------------------------------------------------------------------
-- Borrar una columna diciendo quién se queda con lo suyo.
--
-- "Frenado" está vacía pero es la única gris que recoge lo que no
-- encaja en las demás de su color. Borrarla sin más dejaría a cualquier
-- proyecto gris con un motivo no contemplado sin dónde caer, y
-- desaparecería del tablero sin aviso.
--
-- La salida no es adivinar: es preguntarlo. Al borrar se puede indicar
-- qué otra columna del mismo color pasa a recoger los sobrantes, y esa
-- columna deja de exigir su detalle. Para el caso de Frenado: Comenzar
-- se queda con todo lo gris, que es lo correcto si en esta agencia un
-- proyecto gris siempre está esperando el anticipo.
--
-- Sigue poniendo esperando_anticipo al soltar ahí, porque eso es lo que
-- significa arrastrar algo a "Comenzar". Lo que cambia es a quién
-- recoge, no qué hace.
-- ------------------------------------------------------------------

create or replace function borrar_columna(p_clave text, p_absorbe text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col   columnas_tablero%rowtype;
  v_otra  columnas_tablero%rowtype;
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
        if p_absorbe is null then
          raise exception
            'Es la única columna que recoge lo que no encaja en las demás de su color, y hay % proyecto(s) de ese color.', v_n
            using hint = 'Elegí qué columna se queda con eso al borrarla.';
        end if;

        select * into v_otra from columnas_tablero
         where clave = p_absorbe and color = v_col.color and clave <> p_clave;
        if not found then
          raise exception 'Esa columna no existe o no es del mismo color.';
        end if;

        -- La que absorbe deja de exigir su detalle: pasa a recoger todo
        -- lo del color que no caiga en otra.
        update columnas_tablero set detalle = null where clave = p_absorbe;
      end if;
    end if;
  end if;

  delete from columnas_tablero where clave = p_clave;
end;
$$;

drop function if exists borrar_columna(text);
grant execute on function borrar_columna(text, text) to authenticated;
