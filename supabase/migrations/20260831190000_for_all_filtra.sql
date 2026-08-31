-- ============================================================
-- Las políticas `for all` estaban abriendo la lectura por la ventana.
--
-- En Postgres, `for all` incluye SELECT, y las políticas se combinan con
-- OR. Así que cada política de escritura estaba actuando además como una
-- segunda política de lectura, y donde escribir era más permisivo que
-- leer, ganaba la de escribir.
--
-- El caso concreto: gastos se leía con `ve_economia_de` (estricto), pero
-- `gastos_escritura` incluía al project manager. Resultado: Germán veía
-- los costos del proyecto, que es exactamente lo que no tiene que ver,
-- porque un desarrollador a monto fijo entra ahí como gasto.
--
-- Se reemplaza cada `for all` por insert, update y delete explícitos.
-- Ninguna política de escritura vuelve a decidir quién lee.
-- ============================================================

do $$
declare
  t text;
  nombre text;
  expr text;
begin
  for t, nombre, expr in
    select * from (values
      ('personas',        'personas_escritura',        'es_direccion() or es_admin()'),
      ('organizaciones',  'organizaciones_escritura',  've_todo()'),
      ('contactos',       'contactos_escritura',       've_todo()'),
      ('contratos',       'contratos_escritura',       'es_direccion() or es_pm()'),
      ('proyectos',       'proyectos_escritura',       've_todo()'),
      ('asignaciones',    'asignaciones_escritura',    've_todo()'),
      ('participaciones', 'participaciones_escritura', 'es_direccion()'),
      ('hitos',           'hitos_escritura',           've_todo()'),
      ('gastos',          'gastos_escritura',          'es_direccion() or es_admin() or es_pm()'),
      ('impuestos',       'impuestos_escritura',       'es_direccion() or es_admin()'),
      ('porciones',       'porciones_escritura',       'es_direccion() or es_admin()'),
      ('liquidaciones',   'liquidaciones_escritura',   'es_direccion() or es_admin()'),
      ('cobros',          'cobros_escritura',          'es_direccion() or es_admin()'),
      ('documentos',      'documentos_escritura',      've_todo()')
    ) as v(tabla, pol, cond)
  loop
    execute format('drop policy if exists %I on %I', nombre, t);
    execute format(
      'create policy %I on %I for insert to authenticated with check (%s)',
      nombre || '_alta', t, expr);
    execute format(
      'create policy %I on %I for update to authenticated using (%s) with check (%s)',
      nombre || '_cambio', t, expr, expr);
    execute format(
      'create policy %I on %I for delete to authenticated using (%s)',
      nombre || '_baja', t, expr);
  end loop;
end $$;

-- La misma trampa en cotizaciones.
drop policy if exists cotizaciones_escritura on cotizaciones;
create policy cotizaciones_alta on cotizaciones for insert to authenticated
  with check (es_direccion() or es_admin());
create policy cotizaciones_cambio on cotizaciones for update to authenticated
  using (es_direccion() or es_admin()) with check (es_direccion() or es_admin());

-- La historia sigue sin poder borrarse.
revoke update, delete on actualizaciones, eventos from authenticated;
