-- ============================================================
-- Los accesos, a la vista y reparables.
--
-- Hay dos padrones y se vinculan solos por correo: las cuentas de
-- Supabase —que solo sirven para entrar— y las personas del CRM, que
-- son quienes participan y cobran. El vínculo lo arma un trigger cuando
-- se crea la cuenta.
--
-- Eso funciona cuando el orden es el correcto, y falla calladito cuando
-- no lo es: si la ficha se creó DESPUÉS de la cuenta, el trigger ya
-- pasó y nadie los une. Si el correo tiene una letra distinta, tampoco.
-- El resultado es alguien que entra y no ve nada, sin ningún lugar
-- donde enterarse de por qué.
--
-- Esto agrega lo que faltaba: poder vincular a mano, y poder reparar de
-- una vez todo lo que quedó suelto.
-- ============================================================

create or replace function vincular_cuenta(p_usuario uuid, p_persona uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración vinculan cuentas';
  end if;

  if exists (select 1 from usuarios where persona_id = p_persona) then
    raise exception 'Esa persona ya tiene una cuenta vinculada';
  end if;

  if exists (select 1 from usuarios where id = p_usuario) then
    raise exception 'Esa cuenta ya está vinculada a otra persona';
  end if;

  insert into usuarios (id, persona_id) values (p_usuario, p_persona);
end;
$$;

-- Reparar de una: toma cada cuenta suelta y la une a la persona que
-- tenga ese mismo correo. Es lo que el trigger habría hecho si hubiera
-- existido la ficha en ese momento.
create or replace function reparar_vinculos()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_cuantos integer := 0;
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración reparan vínculos';
  end if;

  with sueltas as (
    select u.id, u.email
      from auth.users u
     where not exists (select 1 from usuarios x where x.id = u.id)
  ),
  encontradas as (
    select s.id as usuario, p.id as persona
      from sueltas s
      join personas p on lower(p.email) = lower(s.email)
     where p.activa
       and not exists (select 1 from usuarios x where x.persona_id = p.id)
  )
  insert into usuarios (id, persona_id)
  select usuario, persona from encontradas;

  get diagnostics v_cuantos = row_count;
  return v_cuantos;
end;
$$;

-- El trigger se queda corto en un caso: la ficha se crea después de la
-- cuenta. Se agrega el camino inverso, así el orden deja de importar.
create or replace function vincular_persona_a_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_usuario uuid;
begin
  if NEW.email is null then return NEW; end if;

  select u.id into v_usuario
    from auth.users u
   where lower(u.email) = lower(NEW.email)
     and not exists (select 1 from usuarios x where x.id = u.id)
   limit 1;

  if v_usuario is not null
     and not exists (select 1 from usuarios where persona_id = NEW.id) then
    insert into usuarios (id, persona_id) values (v_usuario, NEW.id);
  end if;

  return NEW;
end;
$$;

drop trigger if exists persona_vincula_usuario on personas;
create trigger persona_vincula_usuario
  after insert or update of email on personas
  for each row execute function vincular_persona_a_usuario();

comment on function vincular_persona_a_usuario is
  'El camino inverso del trigger original. Con los dos, el orden en que se crean la cuenta y la ficha deja de importar.';

grant execute on function vincular_cuenta(uuid, uuid) to authenticated;
grant execute on function reparar_vinculos() to authenticated;
