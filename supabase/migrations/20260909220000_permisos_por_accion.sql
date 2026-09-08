-- ============================================================
-- Permisos por persona, por proyecto y por acción.
--
-- Hasta ahora había dos capas: el rol (lo que podés hacer en general) y
-- la apertura por participación (cuánto ves de la plata de un proyecto).
-- Alcanzan para el caso normal y se quedan cortas para el caso real:
-- "en éste, dejalo cargar cobros", "en éste no le muestres la economía
-- aunque sea PM".
--
-- La regla de diseño, y es lo que hace que esto no sea peligroso:
-- un permiso SUMA, nunca resta. Se otorga sobre lo que el rol ya
-- permite, y quitarlo devuelve a lo que el rol dice. Así ninguna
-- concesión puntual puede abrir un agujero por debajo de las reglas
-- generales, y las políticas existentes siguen valiendo tal cual.
--
-- La excepción se anota como excepción, que es distinto de cambiar la
-- regla para todos.
-- ============================================================

create type accion_permitida as enum (
  'ver_economia',      -- costos y arreglos de adentro
  'ver_facturacion',   -- cuánto se cotizó, qué se facturó, si pagó
  'cargar_cobros',
  'cambiar_montos',
  'configurar_equipo',
  'ver_comercial'      -- lo hablado en el embudo
);

create table permisos_proyecto (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references personas(id) on delete cascade,
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  accion      accion_permitida not null,
  otorgado_por uuid references personas(id) on delete set null,
  motivo      text,
  created_at  timestamptz not null default now()
);

create unique index permisos_sin_duplicar
  on permisos_proyecto (persona_id, proyecto_id, accion);

comment on table permisos_proyecto is
  'Suma, nunca resta. Una concesión puntual no puede abrir nada por debajo de las reglas generales.';

alter table permisos_proyecto enable row level security;

-- Cada uno ve los permisos que le dieron; quien configura, los ve todos.
create policy permisos_lectura on permisos_proyecto for select to authenticated
  using (persona_id = persona_actual() or puede_configurar_visibilidad());

grant select on permisos_proyecto to authenticated;

-- La escritura NO va por policy: va por función, para poder impedir
-- que alguien se otorgue permisos a sí mismo.
revoke insert, update, delete on permisos_proyecto from authenticated, anon;

-- ------------------------------------------------------------
-- La pregunta, en una función.
-- ------------------------------------------------------------

create or replace function tiene_permiso(p_accion accion_permitida, p_proyecto uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from permisos_proyecto pp
     where pp.persona_id = persona_actual()
       and pp.proyecto_id = p_proyecto
       and pp.accion = p_accion
  )
$$;

grant execute on function tiene_permiso(accion_permitida, uuid) to authenticated;

-- ------------------------------------------------------------
-- Las dos economías ahora también miran los permisos otorgados.
-- Se agrega un `or`: nadie pierde nada de lo que ya veía.
-- ------------------------------------------------------------

create or replace function ve_facturacion_de(p_proyecto uuid)
returns boolean
language sql
stable
as $$
  select es_direccion() or es_admin()
      or ((es_pm() or tiene_rol('vendedor')) and participa_en(p_proyecto))
      or apertura_abierta_en(p_proyecto)
      or tiene_permiso('ver_facturacion', p_proyecto)
$$;

create or replace function ve_economia_de(p_proyecto uuid)
returns boolean
language sql
stable
as $$
  select es_direccion() or es_admin()
      or apertura_abierta_en(p_proyecto)
      or tiene_permiso('ver_economia', p_proyecto)
$$;

-- ------------------------------------------------------------
-- Otorgar y quitar. Una sola puerta, con las dos reglas que importan:
-- solo dirección, administración o coordinación configuran, y nadie
-- se otorga permisos a sí mismo.
-- ------------------------------------------------------------

create or replace function otorgar_permiso(
  p_persona  uuid,
  p_proyecto uuid,
  p_accion   accion_permitida,
  p_motivo   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not puede_configurar_visibilidad() then
    raise exception 'Solo dirección, administración o coordinación dan permisos';
  end if;

  if p_persona = persona_actual() and not es_direccion() then
    raise exception 'No podés darte permisos a vos mismo';
  end if;

  insert into permisos_proyecto (persona_id, proyecto_id, accion, otorgado_por, motivo)
  values (p_persona, p_proyecto, p_accion, persona_actual(), p_motivo)
  on conflict (persona_id, proyecto_id, accion)
    do update set motivo = coalesce(excluded.motivo, permisos_proyecto.motivo);
end;
$$;

create or replace function quitar_permiso(
  p_persona  uuid,
  p_proyecto uuid,
  p_accion   accion_permitida
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not puede_configurar_visibilidad() then
    raise exception 'Solo dirección, administración o coordinación dan permisos';
  end if;

  delete from permisos_proyecto
   where persona_id = p_persona and proyecto_id = p_proyecto and accion = p_accion;
end;
$$;

grant execute on function otorgar_permiso(uuid, uuid, accion_permitida, text) to authenticated;
grant execute on function quitar_permiso(uuid, uuid, accion_permitida) to authenticated;

-- ------------------------------------------------------------
-- Cambiar los roles de una persona. También por función: los roles
-- deciden todo lo demás y no deben poder tocarse desde cualquier lado.
-- ------------------------------------------------------------

create or replace function cambiar_roles(p_persona uuid, p_roles rol_sistema[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_direccion() then
    raise exception 'Solo dirección cambia los roles';
  end if;

  if p_persona = persona_actual() and not ('direccion' = any(p_roles)) then
    raise exception 'No podés sacarte a vos mismo el rol de dirección';
  end if;

  update personas set roles = p_roles where id = p_persona;
end;
$$;

grant execute on function cambiar_roles(uuid, rol_sistema[]) to authenticated;

comment on function cambiar_roles is
  'Impide quedarse sin dirección por accidente: nadie puede sacarse el propio rol de dirección.';

-- ------------------------------------------------------------
-- Quién es quién, para la pantalla de equipo.
-- ------------------------------------------------------------

create or replace view v_equipo
with (security_invoker = true)
as
select
  p.id,
  p.nombre,
  p.email,
  p.roles,
  p.es_externa,
  p.activa,
  (u.id is not null) as tiene_cuenta,
  (select count(*) from asignaciones a
    where a.persona_id = p.id and a.hasta is null) as en_equipos,
  (select count(*) from participaciones pa where pa.persona_id = p.id) as participa_en,
  (select count(*) from permisos_proyecto pp where pp.persona_id = p.id) as permisos_dados
from personas p
left join usuarios u on u.persona_id = p.id;

grant select on v_equipo to authenticated;

comment on view v_equipo is
  'tiene_cuenta separa dos cosas que se confunden: participar y cobrar no exige tener usuario.';
