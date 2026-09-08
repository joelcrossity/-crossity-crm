-- ============================================================
-- El grant de funciones se dio una sola vez, en agosto. Todo lo que se
-- creó después quedó dependiendo del EXECUTE que Postgres da a PUBLIC
-- por defecto, que es un permiso que conviene declarar y no heredar.
-- ============================================================

grant execute on all functions in schema public to authenticated;

alter default privileges in schema public
  grant execute on functions to authenticated;

-- Ninguna de estas la puede llamar el anónimo.
revoke all on all functions in schema public from anon;
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;

-- Las que se invocan desde la aplicación, nombradas para que se vea.
comment on function pasar_a_mantenimiento is
  'Entregar sin abrir el mantenimiento es dejar de facturar sin haberlo decidido. Se llama desde la ficha del proyecto.';
