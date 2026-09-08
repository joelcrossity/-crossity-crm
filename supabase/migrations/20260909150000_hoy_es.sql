-- El hoy lo dice la base.
--
-- El servidor web puede estar en otra zona horaria, y un día de
-- corrimiento en una agenda es un vencimiento que aparece en el
-- casillero equivocado.

create or replace function hoy_es()
returns date
language sql
stable
as $$ select current_date $$;

grant execute on function hoy_es() to authenticated;
