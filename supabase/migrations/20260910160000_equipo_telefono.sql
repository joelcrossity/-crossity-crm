-- El teléfono faltaba en la vista del equipo y la ficha lo edita.
drop view if exists v_equipo;

create view v_equipo
with (security_invoker = true)
as
select
  p.id, p.nombre, p.email, p.telefono, p.roles, p.es_externa, p.activa,
  (u.id is not null) as tiene_cuenta,
  (select count(*) from asignaciones a
    where a.persona_id = p.id and a.hasta is null) as en_equipos,
  (select count(*) from participaciones pa where pa.persona_id = p.id) as participa_en,
  (select count(*) from permisos_proyecto pp where pp.persona_id = p.id) as permisos_dados
from personas p
left join usuarios u on u.persona_id = p.id;

grant select on v_equipo to authenticated;
