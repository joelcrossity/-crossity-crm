-- ------------------------------------------------------------------
-- El trigger de montos solo controla a personas.
--
-- Tal como salió, frenaba también a lo que corre sin sesión: una
-- migración que toque monto_neto, o el service role. Ahí no hay persona
-- a la que pedirle un permiso —puede_persona() no tiene a quién
-- resolver y devuelve falso—, así que el resultado era bloquear
-- operaciones legítimas de mantenimiento de la base.
--
-- Sin sesión no se controla nada, y no abre ninguna puerta: sin JWT no
-- se llega por PostgREST como usuario, y la RLS tampoco se aplica en
-- ese contexto. El control existe para las personas, que son las que
-- entran por la aplicación.
-- ------------------------------------------------------------------

create or replace function exige_cambiar_montos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if puede_persona('cambiar_montos') then
    return new;
  end if;

  if tg_table_name = 'hitos' then
    if new.monto_neto is distinct from old.monto_neto then
      raise exception 'No tenés el permiso para cambiar montos.'
        using hint = 'Se activa en Sistema → Usuarios y roles.';
    end if;
  elsif tg_table_name = 'proyectos' then
    if new.monto_neto      is distinct from old.monto_neto
    or new.monto_mensual   is distinct from old.monto_mensual
    or new.precio_unitario is distinct from old.precio_unitario then
      raise exception 'No tenés el permiso para cambiar montos.'
        using hint = 'Se activa en Sistema → Usuarios y roles.';
    end if;
  end if;

  return new;
end;
$$;
