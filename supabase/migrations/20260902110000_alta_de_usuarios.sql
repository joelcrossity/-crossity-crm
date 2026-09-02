-- ============================================================
-- Dar de alta a alguien es crear el usuario en Supabase, nada más.
--
-- Si ya existe una persona con ese correo, el vínculo se arma solo.
-- Sin esto habría que copiar UUIDs a mano cada vez que entra alguien,
-- que es el tipo de paso manual que se olvida justo cuando importa.
-- ============================================================

create or replace function vincular_usuario_a_persona()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_persona uuid;
begin
  select id into v_persona
    from personas
   where lower(email) = lower(NEW.email)
     and activa
   limit 1;

  if v_persona is not null
     and not exists (select 1 from usuarios where persona_id = v_persona) then
    insert into usuarios (id, persona_id) values (NEW.id, v_persona);
  end if;

  return NEW;
end;
$$;

create trigger auth_user_vincula_persona
  after insert on auth.users
  for each row execute function vincular_usuario_a_persona();

comment on function vincular_usuario_a_persona is
  'Quien no tenga una persona con ese correo entra sin permisos: el alta la decide el padrón, no quien se registra.';

-- Los anónimos no ven nada, tampoco en las tablas creadas después.
revoke all on all tables in schema public from anon;

-- Cuánto quedó cargado.
do $$
declare
  r record;
begin
  for r in
    select 'personas' t, count(*) n from personas
    union all select 'organizaciones', count(*) from organizaciones
    union all select 'razones sociales', count(*) from razones_sociales
    union all select 'marcas', count(*) from marcas
    union all select 'proyectos', count(*) from proyectos
    union all select 'hitos', count(*) from hitos
    union all select 'participaciones', count(*) from participaciones
    union all select 'porciones', count(*) from porciones
    union all select 'eventos', count(*) from eventos
  loop
    raise notice 'CARGADO % : %', rpad(r.t, 18), r.n;
  end loop;
end $$;
