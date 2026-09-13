-- ------------------------------------------------------------------
-- Una sola lista de estados, y poder borrar lo que sobra.
--
-- La pantalla de Etapas mostraba tres listas y dos de ellas decían casi
-- lo mismo. estados_proyecto es de antes de que existieran las columnas
-- del tablero y quedó ahí: no la lee nadie más que esa pantalla, así
-- que renombrar algo en esa lista no cambiaba absolutamente nada. Una
-- lista que se deja editar y no hace nada es peor que no tenerla,
-- porque uno cree que configuró algo.
--
-- Se va. Lo que manda son las columnas del tablero, que son las que el
-- tablero efectivamente lee.
-- ------------------------------------------------------------------

drop table if exists estados_proyecto;


-- ------------------------------------------------------------------
-- Borrar de verdad, no solo apagar.
--
-- Apagar servía para lo que ya se usó y no se puede tirar sin perder
-- historia. Pero una etapa que nunca tuvo un proyecto es ruido puro: se
-- borra.
-- ------------------------------------------------------------------

create or replace function borrar_etapa(p_clave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  if not es_direccion() then
    raise exception 'Solo dirección cambia las etapas.';
  end if;

  select count(*) into v_n from proyectos where etapa = p_clave;
  if v_n > 0 then
    raise exception 'No se puede borrar: hay % oportunidad(es) en esa etapa.', v_n
      using hint = 'Movelas a otra etapa, o apagala para que deje de ofrecerse sin perder la historia.';
  end if;

  delete from etapas where clave = p_clave;
end;
$$;

grant execute on function borrar_etapa(text) to authenticated;


-- ------------------------------------------------------------------
-- Borrar una columna del tablero.
--
-- La condición no es solo que esté vacía. Cada color necesita una
-- columna que se quede con lo que no encaja en ninguna otra —la que no
-- define detalle—, porque si no, un proyecto de ese color con un motivo
-- no contemplado no tiene dónde ir y desaparece del tablero sin que
-- nadie se entere.
--
-- Así que borrar la última columna sin detalle de un color solo se
-- permite si no queda ningún proyecto de ese color. Si quedan, hay que
-- dejarles dónde caer.
-- ------------------------------------------------------------------

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

  -- ¿Hay algo cayendo hoy en esta columna?
  select count(*) into v_n
    from proyectos p
   where p.tipo = 'proyecto' and (p.etapa is null or p.etapa = 'ganado')
     and p.archivado_at is null and p.color::text = v_col.color::text
     and (case
            when v_col.detalle is not null then
              v_col.detalle = case v_col.color::text
                                when 'verde' then p.subestado::text
                                when 'gris'  then p.motivo_gris::text
                                else p.motivo_rojo::text end
            else true
          end);

  if v_n > 0 then
    raise exception 'No se puede borrar: hay % proyecto(s) en esa columna.', v_n
      using hint = 'Movelos a otra columna primero.';
  end if;

  -- Si es la única sin detalle de su color, ¿queda alguien sin dónde caer?
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


-- La cotización vieja: apagada y sin una sola oportunidad. Ruido.
delete from etapas where clave = 'cotizacion'
  and not exists (select 1 from proyectos where etapa = 'cotizacion');
