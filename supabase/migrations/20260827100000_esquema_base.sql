-- ============================================================
-- Sistema Operativo Crossity — esquema base
-- Ver documento de alcance para el porqué de cada decisión.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------

create type unidad_negocio as enum ('agencia', 'cronexia', 'estate');

create type rol_sistema as enum (
  'direccion', 'project_manager', 'vendedor', 'administracion', 'desarrollo'
);

-- El semáforo de Joel. Es el vocabulario de la empresa, no uno nuevo.
create type color_estado as enum ('verde', 'amarillo', 'gris', 'rojo');

-- Sub-estado, sólo aplica a los verdes.
create type subestado_verde as enum ('en_curso', 'bloqueado', 'esperando_cliente');

-- Gris y rojo llevan motivo: sin esto no se puede medir nada.
create type motivo_gris as enum ('esperando_anticipo', 'pausado_cliente', 'dormido');
create type motivo_rojo as enum ('entregado', 'perdido', 'descartado');

create type condicion_comercial as enum ('normal', 'bonificado', 'descuento');

create type esquema_cobro as enum (
  'cincuenta_cincuenta', 'por_hitos', 'mensual', 'adelantado', 'a_convenir'
);

-- Concepto de la participación: NO es el rol del sistema.
-- 'referido' es el que trae el proyecto y no hace seguimiento.
create type concepto_participacion as enum (
  'desarrollo', 'gestion', 'venta', 'referido', 'diseno', 'otro'
);

-- Apertura: se decide por participación, no por persona ni por rol.
create type apertura_participacion as enum ('abierta', 'cerrada');

-- Los cuatro estados por los que pasa la plata de cada participante.
create type estado_porcion as enum (
  'comprometido', 'devengado', 'a_liquidar', 'liquidado'
);

-- Tipo de entrada de la línea de tiempo. La visibilidad se aplica POR TIPO.
create type tipo_actualizacion as enum (
  'entrega', 'administrativo', 'comercial', 'decision'
);

create type canal_comunicacion as enum ('whatsapp', 'email', 'llamada', 'nota', 'sistema');

create type estado_firma as enum ('borrador', 'enviado', 'firmado', 'vencido');

-- ------------------------------------------------------------
-- Personas y usuarios: NO son lo mismo.
-- Una persona puede participar, cobrar y recibir avisos sin tener cuenta.
-- ------------------------------------------------------------

create table personas (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  email        text,
  telefono     text,
  roles        rol_sistema[] not null default '{}',   -- lista: Germán es PM y vendedor
  es_externa   boolean not null default false,
  activa       boolean not null default true,
  notas        text,
  created_at   timestamptz not null default now()
);

comment on column personas.roles is
  'Lista, no valor único: una persona puede tener varios roles a la vez.';

create table usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  persona_id  uuid not null unique references personas(id) on delete restrict,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Organizaciones: el cliente con identidad propia.
-- id interno nunca visible + código visible + nombre canónico + alias.
-- ------------------------------------------------------------

create sequence organizaciones_codigo_seq start 1;

create table organizaciones (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique
                     default 'C-' || lpad(nextval('organizaciones_codigo_seq')::text, 4, '0'),
  nombre_canonico  text not null,
  alias            text[] not null default '{}',
  unidad           unidad_negocio not null default 'agencia',
  cuit             text,
  notas            text,
  created_at       timestamptz not null default now()
);

comment on column organizaciones.alias is
  'Infraestructura, no prolijidad: es contra esto que la IA de la fase 3 resuelve a qué cliente pertenece un mensaje de WhatsApp.';

-- Búsqueda por nombre o por cualquier alias.
create index organizaciones_alias_idx on organizaciones using gin (alias);

