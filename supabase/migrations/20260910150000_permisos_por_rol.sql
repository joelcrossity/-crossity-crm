-- ============================================================
-- Permisos por defecto del rol, y el ajuste por persona.
--
-- Tomado de cómo lo resuelve el sistema de Stilo: cada rol trae sus
-- permisos por defecto y los switches los ajustan por persona. Lo que
-- hace que se entienda es la palabra "ajustado": ver de un vistazo
-- quién está fuera de lo que su rol dice es lo que evita que, con el
-- tiempo, los permisos sean un misterio que nadie se anima a tocar.
--
-- Queda entonces una escalera de cuatro escalones, del más general al
-- más puntual, y cada uno pisa al anterior:
--   1. lo que el rol da por defecto
--   2. el ajuste global de esa persona     (puede dar y puede sacar)
--   3. el permiso en un proyecto concreto  (solo da)
--   4. los pisos que no se tocan nunca
--
-- El punto 4 es el que hace que esto sea seguro: por más que se apague
-- todo, cada uno sigue viendo su propia plata. Eso no es un permiso,
-- es la regla maestra del sistema, y no debe poder apagarse desde una
-- pantalla.
-- ============================================================

create table acciones_catalogo (
  accion  accion_permitida primary key,
  etiqueta text not null,
  ayuda    text not null,
  grupo    text not null,
  orden    integer not null
);

insert into acciones_catalogo (accion, etiqueta, ayuda, grupo, orden) values
  ('ver_facturacion',   'Ver la facturación',
   'Cuánto se le cotizó al cliente, qué se le facturó y si pagó.', 'Plata', 10),
  ('ver_economia',      'Ver la economía de adentro',
   'Costos, gastos y cuánto cobra cada uno por el trabajo.', 'Plata', 20),
  ('cargar_cobros',     'Cargar cobros',
   'Registrar que entró la plata de un cliente.', 'Plata', 30),
  ('cambiar_montos',    'Cambiar montos',
   'Tocar el precio de un proyecto o de una entrega.', 'Plata', 40),
  ('ver_comercial',     'Ver lo comercial',
   'Lo que se habló en el embudo: precios tanteados, dudas del cliente.', 'Trabajo', 50),
  ('configurar_equipo', 'Armar el equipo',
   'Sumar y sacar gente de un proyecto.', 'Trabajo', 60);

alter table acciones_catalogo enable row level security;
create policy acciones_lectura on acciones_catalogo for select to authenticated using (true);
grant select on acciones_catalogo to authenticated;

-- ------------------------------------------------------------
-- Lo que trae cada rol. Es la foto de cómo funciona hoy el sistema,
-- escrita donde se pueda leer en vez de repartida entre funciones.
-- ------------------------------------------------------------

create table roles_permisos (
  rol    rol_sistema not null,
  accion accion_permitida not null,
  primary key (rol, accion)
);

insert into roles_permisos (rol, accion) values
  ('direccion', 'ver_facturacion'), ('direccion', 'ver_economia'),
  ('direccion', 'cargar_cobros'),   ('direccion', 'cambiar_montos'),
  ('direccion', 'ver_comercial'),   ('direccion', 'configurar_equipo'),

  ('administracion', 'ver_facturacion'), ('administracion', 'ver_economia'),
  ('administracion', 'cargar_cobros'),   ('administracion', 'cambiar_montos'),
  ('administracion', 'configurar_equipo'),

  ('coordinacion', 'ver_facturacion'), ('coordinacion', 'ver_comercial'),
  ('coordinacion', 'configurar_equipo'),

  ('project_manager', 'ver_facturacion'), ('project_manager', 'ver_comercial'),
  ('project_manager', 'configurar_equipo'),

  ('vendedor', 'ver_facturacion'), ('vendedor', 'ver_comercial');
  -- desarrollo no trae ninguno por defecto: se le dan por proyecto

alter table roles_permisos enable row level security;
create policy roles_permisos_lectura on roles_permisos for select to authenticated using (true);
grant select on roles_permisos to authenticated;

comment on table roles_permisos is
  'La foto de cómo funciona hoy, escrita donde se puede leer en vez de repartida entre funciones.';

-- ------------------------------------------------------------
-- El ajuste por persona. Puede dar y puede sacar.
-- ------------------------------------------------------------

create table permisos_persona (
  persona_id   uuid not null references personas(id) on delete cascade,
  accion       accion_permitida not null,
  otorgado     boolean not null,
  motivo       text,
  ajustado_por uuid references personas(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (persona_id, accion)
);

comment on column permisos_persona.otorgado is
  'true da algo que el rol no da; false saca algo que el rol sí da. Las dos direcciones son necesarias y las dos quedan marcadas como ajuste.';

alter table permisos_persona enable row level security;

create policy permisos_persona_lectura on permisos_persona for select to authenticated
  using (persona_id = persona_actual() or puede_configurar_visibilidad());

grant select on permisos_persona to authenticated;
revoke insert, update, delete on permisos_persona from authenticated, anon;

-- ------------------------------------------------------------
-- La pregunta, resuelta en un solo lugar.
-- ------------------------------------------------------------

create or replace function puede_persona(p_accion accion_permitida)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- 2. el ajuste de la persona pisa al rol, en las dos direcciones
    (select pp.otorgado from permisos_persona pp
      where pp.persona_id = persona_actual() and pp.accion = p_accion),
    -- 1. lo que traen sus roles
    exists (
      select 1 from personas pe
       join roles_permisos rp on rp.rol = any(pe.roles)
      where pe.id = persona_actual() and rp.accion = p_accion
    )
  )
