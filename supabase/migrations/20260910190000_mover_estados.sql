-- Mover los estados de proyecto, como se mueven las etapas.
--
-- El orden de las columnas del tablero es una decisión de cómo se mira
-- el trabajo, no una constante: hay meses en que lo primero que querés
-- ver es lo frenado y no lo que está en curso. Eso se cambia; lo que
-- sigue sin cambiarse es el comportamiento de cada color.

create or replace function mover_estado(p_color color_estado, p_hacia integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden  integer;
  v_vecino color_estado;
  v_otro   integer;
begin
  if not es_direccion() then
    raise exception 'Solo dirección cambia el orden';
  end if;

  select orden into v_orden from estados_proyecto where color = p_color;
  if v_orden is null then return; end if;

  if p_hacia < 0 then
    select color, orden into v_vecino, v_otro from estados_proyecto
     where orden < v_orden order by orden desc limit 1;
  else
    select color, orden into v_vecino, v_otro from estados_proyecto
     where orden > v_orden order by orden asc limit 1;
  end if;

  if v_vecino is null then return; end if;

  update estados_proyecto set orden = v_otro   where color = p_color;
  update estados_proyecto set orden = v_orden  where color = v_vecino;
end;
$$;

grant execute on function mover_estado(color_estado, integer) to authenticated;