create table contactos (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references organizaciones(id) on delete cascade,
  nombre           text not null,
  rol              text,
  email            text,
  telefono         text,
  es_decisor       boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Contratos: entidad propia, no un archivo suelto en el Drive.
-- Un cliente tiene varios; un contrato puede cubrir varios proyectos.
-- ------------------------------------------------------------

create table contratos (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references organizaciones(id) on delete cascade,
  titulo           text not null,
  estado           estado_firma not null default 'borrador',
  vigencia_desde   date,
  vigencia_hasta   date,
  monto_neto       numeric(14,2),
  notas            text,
  created_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Proyectos: la entidad central.
-- ------------------------------------------------------------

create table proyectos (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null unique,
  organizacion_id      uuid not null references organizaciones(id) on delete restrict,
  contrato_id          uuid references contratos(id) on delete set null,
  nombre               text not null,
  descripcion          text,
  unidad               unidad_negocio not null default 'agencia',

  -- semáforo
  color                color_estado not null default 'amarillo',
  subestado            subestado_verde,
  motivo_gris          motivo_gris,
  motivo_rojo          motivo_rojo,

  -- lo que hoy no existe en ninguna planilla
  prioridad            integer,
  fecha_comprometida   date,
  responsable_id       uuid references personas(id) on delete set null,

  -- economía
  esquema_cobro        esquema_cobro not null default 'a_convenir',
  monto_neto           numeric(14,2),
  condicion            condicion_comercial not null default 'normal',
  motivo_condicion     text,
  justificado_por      uuid references contratos(id) on delete set null,

  -- la compuerta del anticipo, con su excepción registrada
  arranco_sin_anticipo boolean not null default false,
  autorizado_por       uuid references personas(id) on delete set null,
  motivo_autorizacion  text,

  es_producto_propio   boolean not null default false,
  fecha_inicio         date,
  created_at           timestamptz not null default now(),

  -- Los motivos son obligatorios en su color y prohibidos fuera de él.
  constraint gris_con_motivo check (
    (color = 'gris') = (motivo_gris is not null)
  ),
  constraint rojo_con_motivo check (
    (color = 'rojo') = (motivo_rojo is not null)
  ),
  constraint subestado_solo_verde check (
    subestado is null or color = 'verde'
  ),
  constraint bonificado_con_motivo check (
    condicion = 'normal' or motivo_condicion is not null
  ),
  constraint excepcion_anticipo_justificada check (
    not arranco_sin_anticipo or (autorizado_por is not null and motivo_autorizacion is not null)
  ),
  constraint prioridad_positiva check (prioridad is null or prioridad > 0)
);

comment on constraint gris_con_motivo on proyectos is
  'Esperando anticipo y dormido son los dos grises, pero la acción es opuesta.';

-- El código del proyecto deriva del cliente: C-0042-01.
create or replace function asignar_codigo_proyecto()
returns trigger
language plpgsql
as $$
declare
  cod_org text;
  siguiente integer;
begin
  if new.codigo is not null and new.codigo <> '' then
    return new;
  end if;

  select codigo into cod_org from organizaciones where id = new.organizacion_id;

  select coalesce(max(substring(codigo from '-([0-9]+)$')::integer), 0) + 1
    into siguiente
    from proyectos
   where organizacion_id = new.organizacion_id;

  new.codigo := cod_org || '-' || lpad(siguiente::text, 2, '0');
  return new;
end;
$$;

create trigger proyectos_codigo
  before insert on proyectos
  for each row execute function asignar_codigo_proyecto();

-- ------------------------------------------------------------
-- Asignaciones: el equipo se convoca por proyecto y rota.
-- Con fecha de alta y de baja, que es la trazabilidad que pidió Joel.
-- ------------------------------------------------------------

create table asignaciones (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos(id) on delete cascade,
  persona_id   uuid not null references personas(id) on delete cascade,
  rol          rol_sistema not null,
  desde        date not null default current_date,
  hasta        date,
  created_at   timestamptz not null default now(),
  constraint periodo_coherente check (hasta is null or hasta >= desde)
);

create unique index asignaciones_vigentes_unicas
  on asignaciones (proyecto_id, persona_id, rol)
  where hasta is null;

-- ------------------------------------------------------------
-- Participaciones: el acuerdo. N por proyecto, suman 100 %.
-- Crossity es una participación más (la de gestión).
-- ------------------------------------------------------------

create table participaciones (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos(id) on delete cascade,
  persona_id   uuid references personas(id) on delete restrict,
  es_crossity  boolean not null default false,
  concepto     concepto_participacion not null,
  porcentaje   numeric(6,3) not null,
  apertura     apertura_participacion not null default 'cerrada',
  created_at   timestamptz not null default now(),

  constraint porcentaje_valido check (porcentaje > 0 and porcentaje <= 100),
  -- o es de una persona, o es de la casa; nunca las dos ni ninguna
  constraint titular_definido check (
    (persona_id is not null) <> es_crossity
  )
);

comment on column participaciones.apertura is
  'La transparencia se decide por proyecto: la misma persona puede ser socio abierto en uno y contratado a ciegas en otro.';

-- Germán puede tener dos participaciones en el mismo proyecto
-- (una por referirlo, otra por gestionarlo), pero no dos del mismo concepto.
create unique index participaciones_sin_duplicar
  on participaciones (proyecto_id, coalesce(persona_id::text, 'crossity'), concepto);

-- ------------------------------------------------------------
-- Hitos: entregable y cobro son el mismo objeto.
-- Se generan solos a partir del esquema de cobro.
-- ------------------------------------------------------------

create table hitos (
  id                  uuid primary key default gen_random_uuid(),
  proyecto_id         uuid not null references proyectos(id) on delete cascade,
  orden               integer not null,
  titulo              text not null,
  entregable          text,
  porcentaje          numeric(6,3),
  monto_neto          numeric(14,2) not null default 0,
  fecha_comprometida  date,
  es_anticipo         boolean not null default false,
  entregado_at        timestamptz,
  facturado_at        timestamptz,
  cobrado_at          timestamptz,
  created_at          timestamptz not null default now(),

  constraint orden_positivo check (orden > 0),
  -- no se puede cobrar lo que no se facturó
  constraint cobro_despues_de_factura check (
    cobrado_at is null or facturado_at is not null
  )
);

create unique index hitos_orden_unico on hitos (proyecto_id, orden);
create unique index hitos_un_solo_anticipo on hitos (proyecto_id) where es_anticipo;

-- ------------------------------------------------------------
-- Gastos: monto fijo, se descuentan ANTES del reparto.
-- Neto, alícuota e IVA por separado — nunca un total pelado.
-- ------------------------------------------------------------

create table gastos (
  id               uuid primary key default gen_random_uuid(),
  proyecto_id      uuid not null references proyectos(id) on delete cascade,
  -- si cuelga de un hito se descuenta de ese; si no, se prorratea por porcentaje
  hito_id          uuid references hitos(id) on delete set null,
  descripcion      text not null,
  proveedor        text,
  neto             numeric(14,2) not null,
  alicuota_iva     numeric(5,2) not null default 21,   -- 0 / 10.5 / 21 / 27
  iva_discriminado boolean not null default true,
  fecha            date not null default current_date,
  created_at       timestamptz not null default now(),

  constraint neto_positivo check (neto >= 0),
  constraint alicuota_valida check (alicuota_iva in (0, 10.5, 21, 27))
);

-- IVA calculado, no cargado a mano.
alter table gastos
  add column iva numeric(14,2)
  generated always as (round(neto * alicuota_iva / 100, 2)) stored;

-- Lo que efectivamente se descuenta de la base de reparto:
-- si el IVA está discriminado es crédito fiscal → sólo el neto.
-- si no lo está (monotributista, consumidor final) → el total, porque es costo real.
alter table gastos
  add column costo_real numeric(14,2)
  generated always as (
    case when iva_discriminado
      then neto
      else neto + round(neto * alicuota_iva / 100, 2)
    end
  ) stored;

comment on column gastos.costo_real is
  'Lo define el comprobante, no un default configurable.';

-- ------------------------------------------------------------
-- Impuestos y tasas: lista por jurisdicción, no un campo fijo.
-- Hoy sólo impuesto al cheque; IIBB exento en Entre Ríos, no en otras provincias.
-- ------------------------------------------------------------

create table impuestos (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos(id) on delete cascade,
  hito_id      uuid references hitos(id) on delete cascade,
  jurisdiccion text not null default 'nacional',
  concepto     text not null,
  alicuota     numeric(6,3),
  monto        numeric(14,2) not null,
  created_at   timestamptz not null default now()
);

comment on table impuestos is
  'Lista y no campo: el primer proyecto fuera de Entre Ríos paga IIBB y no debe romper el cálculo.';

-- ------------------------------------------------------------
-- Porciones: la plata concreta que cada participación genera en cada hito.
-- Responde tanto "cuánto le debo a Claudio" como "cuánto llevo ganado".
-- ------------------------------------------------------------

create table liquidaciones (
  id          uuid primary key default gen_random_uuid(),
  periodo     text not null,
  fecha       date not null default current_date,
  notas       text,
  created_at  timestamptz not null default now()
);

create table porciones (
  id                uuid primary key default gen_random_uuid(),
  hito_id           uuid not null references hitos(id) on delete cascade,
  participacion_id  uuid not null references participaciones(id) on delete cascade,
  monto             numeric(14,2) not null default 0,
  estado            estado_porcion not null default 'comprometido',
  liquidacion_id    uuid references liquidaciones(id) on delete set null,
  created_at        timestamptz not null default now(),

  constraint liquidada_tiene_liquidacion check (
    (estado = 'liquidado') = (liquidacion_id is not null)
  )
);

create unique index porciones_unicas on porciones (hito_id, participacion_id);
create index porciones_por_estado on porciones (estado);

-- ------------------------------------------------------------
-- Cobros
-- ------------------------------------------------------------

create table cobros (
  id          uuid primary key default gen_random_uuid(),
  hito_id     uuid not null references hitos(id) on delete cascade,
  fecha       date not null default current_date,
  monto       numeric(14,2) not null,
  medio       text,
  registrado_por uuid references personas(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Línea de tiempo. Cada entrada lleva su tipo, y de ahí sale quién la ve.
-- ------------------------------------------------------------

create table actualizaciones (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid references proyectos(id) on delete cascade,
  organizacion_id uuid references organizaciones(id) on delete cascade,
  tipo         tipo_actualizacion not null,
  texto        text not null,
  autor_id     uuid references personas(id) on delete set null,
  canal        canal_comunicacion not null default 'nota',
  ocurrido_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),

  constraint cuelga_de_algo check (
    proyecto_id is not null or organizacion_id is not null
  )
);

create index actualizaciones_proyecto_fecha
  on actualizaciones (proyecto_id, ocurrido_at desc);

-- Multicanal desde el día uno aunque la v1 sólo cargue notas a mano:
-- así WhatsApp y mail después son un conector, no una migración.
create table mensajes (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid references organizaciones(id) on delete cascade,
  proyecto_id      uuid references proyectos(id) on delete cascade,
  contacto_id      uuid references contactos(id) on delete set null,
  persona_id       uuid references personas(id) on delete set null,
  canal            canal_comunicacion not null,
  entrante         boolean not null default true,
  cuerpo           text not null,
  externo_id       text,
  ocurrido_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create table notificaciones (
  id           uuid primary key default gen_random_uuid(),
  persona_id   uuid not null references personas(id) on delete cascade,
  proyecto_id  uuid references proyectos(id) on delete cascade,
  titulo       text not null,
  cuerpo       text not null,
  canal        canal_comunicacion not null default 'email',
  enviada_at   timestamptz,
  leida_at     timestamptz,
  created_at   timestamptz not null default now()
);

comment on table notificaciones is
  'Autocontenidas: quien no tiene cuenta no puede seguir un link. El cuerpo respeta la misma matriz de visibilidad que la pantalla.';

create table documentos (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid references proyectos(id) on delete cascade,
  contrato_id  uuid references contratos(id) on delete cascade,
  organizacion_id uuid references organizaciones(id) on delete cascade,
  titulo       text not null,
  url          text not null,
  tipo         text,
  created_at   timestamptz not null default now()
);
