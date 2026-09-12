-- ============================================================
-- Dar de baja a una persona.
--
-- "Eliminar un usuario" son en realidad dos cosas distintas, y
-- confundirlas es cómo se pierde historia sin querer:
--
--   quitarle el acceso  → deja de poder entrar. Su nombre sigue en los
--                         proyectos donde participó y su plata sigue
--                         donde estaba. Es lo que se necesita el 95 %
--                         de las veces: alguien dejó el equipo.
--
--   borrarla            → desaparece del sistema. Solo tiene sentido si
--                         nunca hizo nada: una carga de prueba, un
--                         nombre mal escrito, un duplicado.
--
-- La base ya impide lo peligroso: participaciones y usuarios apuntan a
-- personas con `on delete restrict`, así que alguien con plata en el
-- historial no se puede borrar ni por error. Esto solo lo dice en
-- castellano en vez de devolver un error de clave foránea.
-- ============================================================

create or replace function puede_borrarse(p_persona uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_part integer;
  v_porc integer;
  v_asig integer;
begin
  select count(*) into v_part from participaciones where persona_id = p_persona;
  if v_part > 0 then
    return 'Participa en ' || v_part || ' proyecto' || case when v_part > 1 then 's' else '' end ||
           '. Eso es plata repartida y no se borra: quitale el acceso y dejala inactiva.';
  end if;

  select count(*) into v_porc
    from porciones po
    join participaciones pa on pa.id = po.participacion_id
   where pa.persona_id = p_persona;
  if v_porc > 0 then
    return 'Tiene liquidaciones en su historial. Eso no se borra.';
  end if;

  select count(*) into v_asig from asignaciones where persona_id = p_persona and hasta is null;
  if v_asig > 0 then
    return 'Está en ' || v_asig || ' equipo' || case when v_asig > 1 then 's' else '' end ||
           '. Sacala de ahí primero, o simplemente quitale el acceso.';
  end if;

  return null;
end;
$$;

create or replace function borrar_persona(p_persona uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_motivo text;
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración dan de baja personas';
  end if;

  if p_persona = persona_actual() then
    raise exception 'No podés borrarte a vos mismo';
  end if;

  if exists (select 1 from usuarios where persona_id = p_persona) then
    raise exception 'Todavía tiene cuenta. Quitale el acceso primero';
  end if;

  select puede_borrarse(p_persona) into v_motivo;
  if v_motivo is not null then
    raise exception '%', v_motivo;
  end if;

  delete from personas where id = p_persona;
end;
$$;

-- Soltar el vínculo entre la cuenta y la persona. La cuenta de Supabase
-- la borra la acción del servidor, que es la única que puede.
create or replace function soltar_usuario(p_persona uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración quitan accesos';
  end if;

  if p_persona = persona_actual() then
    raise exception 'No podés quitarte el acceso a vos mismo';
  end if;

  select id into v_id from usuarios where persona_id = p_persona;
  if v_id is null then
    raise exception 'Esa persona no tiene cuenta';
  end if;

  delete from usuarios where persona_id = p_persona;
  update personas set activa = false where id = p_persona;

  return v_id;
end;
$$;

grant execute on function puede_borrarse(uuid) to authenticated;
grant execute on function borrar_persona(uuid) to authenticated;
grant execute on function soltar_usuario(uuid) to authenticated;

comment on function soltar_usuario is
  'Deja de poder entrar y queda inactiva, pero su nombre sigue en los proyectos donde participó. Es lo que se necesita cuando alguien deja el equipo.';
