-- ============================================================
-- Permisos de tabla. RLS decide QUÉ filas se ven;
-- el grant decide si la tabla se puede tocar. Hacen falta los dos.
-- Explícito a propósito: no depender de privilegios por defecto.
-- ============================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Las vistas se leen; no se escriben.
revoke insert, update, delete on v_tablero, v_mi_posicion, v_posicion_general
  from authenticated;

-- La traza es append-only. Ni dirección puede editarla.
revoke update, delete on eventos from authenticated;

-- Lo que se cree de acá en adelante nace con los mismos permisos.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- El rol anónimo no ve absolutamente nada.
revoke all on all tables in schema public from anon;
