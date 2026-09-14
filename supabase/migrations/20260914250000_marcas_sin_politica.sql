-- La limpieza del final borró la política de lectura de marcas que la
-- misma migración había creado dos líneas antes: el bucle la llamó
-- marcas_lectura y después el drop de los nombres viejos tenía
-- exactamente ese nombre. Marcas quedó sin ninguna política de lectura,
-- o sea invisible para todos.
--
-- Sin política de lectura una tabla con RLS no muestra nada. No da
-- error: devuelve cero filas, que es peor, porque parece que no hay
-- marcas cargadas.
create policy marcas_lectura on marcas
  for select to authenticated using (cliente_mio(organizacion_id));
