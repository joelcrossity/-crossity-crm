-- ------------------------------------------------------------------
-- Quien da de alta un cliente tiene que poder verlo.
--
-- Abrí la escritura con cliente_mio —que incluye al que lo creó— y dejé
-- la lectura como estaba: solo se ve un cliente si participás en algún
-- proyecto suyo. Un cliente recién creado no tiene proyectos, así que
-- el vendedor lo cargaba y desaparecía.
--
-- Y de arrastre no podía ni editarlo, por una razón que no se ve a
-- simple vista: un UPDATE con WHERE tiene que leer las filas para
-- encontrarlas, y esa lectura pasa por la política de lectura. Sin
-- poder verlo, tampoco se lo puede modificar aunque la regla de
-- escritura lo permita.
--
-- La regla pasa a ser una sola, cliente_mio, para leer y para escribir.
-- Dos versiones de la misma idea es lo que causó esto: abrí una y me
-- olvidé de la otra.
-- ------------------------------------------------------------------

drop policy if exists organizaciones_lectura on organizaciones;
create policy organizaciones_lectura on organizaciones
  for select to authenticated using (cliente_mio(id));

do $$
declare t text;
begin
  foreach t in array array['razones_sociales','marcas','contactos'] loop
    execute format('drop policy if exists %I on %I', t||'_lectura', t);
    execute format($f$create policy %I on %I for select to authenticated
                      using (cliente_mio(organizacion_id))$f$, t||'_lectura', t);
  end loop;
end $$;

-- Los nombres viejos de las políticas de lectura, por si quedaron.
drop policy if exists razones_lectura on razones_sociales;
drop policy if exists marcas_lectura on marcas;
