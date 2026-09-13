-- ------------------------------------------------------------------
-- 1. Quién puede editar.
--
-- Hasta ahora, editar un proyecto era ve_todo(): dirección,
-- administración y coordinación. Un desarrollador no podía tocar ni el
-- suyo —ni marcar una entrega, ni corregir una fecha— y tenía que
-- pedirlo por WhatsApp, que es exactamente lo que este sistema vino a
-- sacar del medio.
--
-- La regla de escritura pasa a ser la misma que la de lectura: quien ve
-- un proyecto porque participa, también lo edita. Una sola regla para
-- las dos cosas es una sola regla que mantener, y no hay forma de que
-- alguien vea algo que no puede tocar sin entender por qué.
--
-- El alta y la baja siguen siendo de ve_todo(): crear un proyecto es
-- decidir que la agencia lo toma, y borrarlo se hace muy pocas veces y
-- a propósito. Lo que se hace todos los días es editar.
--
-- Los campos sensibles siguen protegidos por su propio permiso: el
-- trigger de cambiar_montos ya frena los precios, independientemente de
-- esto.
-- ------------------------------------------------------------------

drop policy if exists proyectos_escritura_cambio on proyectos;
create policy proyectos_escritura_cambio on proyectos
  for update to authenticated
  using (ve_todo() or participa_en(id))
  with check (ve_todo() or participa_en(id));


-- ------------------------------------------------------------------
-- 2. Quién tocó por última vez.
--
-- eventos ya guarda cada cambio con su autor y su fecha, así que esto
-- no agrega información: agrega comodidad —ordenar por "lo último que
-- se movió" sin recorrer el historial—.
--
-- Va por trigger y no lo escribe la aplicación a propósito. Un campo
-- que cada pantalla tiene que acordarse de completar es un campo que
-- queda viejo en la primera que se olvide, y entonces miente. Así no
-- puede desincronizarse: lo pone la base en cada UPDATE, venga de donde
-- venga.
-- ------------------------------------------------------------------

alter table proyectos add column if not exists updated_at timestamptz;
alter table proyectos add column if not exists updated_by uuid references personas(id);

create or replace function sellar_edicion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  -- Null cuando corre una migración o el service role: ahí no hay
  -- persona, y poner cualquiera sería inventar un responsable.
  new.updated_by := persona_actual();
  return new;
end;
$$;

drop trigger if exists proyectos_sellar on proyectos;
create trigger proyectos_sellar
  before update on proyectos
  for each row execute function sellar_edicion();


-- ------------------------------------------------------------------
-- 3. Los planes de abono.
--
-- Una tabla y no un enum: los precios de los planes cambian, y con un
-- enum cada cambio sería una migración. Así se editan desde la pantalla
-- y el que arma un abono elige de una lista en vez de tipear 290 a
-- mano y equivocarse en un cero.
--
-- El abono guarda igual sus propios números. Elegir el plan los
-- completa, pero después vive solo: si mañana Estándar sube a 320, el
-- cliente que firmó a 290 sigue en 290 hasta que alguien decida
-- cambiarlo. Un plan es un molde, no una atadura.
-- ------------------------------------------------------------------

create table if not exists planes_abono (
  clave           text primary key,
  nombre          text not null,
  monto           numeric(14,2) not null,
  moneda          char(3) not null default 'USD',
  incluido        integer not null,
  tamano_bloque   integer not null default 100,
  precio_bloque   numeric(14,2) not null default 35,
  max_bloques     integer not null default 2,
  orden           integer not null default 0,
  activo          boolean not null default true
);

insert into planes_abono (clave, nombre, monto, incluido, orden) values
  ('basico',   'Básico',   230, 100, 10),
  ('estandar', 'Estándar', 290, 300, 20),
  ('pro',      'Pro',      380, 600, 30)
on conflict (clave) do nothing;

alter table planes_abono enable row level security;

drop policy if exists planes_lectura on planes_abono;
create policy planes_lectura on planes_abono for select to authenticated using (true);

drop policy if exists planes_escritura on planes_abono;
create policy planes_escritura on planes_abono for all to authenticated
  using (es_direccion() or es_admin()) with check (es_direccion() or es_admin());

grant select on planes_abono to authenticated;
grant insert, update, delete on planes_abono to authenticated;


-- ------------------------------------------------------------------
-- 4. El tercer costo, y el margen en porcentaje.
-- ------------------------------------------------------------------

alter table consumos add column if not exists costo_otros numeric(14,2);
comment on column consumos.costo_otros is
  'Servidor, Make, webhooks: lo que no es Meta ni el modelo.';
