-- ============================================================
-- El interruptor de entrada, que existía y nunca se mostró.
--
-- Hay dos banderas y hacen cosas distintas:
--
--   personas.activa  → si aparece en las listas del sistema. Alguien
--                      que dejó el equipo deja de ofrecerse para
--                      asignar, pero su historia sigue donde estaba.
--
--   usuarios.activo  → si puede entrar. persona_actual() ya la mira,
--                      así que apagarla deja a esa cuenta sin ver nada,
--                      sin borrar nada y sin tocar su contraseña.
--
-- La segunda estaba desde el primer día y no había forma de tocarla.
-- Es exactamente el control que hace falta cuando alguien se va un mes
-- o cuando hay una duda: se apaga, y se vuelve a prender.
-- ============================================================

create or replace function cambiar_acceso(p_persona uuid, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración manejan los accesos';
  end if;

  if p_persona = persona_actual() and not p_activo then
    raise exception 'No podés apagarte el acceso a vos mismo';
  end if;

  update usuarios set activo = p_activo where persona_id = p_persona;

  if not found then
    raise exception 'Esa persona no tiene cuenta todavía';
  end if;
end;
$$;

grant execute on function cambiar_acceso(uuid, boolean) to authenticated;

comment on function cambiar_acceso is
  'Apagar el acceso no borra nada ni toca la contraseña: la cuenta sigue ahí y vuelve a andar cuando se prende.';

-- La vista del equipo tenía si TIENE cuenta, no si PUEDE entrar, que
-- es la pregunta que se hace en la pantalla.
drop view if exists v_equipo;

create view v_equipo
with (security_invoker = true)
as
select
  p.id, p.nombre, p.email, p.telefono, p.roles, p.es_externa, p.activa,
  (u.id is not null)              as tiene_cuenta,
  coalesce(u.activo, false)       as puede_entrar,
  (select count(*) from asignaciones a
    where a.persona_id = p.id and a.hasta is null) as en_equipos,
  (select count(*) from participaciones pa where pa.persona_id = p.id) as participa_en,
  (select count(*) from permisos_proyecto pp where pp.persona_id = p.id) as permisos_dados
from personas p
left join usuarios u on u.persona_id = p.id;

grant select on v_equipo to authenticated;