$$;

grant execute on function puede_persona(accion_permitida) to authenticated;

-- Las dos economías consultan ahora los cuatro escalones.
-- Dirección y administración quedan escritas aparte a propósito: son la
-- base del sistema y no deben depender de una tabla que se edita.
create or replace function ve_facturacion_de(p_proyecto uuid)
returns boolean
language sql
stable
as $$
  select es_direccion() or es_admin()
      or apertura_abierta_en(p_proyecto)
      or tiene_permiso('ver_facturacion', p_proyecto)
      or (puede_persona('ver_facturacion') and participa_en(p_proyecto))
$$;

create or replace function ve_economia_de(p_proyecto uuid)
returns boolean
language sql
stable
as $$
  select es_direccion() or es_admin()
      or apertura_abierta_en(p_proyecto)
      or tiene_permiso('ver_economia', p_proyecto)
      or (puede_persona('ver_economia') and participa_en(p_proyecto))
$$;

-- ------------------------------------------------------------
-- Editar: por función, con las protecciones puestas.
-- ------------------------------------------------------------

create or replace function guardar_persona(
  p_persona    uuid,
  p_nombre     text,
  p_email      text,
  p_telefono   text,
  p_activa     boolean,
  p_es_externa boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración editan las personas';
  end if;

  if trim(p_nombre) = '' then
    raise exception 'La persona necesita un nombre';
  end if;

  if p_persona = persona_actual() and not p_activa then
    raise exception 'No podés darte de baja a vos mismo';
  end if;

  update personas
     set nombre     = trim(p_nombre),
         email      = nullif(trim(p_email), ''),
         telefono   = nullif(trim(p_telefono), ''),
         activa     = p_activa,
         es_externa = p_es_externa
   where id = p_persona;
end;
$$;

create or replace function crear_persona(
  p_nombre text,
  p_email  text default null,
  p_roles  rol_sistema[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración dan de alta personas';
  end if;

  if trim(p_nombre) = '' then
    raise exception 'La persona necesita un nombre';
  end if;

  insert into personas (nombre, email, roles, es_externa)
  values (trim(p_nombre), nullif(trim(p_email), ''), p_roles, false)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function ajustar_permiso(
  p_persona uuid,
  p_accion  accion_permitida,
  p_otorgado boolean,
  p_motivo  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_direccion() then
    raise exception 'Solo dirección ajusta los permisos generales';
  end if;

  insert into permisos_persona (persona_id, accion, otorgado, motivo, ajustado_por)
  values (p_persona, p_accion, p_otorgado, p_motivo, persona_actual())
  on conflict (persona_id, accion)
    do update set otorgado = excluded.otorgado, ajustado_por = persona_actual();
end;
$$;

-- Volver a lo que dice el rol: se borra el ajuste, no se guarda otro.
create or replace function soltar_permiso(p_persona uuid, p_accion accion_permitida)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_direccion() then
    raise exception 'Solo dirección ajusta los permisos generales';
  end if;
  delete from permisos_persona where persona_id = p_persona and accion = p_accion;
end;
$$;

grant execute on function guardar_persona(uuid, text, text, text, boolean, boolean) to authenticated;
grant execute on function crear_persona(text, text, rol_sistema[]) to authenticated;
grant execute on function ajustar_permiso(uuid, accion_permitida, boolean, text) to authenticated;
grant execute on function soltar_permiso(uuid, accion_permitida) to authenticated;

-- ------------------------------------------------------------
-- Qué puede cada uno, y si está ajustado.
-- ------------------------------------------------------------

create or replace view v_permisos
with (security_invoker = true)
as
select
  pe.id            as persona_id,
  a.accion,
  a.etiqueta,
  a.ayuda,
  a.grupo,
  a.orden,
  exists (
    select 1 from roles_permisos rp
     where rp.rol = any(pe.roles) and rp.accion = a.accion
  )                as por_rol,
  pp.otorgado      as ajuste,
  coalesce(pp.otorgado, exists (
    select 1 from roles_permisos rp
     where rp.rol = any(pe.roles) and rp.accion = a.accion
  ))               as puede,
  (pp.persona_id is not null) as ajustado
from personas pe
cross join acciones_catalogo a
left join permisos_persona pp on pp.persona_id = pe.id and pp.accion = a.accion;

grant select on v_permisos to authenticated;

comment on view v_permisos is
  'Ajustado marca quién está fuera de lo que su rol dice. Verlo de un vistazo es lo que evita que con el tiempo los permisos sean un misterio que nadie se anima a tocar.';
