-- ------------------------------------------------------------------
-- La política de proyectos volvía a leer proyectos, y eso rompía el
-- alta de quien no ve todo.
--
-- proyectos_lectura decía ve_todo() or participa_en(id), y participa_en
-- consulta proyectos para ver si esa persona es el responsable. O sea:
-- para decidir si se puede leer una fila, volvía a leer la misma tabla.
--
-- Con un proyecto que ya existe no se nota. Con uno que se está
-- insertando, sí: participa_en es estable, así que trabaja sobre la
-- foto del inicio de la sentencia, donde la fila nueva todavía no está.
-- Devolvía falso, el INSERT ... RETURNING no podía leer lo que acababa
-- de escribir, y el alta terminaba en un error de permisos aunque el
-- permiso estuviera bien. El síntoma no se parecía en nada a la causa.
--
-- Ahora la regla mira las columnas de la fila que está evaluando, sin
-- volver a buscarla. Es la misma condición dicha de otra forma, y de
-- paso es más rápida: se ahorra una consulta a proyectos por cada fila
-- que se filtra.
--
-- participa_en se queda para las otras tablas, donde el proyecto es
-- otra fila y no la que se está mirando.
-- ------------------------------------------------------------------

drop policy if exists proyectos_lectura on proyectos;
create policy proyectos_lectura on proyectos
  for select to authenticated
  using (
    ve_todo()
    or responsable_id = persona_actual()
    or exists (select 1 from asignaciones a
                where a.proyecto_id = proyectos.id
                  and a.persona_id = persona_actual()
                  and a.hasta is null)
    or exists (select 1 from participaciones pa
                where pa.proyecto_id = proyectos.id
                  and pa.persona_id = persona_actual())
  );

drop policy if exists proyectos_escritura_cambio on proyectos;
create policy proyectos_escritura_cambio on proyectos
  for update to authenticated
  using (
    ve_todo()
    or responsable_id = persona_actual()
    or exists (select 1 from asignaciones a
                where a.proyecto_id = proyectos.id
                  and a.persona_id = persona_actual()
                  and a.hasta is null)
    or exists (select 1 from participaciones pa
                where pa.proyecto_id = proyectos.id
                  and pa.persona_id = persona_actual())
  )
  with check (
    ve_todo()
    or responsable_id = persona_actual()
    or exists (select 1 from asignaciones a
                where a.proyecto_id = proyectos.id
                  and a.persona_id = persona_actual()
                  and a.hasta is null)
    or exists (select 1 from participaciones pa
                where pa.proyecto_id = proyectos.id
                  and pa.persona_id = persona_actual())
  );
