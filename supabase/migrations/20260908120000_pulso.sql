-- Días sin novedades para cualquier proyecto, también los mantenimientos.
-- v_tablero ya lo calcula pero filtra por tipo, así que la ficha del abono
-- se quedaba sin el dato. Y el cálculo va en la base y no en el render:
-- una fecha calculada en el servidor de la aplicación cambia entre el
-- renderizado y la hidratación.
create or replace view v_pulso
with (security_invoker = true)
as
select
  p.id,
  extract(day from now() - coalesce(
    (select max(a.ocurrido_at) from actualizaciones a where a.proyecto_id = p.id),
    p.created_at
  ))::int as dias_sin_novedades
from proyectos p;

grant select on v_pulso to authenticated;
