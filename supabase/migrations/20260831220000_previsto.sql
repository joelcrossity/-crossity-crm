-- ============================================================
-- Lo que viene después, dejado previsto.
--
-- No se construye ahora. Se deja el lugar donde va a encajar, para que
-- cuando llegue sea un conector y no una refactorización. Las tablas
-- existen vacías: cuesta nada tenerlas y cuesta caro agregarlas cuando
-- ya hay datos y pantallas encima.
-- ============================================================

-- ------------------------------------------------------------
-- Preguntas entre las personas del equipo.
--
-- Hoy esto pasa en el grupo de WhatsApp y se pierde: alguien pregunta
-- cómo va un proyecto, alguien contesta, y a los tres días vuelve la
-- misma pregunta porque nadie puede scrollear hasta ahí.
--
-- Al quedar atada al proyecto, la respuesta se acumula en vez de
-- evaporarse. Y una pregunta con su respuesta guardada es exactamente
-- el material con el que después la IA contesta sola.
-- ------------------------------------------------------------

create type estado_consulta as enum ('abierta', 'respondida', 'cerrada');
create type origen_respuesta as enum ('persona', 'sistema', 'ia');

create table consultas (
  id              uuid primary key default gen_random_uuid(),
  proyecto_id     uuid references proyectos(id) on delete cascade,
  organizacion_id uuid references organizaciones(id) on delete cascade,
  pregunta        text not null,
  pregunta_por    uuid references personas(id) on delete set null,
  canal_entrada   canal_comunicacion not null default 'sistema',
  externo_id      text,

  estado          estado_consulta not null default 'abierta',
  respuesta       text,
  respondida_por  uuid references personas(id) on delete set null,
  respondida_como origen_respuesta,
  respondida_at   timestamptz,

  created_at      timestamptz not null default now(),

  constraint respondida_tiene_respuesta check (
    estado = 'abierta' or (respuesta is not null and respondida_como is not null)
  )
);

create index consultas_abiertas on consultas (proyecto_id) where estado = 'abierta';
create unique index consultas_sin_duplicar on consultas (canal_entrada, externo_id)
  where externo_id is not null;

comment on table consultas is
  'La pregunta se acumula con su respuesta. Cuando llegue la fase de IA, esto es el material de entrenamiento y la lista de lo que hay que poder contestar solo.';

comment on column consultas.respondida_como is
  'Persona, sistema o IA. Poder distinguirlo es lo que después dice qué proporción se contesta sola.';

comment on column consultas.externo_id is
  'El id del mensaje en WhatsApp o en el mail. Evita procesar dos veces lo mismo cuando el conector reintenta.';

-- Lo que se pregunta seguido es lo que el sistema debería mostrar solo.
create or replace view v_preguntas_repetidas
with (security_invoker = true)
as
select
  p.codigo,
  p.nombre as proyecto,
  count(*) as veces_preguntado,
  max(c.created_at) as ultima
from consultas c
join proyectos p on p.id = c.proyecto_id
group by p.codigo, p.nombre
having count(*) > 2;

comment on view v_preguntas_repetidas is
  'Cada pregunta que se repite es una pantalla que falta.';

-- ------------------------------------------------------------
-- Briefs y casos de éxito.
--
-- Al cerrar un proyecto hay material fresco —la línea de tiempo, los
-- entregables, los hitos cumplidos— que a los seis meses ya nadie
-- recuerda. Es el momento de escribir el caso, no después.
-- ------------------------------------------------------------

create type tipo_brief as enum ('cierre_interno', 'caso_de_exito', 'propuesta');
create type estado_brief as enum ('borrador', 'revisado', 'aprobado', 'publicado');

