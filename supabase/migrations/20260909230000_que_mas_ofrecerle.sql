-- ============================================================
-- Qué más le podemos ofrecer.
--
-- Hoy esto existe y vive en un solo lugar: la cabeza de quien hizo el
-- trabajo. Terminás un sitio y sabés que a ese cliente le sirve un
-- agente conversacional — pero lo sabés vos, en ese momento, y tres
-- meses después ya no se te ocurre.
--
-- Se resuelve en dos capas, porque son dos cosas distintas:
--
--   1. Lo que se deduce solo. Si entregamos un sitio, hay una lista
--      corta de cosas que casi siempre siguen. Eso no hace falta que
--      alguien lo recuerde: sale de lo que ya está cargado.
--
--   2. Lo que solo sabe la persona. "A éste le interesó la parte de
--      reportes, volver en marzo." Ninguna regla lo va a deducir.
--
-- Y la parte que cierra el círculo: ofrecer algo no abre una lista
-- aparte, abre una oportunidad en el pipeline del mismo cliente. Si
-- fuera otra lista, sería otra cosa más para mirar.
-- ============================================================

create table servicios (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  descripcion text,
  recurrente  boolean not null default false,
  activo      boolean not null default true,
  orden       integer not null default 100
);

comment on column servicios.recurrente is
  'Si se cobra por mes. Un abono vale más que un proyecto suelto del mismo monto y conviene verlo distinto.';

insert into servicios (nombre, descripcion, recurrente, orden) values
  ('Sitio web',              'Institucional o landing',                    false, 10),
  ('Tienda online',          'E-commerce con medios de pago',              false, 20),
  ('Sistema a medida',       'Software propio para su operación',          false, 30),
  ('Agente conversacional',  'Atención automática por WhatsApp o web',     false, 40),
  ('Automatizaciones',       'Conectar lo que hoy se hace a mano',         false, 50),
  ('Identidad de marca',     'Logo, manual y aplicaciones',                false, 60),
  ('Marketing digital',      'Campañas y contenido',                       true,  70),
  ('SEO',                    'Posicionamiento y contenido orgánico',       true,  80),
  ('Mantenimiento',          'Soporte y evolución de lo entregado',        true,  90),
  ('Hosting y dominio',      'Infraestructura y correo',                   true, 100);

alter table proyectos add column servicio_id uuid references servicios(id) on delete set null;

comment on column proyectos.servicio_id is
  'Qué se entregó. Sin esto no se puede deducir qué sigue, porque el nombre del proyecto no dice de qué se trata.';

-- ------------------------------------------------------------
-- Lo que suele seguir. Una regla, no una adivinanza.
-- ------------------------------------------------------------

create table sugerencias (
  id           uuid primary key default gen_random_uuid(),
  si_tiene_id  uuid not null references servicios(id) on delete cascade,
  ofrecer_id   uuid not null references servicios(id) on delete cascade,
  razon        text not null,
  constraint no_se_sugiere_a_si_mismo check (si_tiene_id <> ofrecer_id)
);

create unique index sugerencias_sin_duplicar on sugerencias (si_tiene_id, ofrecer_id);

