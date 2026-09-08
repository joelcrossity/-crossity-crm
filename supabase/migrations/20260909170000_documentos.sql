-- ============================================================
-- Dónde vive lo que le mandamos al cliente.
--
-- Una decisión de fondo, dicha en voz alta: el sistema guarda EL LINK,
-- no una copia del archivo. Los documentos de Crossity viven en Drive y
-- se siguen editando ahí. Una copia acá se desactualiza el primer día y
-- a partir de ahí nadie sabe cuál es la buena.
--
-- Lo que el CRM sí tiene que saber, y hoy no sabe nadie:
--   qué se le mandó, cuándo, quién lo mandó y en qué versión.
--
-- Eso no está en Drive. Drive tiene el archivo; el "se lo mandamos el
-- 14 y todavía no contestó" está en la cabeza de quien lo mandó.
-- ============================================================

create type clase_documento as enum (
  'propuesta', 'contrato', 'plan_de_trabajo', 'entregable',
  'factura', 'carpeta', 'otro'
);

alter table documentos
  add column clase       clase_documento not null default 'otro',
  add column version     text,
  add column enviado_at  timestamptz,
  add column enviado_por uuid references personas(id) on delete set null,
  add column notas       text,
  add column subido_por  uuid references personas(id) on delete set null;

comment on column documentos.enviado_at is
  'Cuándo se le mandó al cliente. Es el dato que hoy no está en ningún lado: Drive tiene el archivo, no el "se lo mandamos el 14 y no contestó".';

comment on column documentos.version is
  'v1, v2, final. Sin esto, tres links parecidos y nadie sabe cuál firmó.';

-- La columna vieja `tipo` queda como texto libre por si algo la usaba.
comment on column documentos.tipo is 'Libre. La clasificación real está en `clase`.';

create index documentos_por_proyecto on documentos (proyecto_id, created_at desc);
create index documentos_por_cuenta   on documentos (organizacion_id, created_at desc);

-- ------------------------------------------------------------
-- La carpeta de Drive: una sola, canónica, por proyecto y por cuenta.
--
-- Distinta de un documento suelto. Es "andá acá y está todo", que es lo
-- que uno quiere el 90 % de las veces.
-- ------------------------------------------------------------

alter table proyectos      add column carpeta_url text;
alter table organizaciones add column carpeta_url text;

comment on column proyectos.carpeta_url is
  'La carpeta de Drive del proyecto. Una sola y canónica: "andá acá y está todo".';

-- ------------------------------------------------------------
-- Lo que se mandó, ordenado por cuándo.
-- ------------------------------------------------------------

create or replace view v_documentos
with (security_invoker = true)
as
select
  d.id,
  d.proyecto_id,
  d.organizacion_id,
  d.titulo,
  d.url,
  d.clase,
  d.version,
  d.enviado_at,
  d.notas,
  d.created_at,
  pe.nombre as enviado_por,
  p.codigo  as proyecto_codigo,
  p.nombre  as proyecto
from documentos d
left join personas  pe on pe.id = d.enviado_por
left join proyectos p  on p.id = d.proyecto_id;

grant select on v_documentos to authenticated;

-- Un contrato que se armó y nunca se mandó es un contrato que no existe.
create or replace view v_sin_enviar
with (security_invoker = true)
as
select d.id, d.titulo, d.clase, p.nombre as proyecto, p.codigo
from documentos d
join proyectos p on p.id = d.proyecto_id
where d.enviado_at is null
  and d.clase in ('propuesta', 'contrato', 'plan_de_trabajo')
  and p.color in ('verde', 'amarillo');

grant select on v_sin_enviar to authenticated;

comment on view v_sin_enviar is
  'Se armó y no se mandó. Un contrato que nunca salió es un contrato que no existe.';