create table briefs (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos(id) on delete cascade,
  tipo         tipo_brief not null default 'cierre_interno',
  estado       estado_brief not null default 'borrador',
  titulo       text,
  contenido    text,
  generado_por origen_respuesta not null default 'ia',
  aprobado_por uuid references personas(id) on delete set null,
  url_publicada text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index briefs_por_proyecto on briefs (proyecto_id, tipo);

comment on table briefs is
  'El caso de éxito se escribe cuando el proyecto termina y el material está fresco, no seis meses después de memoria.';

comment on column briefs.estado is
  'Un caso de éxito va a la web con el nombre del cliente: nada se publica sin pasar por aprobado.';

-- Proyectos terminados que todavía no tienen su caso escrito.
create or replace view v_casos_pendientes
with (security_invoker = true)
as
select
  p.id, p.codigo, p.nombre,
  o.nombre_canonico as cliente,
  p.fecha_comprometida
from proyectos p
join organizaciones o on o.id = p.organizacion_id
where p.color = 'naranja'
  and p.condicion <> 'bonificado'
  and not exists (
    select 1 from briefs b
     where b.proyecto_id = p.id and b.tipo = 'caso_de_exito'
  );

-- ------------------------------------------------------------
-- Conectores.
--
-- Registro de qué está conectado y hasta dónde se sincronizó. Los
-- secretos NO viven acá: van en el entorno del worker. Esta tabla sólo
-- sabe que la conexión existe y cómo va.
-- ------------------------------------------------------------

create table integraciones (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null,          -- whatsapp, email, calendario, arca...
  nombre          text not null,
  activa          boolean not null default false,
  configuracion   jsonb not null default '{}',
  ultimo_sync_at  timestamptz,
  ultimo_error    text,
  created_at      timestamptz not null default now()
);

comment on table integraciones is
  'Qué está conectado y cómo va. Ninguna credencial acá: los secretos viven en el entorno del worker.';

comment on column integraciones.configuracion is
  'Sólo lo no sensible: números de teléfono, casillas, ids de grupo. Nunca tokens.';

-- Un grupo de WhatsApp o una casilla, atados a lo que corresponde.
create table canales_vinculados (
  id              uuid primary key default gen_random_uuid(),
  integracion_id  uuid not null references integraciones(id) on delete cascade,
  proyecto_id     uuid references proyectos(id) on delete cascade,
  organizacion_id uuid references organizaciones(id) on delete cascade,
  canal           canal_comunicacion not null,
  identificador   text not null,          -- id del grupo, dirección de correo
  descripcion     text,
  created_at      timestamptz not null default now(),

  constraint vinculado_a_algo check (
    proyecto_id is not null or organizacion_id is not null
  )
);

create unique index canales_sin_duplicar on canales_vinculados (canal, identificador);

comment on table canales_vinculados is
  'Acá se resuelve a qué proyecto pertenece un mensaje que llega. Sin esto, la captura automática no tiene contra qué resolver — junto con los alias del cliente.';

-- ------------------------------------------------------------
-- Permisos
-- ------------------------------------------------------------

alter table consultas enable row level security;
alter table briefs enable row level security;
alter table integraciones enable row level security;
alter table canales_vinculados enable row level security;

create policy consultas_lectura on consultas for select to authenticated
  using (ve_todo() or proyecto_id is null or participa_en(proyecto_id));
create policy consultas_alta on consultas for insert to authenticated
  with check (true);
create policy consultas_cambio on consultas for update to authenticated
  using (ve_todo() or participa_en(proyecto_id))
  with check (ve_todo() or participa_en(proyecto_id));

create policy briefs_lectura on briefs for select to authenticated
  using (ve_todo() or participa_en(proyecto_id));
create policy briefs_alta on briefs for insert to authenticated
  with check (ve_todo());
create policy briefs_cambio on briefs for update to authenticated
  using (ve_todo()) with check (ve_todo());

create policy integraciones_lectura on integraciones for select to authenticated
  using (es_direccion() or es_admin());
create policy integraciones_cambio on integraciones for all to authenticated
  using (es_direccion()) with check (es_direccion());

create policy canales_lectura on canales_vinculados for select to authenticated
  using (ve_todo());
create policy canales_cambio on canales_vinculados for all to authenticated
  using (ve_todo()) with check (ve_todo());

grant select, insert, update, delete on consultas, briefs, canales_vinculados to authenticated;
grant select on integraciones to authenticated;
grant select on v_preguntas_repetidas, v_casos_pendientes to authenticated;