insert into sugerencias (si_tiene_id, ofrecer_id, razon)
select a.id, b.id, r.razon
from (values
  ('Sitio web',             'Agente conversacional', 'Ya tiene dónde ponerlo y le llegan consultas que hoy contesta a mano'),
  ('Sitio web',             'SEO',                   'Un sitio sin posicionamiento no lo encuentra nadie'),
  ('Sitio web',             'Mantenimiento',         'Lo entregado se desactualiza solo'),
  ('Sitio web',             'Hosting y dominio',     'Si lo tiene con otro, se le puede ordenar todo junto'),
  ('Tienda online',         'Agente conversacional', 'Las preguntas antes de comprar son siempre las mismas'),
  ('Tienda online',         'Marketing digital',     'Una tienda sin tráfico no vende'),
  ('Tienda online',         'Automatizaciones',      'Stock, facturación y envíos se hacen a mano al principio'),
  ('Sistema a medida',      'Agente conversacional', 'El sistema ya tiene los datos que el agente necesita contestar'),
  ('Sistema a medida',      'Mantenimiento',         'Un sistema propio necesita quién lo siga'),
  ('Sistema a medida',      'Automatizaciones',      'Siempre queda una parte cargándose a mano'),
  ('Identidad de marca',    'Sitio web',             'La marca nueva pide dónde mostrarse'),
  ('Agente conversacional', 'Automatizaciones',      'Lo que el agente contesta, después conviene que lo resuelva solo'),
  ('Marketing digital',     'Sitio web',             'Traer gente a un sitio flojo es tirar la inversión')
) as r(tiene, ofrece, razon)
join servicios a on a.nombre = r.tiene
join servicios b on b.nombre = r.ofrece;

-- ------------------------------------------------------------
-- Lo que solo sabe la persona.
-- ------------------------------------------------------------

create type estado_nota_venta as enum ('anotada', 'ofrecida', 'no_va');

create table notas_de_venta (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  servicio_id     uuid references servicios(id) on delete set null,
  texto           text not null,
  cuando          date,
  estado          estado_nota_venta not null default 'anotada',
  proyecto_id     uuid references proyectos(id) on delete set null,
  anotada_por     uuid references personas(id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table notas_de_venta is
  'Lo que ninguna regla va a deducir: "le interesó la parte de reportes, volver en marzo".';

comment on column notas_de_venta.proyecto_id is
  'La oportunidad que salió de esta nota. Es lo que evita que "ofrecer" abra una lista paralela al pipeline.';

alter table notas_de_venta enable row level security;

create policy notas_lectura on notas_de_venta for select to authenticated using (ve_todo());
create policy notas_alta on notas_de_venta for insert to authenticated with check (ve_todo());
create policy notas_cambio on notas_de_venta for update to authenticated
  using (ve_todo()) with check (ve_todo());
create policy notas_baja on notas_de_venta for delete to authenticated using (ve_todo());

grant select, insert, update, delete on notas_de_venta to authenticated;
grant select on servicios, sugerencias to authenticated;

alter table servicios enable row level security;
alter table sugerencias enable row level security;
create policy servicios_lectura on servicios for select to authenticated using (true);
create policy sugerencias_lectura on sugerencias for select to authenticated using (true);

-- ------------------------------------------------------------
-- Lo que se le puede ofrecer a cada cliente.
--
-- Sale de lo que ya tiene, menos lo que ya tiene. Y menos lo que ya se
-- le está ofreciendo: sugerir algo que está en el pipeline es la forma
-- rápida de que se deje de mirar la lista.
-- ------------------------------------------------------------

create or replace view v_para_ofrecer
with (security_invoker = true)
as
select distinct
  o.id            as organizacion_id,
  o.codigo        as cliente_codigo,
  o.nombre_canonico as cliente,
  s.id            as servicio_id,
  s.nombre        as servicio,
  s.recurrente,
  tiene.nombre    as porque_tiene,
  g.razon
from organizaciones o
join proyectos p    on p.organizacion_id = o.id and p.servicio_id is not null
join servicios tiene on tiene.id = p.servicio_id
join sugerencias g   on g.si_tiene_id = tiene.id
join servicios s     on s.id = g.ofrecer_id and s.activo
where
  -- lo que se entregó de verdad, no lo que está en conversación
  p.color in ('verde', 'naranja')
  -- y todavía no lo tiene
  and not exists (
    select 1 from proyectos q
     where q.organizacion_id = o.id
       and q.servicio_id = s.id
       and q.color <> 'rojo'
  );

grant select on v_para_ofrecer to authenticated;

comment on view v_para_ofrecer is
  'Sale de lo entregado, descontando lo que ya tiene y lo que ya se le está ofreciendo. Sugerir algo que está en el pipeline es la forma rápida de que la lista se deje de mirar.';
