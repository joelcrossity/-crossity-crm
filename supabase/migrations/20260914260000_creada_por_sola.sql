-- ------------------------------------------------------------------
-- creada_por se pone sola, no la escribe quien inserta.
--
-- El alta nueva la escribe, pero el código que está corriendo en
-- producción todavía es el viejo: crea la organización sin ese campo y
-- después inserta la razón social por separado. Con las políticas
-- nuevas esa segunda parte pide cliente_mio, que mira justamente
-- creada_por, así que da falso y la razón social no entra. Santiago
-- creaba el cliente y le decía que no tenía autorización.
--
-- Es el mismo error de secuencia de esta mañana: cambié la base y dejé
-- al frontend viejo sin poder hacer lo que hacía. La base tiene que
-- aguantar las dos versiones mientras el despliegue viaja, y la forma
-- de lograrlo no es esperar: es que el dato se ponga solo, venga de
-- donde venga.
-- ------------------------------------------------------------------

create or replace function quien_crea_el_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.creada_por is null then
    new.creada_por := persona_actual();
  end if;
  return new;
end;
$$;

drop trigger if exists organizaciones_creador on organizaciones;
create trigger organizaciones_creador
  before insert on organizaciones
  for each row execute function quien_crea_el_cliente();
