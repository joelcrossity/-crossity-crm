-- ------------------------------------------------------------------
-- Otra política que releía su propia tabla. La misma trampa, dos veces.
--
-- organizaciones_lectura usa cliente_mio(id), y cliente_mio consulta
-- organizaciones para ver si vos la creaste. Para decidir si podés leer
-- una fila, vuelve a buscar esa fila. Con una que ya existe funciona;
-- con una que se está insertando no, porque la función es estable y
-- trabaja sobre la foto del inicio de la sentencia. El INSERT ...
-- RETURNING no puede leer lo que acaba de escribir y falla con un error
-- de permisos, con el permiso bien puesto.
--
-- Es exactamente lo que pasó con proyectos hace unas horas. La regla,
-- para no repetirlo una tercera vez: una política sobre una tabla no
-- puede depender de leer esa misma tabla. Los campos de la fila que se
-- está evaluando están ahí, se miran directo.
--
-- cliente_mio se queda para las otras tablas, donde consulta
-- organizaciones y organizaciones no es la tabla que se está filtrando.
-- ------------------------------------------------------------------

drop policy if exists organizaciones_lectura on organizaciones;
create policy organizaciones_lectura on organizaciones
  for select to authenticated
  using (
    ve_todo()
    or creada_por = persona_actual()
    or exists (
      select 1 from proyectos p
       where p.organizacion_id = organizaciones.id
         and (p.responsable_id = persona_actual()
           or exists (select 1 from asignaciones a
                       where a.proyecto_id = p.id and a.persona_id = persona_actual()
                         and a.hasta is null)
           or exists (select 1 from participaciones pa
                       where pa.proyecto_id = p.id and pa.persona_id = persona_actual())))
  );

drop policy if exists organizaciones_escritura_cambio on organizaciones;
create policy organizaciones_escritura_cambio on organizaciones
  for update to authenticated
  using (
    puede_persona('editar_clientes') and (
      ve_todo()
      or creada_por = persona_actual()
      or exists (
        select 1 from proyectos p
         where p.organizacion_id = organizaciones.id
           and (p.responsable_id = persona_actual()
             or exists (select 1 from asignaciones a
                         where a.proyecto_id = p.id and a.persona_id = persona_actual()
                           and a.hasta is null)
             or exists (select 1 from participaciones pa
                         where pa.proyecto_id = p.id and pa.persona_id = persona_actual()))))
  )
  with check (
    puede_persona('editar_clientes') and (
      ve_todo()
      or creada_por = persona_actual()
      or exists (
        select 1 from proyectos p
         where p.organizacion_id = organizaciones.id
           and (p.responsable_id = persona_actual()
             or exists (select 1 from asignaciones a
                         where a.proyecto_id = p.id and a.persona_id = persona_actual()
                           and a.hasta is null)
             or exists (select 1 from participaciones pa
                         where pa.proyecto_id = p.id and pa.persona_id = persona_actual()))))
  );
