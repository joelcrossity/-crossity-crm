-- ============================================================
-- Un cliente, varias empresas.
--
-- Hasta acá `organizaciones` mezclaba tres cosas distintas:
--   la CUENTA          — la relación, quién responde, dónde cierra la plata
--   la RAZÓN SOCIAL    — a quién se le factura, con su CUIT
--   el NOMBRE DE FANTASÍA — con qué marca se conoce cada negocio
--
-- Gurichan y Sushi Paraná son dos negocios del mismo grupo, con dos
-- facturas distintas, pero frente a nosotros hay una sola persona
-- respondiendo por los dos. Con todo junto en una fila había que elegir
-- entre partir la cuenta —y perder la vista del cliente entero— o
-- unificarla y no poder facturar bien.
-- ============================================================

comment on table organizaciones is
  'La cuenta: la relación comercial. Puede agrupar varias razones sociales y varias marcas.';

-- ------------------------------------------------------------
-- A quién se le factura
-- ------------------------------------------------------------

create table razones_sociales (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references organizaciones(id) on delete cascade,
  razon_social     text not null,
  cuit             text,
  condicion_iva    text,
  domicilio        text,
  email_facturacion text,
  es_principal     boolean not null default false,
  activa           boolean not null default true,
  created_at       timestamptz not null default now()
);

create unique index razones_una_principal
  on razones_sociales (organizacion_id) where es_principal;

create index razones_por_cuenta on razones_sociales (organizacion_id);

comment on table razones_sociales is
  'Varias por cuenta. La factura sale de acá; la relación vive en la cuenta.';

-- ------------------------------------------------------------
-- Cómo se lo conoce
-- ------------------------------------------------------------

create table marcas (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references organizaciones(id) on delete cascade,
  nombre           text not null,
  razon_social_id  uuid references razones_sociales(id) on delete set null,
  es_principal     boolean not null default false,
  activa           boolean not null default true,
  created_at       timestamptz not null default now()
);

create unique index marcas_una_principal
  on marcas (organizacion_id) where es_principal;

comment on table marcas is
  'Nombres de fantasía. Una marca suele facturarse por una razón social, pero no siempre, así que el vínculo es opcional.';

comment on column marcas.razon_social_id is
  'Con cuál se factura habitualmente esta marca. Sirve de sugerencia al crear el proyecto, no de regla.';

-- ------------------------------------------------------------
-- El proyecto: de qué cuenta es, con qué marca, y a quién se factura
-- ------------------------------------------------------------

alter table proyectos
  add column marca_id        uuid references marcas(id) on delete set null,
  add column razon_social_id uuid references razones_sociales(id) on delete set null;

comment on column proyectos.razon_social_id is
  'Null significa la principal de la cuenta. Se resuelve al facturar, no al crear.';

-- Coherencia: la razón social y la marca tienen que ser de la misma cuenta.
create or replace function validar_pertenencia()
returns trigger
language plpgsql
as $$
begin
  if NEW.razon_social_id is not null and not exists (
    select 1 from razones_sociales r
     where r.id = NEW.razon_social_id and r.organizacion_id = NEW.organizacion_id
  ) then
    raise exception 'Esa razón social no pertenece a la cuenta del proyecto';
  end if;

  if NEW.marca_id is not null and not exists (
    select 1 from marcas m
     where m.id = NEW.marca_id and m.organizacion_id = NEW.organizacion_id
  ) then
    raise exception 'Esa marca no pertenece a la cuenta del proyecto';
  end if;

  return NEW;
end;
$$;

create trigger proyectos_validan_pertenencia
  before insert or update of razon_social_id, marca_id, organizacion_id on proyectos
  for each row execute function validar_pertenencia();

-- A quién se le factura este proyecto, resolviendo el null.
create or replace function razon_social_de(p_proyecto uuid)
returns uuid
language sql
stable
as $$
  select coalesce(
    (select p.razon_social_id from proyectos p where p.id = p_proyecto),
    (select r.id from razones_sociales r
       join proyectos p on p.organizacion_id = r.organizacion_id
      where p.id = p_proyecto and r.es_principal
      limit 1)
  )
$$;

-- ------------------------------------------------------------
-- La cuenta completa: lo que ninguna planilla podía mostrar.
-- ------------------------------------------------------------

create or replace view v_cuenta
with (security_invoker = true)
as
select
  o.id,
  o.codigo,
  o.nombre_canonico                                    as cuenta,
  (select count(*) from razones_sociales r where r.organizacion_id = o.id) as razones_sociales,
  (select string_agg(m.nombre, ' · ' order by m.nombre)
     from marcas m where m.organizacion_id = o.id)     as marcas,
  count(*) filter (where p.color = 'verde')            as en_vivo,
  count(*) filter (where p.color = 'amarillo')         as en_pipeline,
  count(*) filter (where p.tipo = 'mantenimiento'
                     and p.color not in ('rojo','naranja')) as abonos,
  count(*) filter (where p.condicion = 'bonificado')   as bonificados,
  count(*)                                             as proyectos_totales
from organizaciones o
left join proyectos p on p.organizacion_id = o.id
group by o.id, o.codigo, o.nombre_canonico;

comment on view v_cuenta is
  'Un sitio regalado deja de ser una pérdida cuando se lo ve dentro de la cuenta. Por eso la cuenta es el nivel donde cierra la economía, no el proyecto.';

alter table razones_sociales enable row level security;
alter table marcas enable row level security;

create policy razones_lectura on razones_sociales for select to authenticated
  using (
    ve_todo()
    or exists (select 1 from proyectos p
                where p.organizacion_id = razones_sociales.organizacion_id
                  and participa_en(p.id))
  );
create policy razones_alta on razones_sociales for insert to authenticated
  with check (es_direccion() or es_admin());
create policy razones_cambio on razones_sociales for update to authenticated
  using (es_direccion() or es_admin()) with check (es_direccion() or es_admin());
create policy razones_baja on razones_sociales for delete to authenticated
  using (es_direccion() or es_admin());

create policy marcas_lectura on marcas for select to authenticated
  using (
    ve_todo()
    or exists (select 1 from proyectos p
                where p.organizacion_id = marcas.organizacion_id
                  and participa_en(p.id))
  );
create policy marcas_alta on marcas for insert to authenticated
  with check (ve_todo());
create policy marcas_cambio on marcas for update to authenticated
  using (ve_todo()) with check (ve_todo());
create policy marcas_baja on marcas for delete to authenticated
  using (ve_todo());

grant select, insert, update, delete on razones_sociales, marcas to authenticated;
grant select on v_cuenta to authenticated;
