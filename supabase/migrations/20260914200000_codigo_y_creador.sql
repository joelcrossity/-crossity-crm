-- ------------------------------------------------------------------
-- Dos cosas que impedían que un vendedor cargara trabajo, y las dos
-- estaban mal por debajo del permiso.
--
-- EL CÓDIGO SALÍA NULO. asignar_codigo_proyecto no era definer, así que
-- leía las tablas con los permisos de quien inserta. Germán no ve la
-- organización —todavía no participa en ningún proyecto de ella— así
-- que cod_org quedaba nulo, y concatenar nulo da nulo. El error que
-- salía era el de la columna obligatoria, que no explica nada.
--
-- Peor que el nulo: el número siguiente también se calculaba sobre lo
-- que el que inserta puede ver. Alguien que ve tres de los ocho
-- proyectos de un cliente habría generado el código 04 para el noveno,
-- pisando uno existente. Un contador tiene que contar todo o no cuenta.
--
-- EL CREADOR SE ASIGNABA DEMASIADO TARDE. Lo hacía un trigger de
-- después del alta, y RETURNING lee la fila recién insertada con la
-- política de lectura puesta: en ese momento el creador todavía no
-- figuraba como responsable, así que la fila no pasaba el filtro y el
-- alta terminaba en un error de permisos. Cargaba bien y fallaba al
-- devolver lo que había cargado.
--
-- Se pone antes, sobre la fila que se está por escribir. Así nace con
-- responsable y se puede leer de inmediato.
-- ------------------------------------------------------------------

create or replace function asignar_codigo_proyecto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cod_org text;
  siguiente integer;
begin
  if new.codigo is not null and new.codigo <> '' then
    return new;
  end if;

  select codigo into cod_org from organizaciones where id = new.organizacion_id;
  if cod_org is null then
    raise exception 'Ese cliente no existe.';
  end if;

  select coalesce(max(substring(codigo from '-([0-9]+)$')::integer), 0) + 1
    into siguiente
    from proyectos
   where organizacion_id = new.organizacion_id;

  new.codigo := cod_org || '-' || lpad(siguiente::text, 2, '0');
  return new;
end;
$$;


-- El creador queda como responsable antes de escribir la fila.
create or replace function quien_crea_es_responsable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin persona detrás —una migración, el service role— no hay a quién
  -- poner, y forzar uno sería inventar un dueño.
  if new.responsable_id is null then
    new.responsable_id := persona_actual();
  end if;
  return new;
end;
$$;

drop trigger if exists proyectos_quien_crea on proyectos;
drop trigger if exists proyectos_creador on proyectos;
create trigger proyectos_creador
  before insert on proyectos
  for each row execute function quien_crea_es_responsable();


-- Y si puso a otro de responsable, el creador igual queda asignado:
-- estuvo en la conversación y va a querer ver cómo sigue. Esto sí va
-- después, porque la asignación necesita que el proyecto exista.
create or replace function quien_crea_participa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo  uuid;
  v_rol rol_sistema;
begin
  v_yo := persona_actual();
  if v_yo is null or new.responsable_id = v_yo then return new; end if;

  select unnest(roles)::rol_sistema into v_rol from personas where id = v_yo limit 1;

  insert into asignaciones (proyecto_id, persona_id, rol, desde)
  values (new.id, v_yo, coalesce(v_rol, 'vendedor'), current_date)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists proyectos_creador_participa on proyectos;
create trigger proyectos_creador_participa
  after insert on proyectos
  for each row execute function quien_crea_participa();
