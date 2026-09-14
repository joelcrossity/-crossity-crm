-- ------------------------------------------------------------------
-- Invitaciones con un código corto en vez del enlace de Supabase.
--
-- El enlace que se manda hoy lleva el token adentro. Va por WhatsApp,
-- así que queda en el chat, en la copia de seguridad del teléfono y en
-- el celular de quien lo recibe. Si la persona no lo usa en el día, ese
-- token sigue ahí semanas, y con él cualquiera fija la contraseña de
-- esa cuenta.
--
-- La vuelta es que el token no viaje. Se manda un código corto a
-- nuestro dominio, y recién cuando la persona lo abre se genera el
-- enlace de Supabase y se la redirige. El token vive segundos y nunca
-- queda escrito en ningún lado.
--
-- El código sigue siendo algo que quien lo tenga puede usar —no hay
-- forma de invitar sin eso— pero se puede apagar: vence, se usa una
-- sola vez, y se ve desde el sistema si sigue abierto.
-- ------------------------------------------------------------------

create table if not exists invitaciones (
  codigo      text primary key,
  persona_id  uuid not null references personas(id) on delete cascade,
  email       text not null,
  creada_por  uuid references personas(id),
  created_at  timestamptz not null default now(),
  vence_at    timestamptz not null default now() + interval '7 days',
  usada_at    timestamptz,
  anulada_at  timestamptz
);

comment on table invitaciones is
  'Códigos cortos para invitar. El token de Supabase no se guarda acá: se genera al abrir el código y vive segundos.';

create index if not exists invitaciones_por_persona on invitaciones (persona_id);

alter table invitaciones enable row level security;

-- Solo quien invita las ve. La ruta que las canjea usa la clave de
-- servicio, así que no necesita política.
drop policy if exists invitaciones_lectura on invitaciones;
create policy invitaciones_lectura on invitaciones for select to authenticated
  using (es_direccion() or es_admin());

grant select on invitaciones to authenticated;


-- Crear el código. Definer porque escribe una tabla que authenticated
-- no puede tocar: así no hay forma de fabricarse una invitación.
create or replace function crear_invitacion(p_persona uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text;
  v_codigo text;
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración pueden invitar.';
  end if;

  select email into v_email from personas where id = p_persona;
  if v_email is null or trim(v_email) = '' then
    raise exception 'Esa persona no tiene correo cargado.'
      using hint = 'Ponéselo primero: el acceso se manda ahí.';
  end if;

  -- Las anteriores de esta persona se anulan: dos códigos vivos para la
  -- misma cuenta es uno más que puede quedar dando vueltas.
  update invitaciones set anulada_at = now()
   where persona_id = p_persona and usada_at is null and anulada_at is null;

  -- Doce caracteres sin vocales ni caracteres que se confunden al
  -- leerlos en voz alta: unas 10^17 combinaciones, imposible de
  -- adivinar, y se puede dictar por teléfono si hace falta.
  v_codigo := string_agg(substr('23456789bcdfghjkmnpqrstvwxz', (random() * 26)::int + 1, 1), '')
              from generate_series(1, 12);

  insert into invitaciones (codigo, persona_id, email, creada_por)
  values (v_codigo, p_persona, v_email, persona_actual());

  return v_codigo;
end;
$$;

grant execute on function crear_invitacion(uuid) to authenticated;


create or replace function anular_invitacion(p_codigo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración anulan invitaciones.';
  end if;
  update invitaciones set anulada_at = now() where codigo = p_codigo and usada_at is null;
end;
$$;

grant execute on function anular_invitacion(text) to authenticated;


-- Las que siguen abiertas, para poder ver qué anda dando vueltas.
drop view if exists v_invitaciones;
create view v_invitaciones
with (security_invoker = true)
as
select
  i.codigo, i.persona_id, pe.nombre as persona, i.email,
  quien.nombre as invitada_por,
  i.created_at, i.vence_at, i.usada_at, i.anulada_at,
  case
    when i.usada_at is not null  then 'usada'
    when i.anulada_at is not null then 'anulada'
    when i.vence_at < now()      then 'vencida'
    else 'abierta'
  end as estado
from invitaciones i
join personas pe        on pe.id = i.persona_id
left join personas quien on quien.id = i.creada_por;

grant select on v_invitaciones to authenticated;
