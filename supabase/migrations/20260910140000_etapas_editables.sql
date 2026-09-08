-- ============================================================
-- Las etapas del embudo, editables.
--
-- Estaban como enum de Postgres: agregar una era una migración, y
-- moverlas de lugar imposible sin recrear el tipo. Eso está bien para
-- algo que no cambia; el embudo comercial cambia, porque es la forma en
-- que la agencia trabaja y esa forma se ajusta con el tiempo.
--
-- La columna pasa a texto con clave foránea. Todas las comparaciones
-- del sistema son contra literales ('ganado', 'cotizado'), así que
-- siguen valiendo exactamente igual.
--
-- Una sola etapa es intocable: 'ganado'. No es una etapa más, es la
-- puerta por donde una oportunidad se convierte en proyecto, y hay
-- funciones que dependen de ella. Se puede renombrar lo que se ve, no
-- lo que significa.
-- ============================================================

create table etapas (
  clave     text primary key,
  etiqueta  text not null,
  orden     integer not null,
  activa    boolean not null default true,
  es_final  boolean not null default false,
  ayuda     text
);

insert into etapas (clave, etiqueta, orden, es_final, ayuda) values
  ('interes',        'Interés',        10, false, 'Apareció. Sabemos que existe y de dónde vino'),
  ('primera_charla', 'Primera charla', 20, false, 'Hubo contacto real, se habló'),
  ('relevamiento',   'Relevamiento',   30, false, 'Se está entendiendo qué necesita'),
  ('a_cotizar',      'A cotizar',      40, false, 'Hay que armar la propuesta. Es trabajo nuestro'),
  ('cotizado',       'Cotizado',       50, false, 'Se envió y estamos esperando. Es tiempo del cliente'),
  ('negociacion',    'Negociación',    60, false, 'Contestó, se está ajustando'),
  ('ganado',         'Ganado',         99, true,  'Se convierte en proyecto');

-- La etapa vieja queda por si algún registro sobrevivió sin migrar.
insert into etapas (clave, etiqueta, orden, activa, ayuda)
values ('cotizacion', 'Cotización (vieja)', 45, false, 'Reemplazada por A cotizar y Cotizado')
on conflict do nothing;

-- Las vistas que leen la columna hay que soltarlas para poder cambiarle
-- el tipo, y volver a crearlas igual que estaban después.
drop view if exists v_estado_general;
drop view if exists v_pipeline;
drop view if exists v_tablero;

alter table proyectos
  alter column etapa type text using etapa::text;

alter table proyectos
  add constraint etapa_conocida foreign key (etapa) references etapas(clave);

create view v_tablero
with (security_invoker = true)
as
select
  p.id, p.codigo, p.nombre,
  o.nombre_canonico as cliente,
  o.codigo          as cliente_codigo,
  p.color, p.subestado, p.motivo_gris, p.prioridad, p.fecha_comprometida,
  p.es_producto_propio, p.condicion, p.tipo,
  r.nombre          as responsable,
  (current_date - p.fecha_comprometida) as dias_de_atraso,
  extract(day from now() - coalesce(
      (select max(a.ocurrido_at) from actualizaciones a where a.proyecto_id = p.id),
      p.created_at))::int as dias_sin_novedades
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas r  on r.id = p.responsable_id
where p.tipo = 'proyecto'
  and (p.etapa is null or p.etapa = 'ganado');

create view v_pipeline
with (security_invoker = true)
as
select
  p.id, p.codigo, p.nombre,
  o.nombre_canonico as cliente,
  p.etapa, p.nurturing, p.origen, p.origen_detalle,
  p.monto_neto, p.moneda, p.proxima_accion, p.proximo_seguimiento,
  pe.nombre as vendedor,
  (p.proximo_seguimiento is null)                                        as sin_agendar,
  (p.proximo_seguimiento < now())                                        as seguimiento_vencido,
  (p.etapa in ('cotizado','negociacion') and p.nurturing <> 'completado') as negocia_sin_base,
  (p.etapa in ('cotizado','negociacion') and p.monto_neto is null)        as cotizado_sin_monto,
  (p.color = 'gris' and p.motivo_gris = 'no_se_dio')                     as enfriada
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas pe on pe.id = p.responsable_id
where p.etapa is not null
  and p.etapa <> 'ganado'
  and (p.color = 'amarillo' or (p.color = 'gris' and p.motivo_gris = 'no_se_dio'));

create view v_estado_general
with (security_invoker = true)
as
select
  (select count(*) from proyectos where color = 'verde' and tipo = 'proyecto')  as en_vivo,
  (select count(*) from proyectos p
    where p.color = 'verde' and p.fecha_comprometida is not null
      and p.fecha_comprometida < current_date)                                  as atrasados,
  (select count(*) from proyectos p join v_pulso v on v.id = p.id
    where p.color = 'verde' and v.dias_sin_novedades > 7)                       as frenados,
  (select count(*) from proyectos
    where color = 'amarillo' and etapa is not null and etapa <> 'ganado')       as en_pipeline,
  (select count(*) from proyectos
    where color = 'amarillo' and proximo_seguimiento is not null
      and proximo_seguimiento < now())                                          as seguimientos_vencidos,
  (select coalesce(sum(monto_neto), 0) from hitos
    where moneda = 'ARS' and facturado_at is not null and cobrado_at is null)   as por_cobrar,
  (select count(*) from proyectos where tipo = 'mantenimiento' and color = 'verde') as abonos;

grant select on v_tablero, v_pipeline, v_estado_general to authenticated;

alter table etapas enable row level security;

create policy etapas_lectura on etapas for select to authenticated using (true);
grant select on etapas to authenticated;

comment on table etapas is
  'El embudo cambia porque es la forma en que la agencia trabaja, y esa forma se ajusta. Por eso está acá y no en el código.';

comment on column etapas.es_final is
  'Ganado no es una etapa más: es la puerta por donde una oportunidad se vuelve proyecto, y hay funciones que dependen de ella.';

-- ------------------------------------------------------------
-- Los estados de proyecto son otra cosa.
--
-- El color no es una etiqueta: es comportamiento. Gris exige un motivo,
-- verde exige un subestado, naranja cierra el trabajo. Renombrar lo que
-- se ve está bien; agregar un sexto color rompería reglas de la base
-- que existen por buenas razones. Por eso acá solo se edita el texto.
-- ------------------------------------------------------------

create table estados_proyecto (
  color    color_estado primary key,
  etiqueta text not null,
  ayuda    text not null,
  orden    integer not null
);

insert into estados_proyecto (color, etiqueta, ayuda, orden) values
  ('verde',    'En vivo',   'se trabaja ahora',        10),
  ('gris',     'Frenado',   'ganado y sin avanzar',    20),
  ('naranja',  'Terminado', 'no hay más que hacer',    30),
  ('rojo',     'Perdido',   'salió mal o se descartó', 40),
  ('amarillo', 'A seguir',  'la pelota está del otro lado', 15);

alter table estados_proyecto enable row level security;
create policy estados_lectura on estados_proyecto for select to authenticated using (true);
grant select on estados_proyecto to authenticated;

comment on table estados_proyecto is
  'Solo el texto. El color es comportamiento: gris exige motivo, verde exige subestado, naranja cierra. Un sexto color rompería reglas que existen por buenas razones.';

-- ------------------------------------------------------------
-- Editar, por función: solo dirección, y con las protecciones puestas.
-- ------------------------------------------------------------

create or replace function guardar_etapa(
  p_clave    text,
  p_etiqueta text,
  p_ayuda    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_orden integer;
begin
  if not es_direccion() then
    raise exception 'Solo dirección edita las etapas';
  end if;

  if trim(p_etiqueta) = '' then
    raise exception 'La etapa necesita un nombre';
  end if;

  if exists (select 1 from etapas where clave = p_clave) then
    update etapas set etiqueta = trim(p_etiqueta), ayuda = p_ayuda where clave = p_clave;
  else
    -- Va antes de 'ganado', que siempre queda al final.
    select coalesce(max(orden), 0) + 10 into v_orden from etapas where not es_final;
    insert into etapas (clave, etiqueta, orden, ayuda) values (p_clave, trim(p_etiqueta), v_orden, p_ayuda);
  end if;
end;
$$;

create or replace function mover_etapa(p_clave text, p_hacia integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden  integer;
  v_vecina text;
  v_vecino integer;
begin
  if not es_direccion() then
    raise exception 'Solo dirección edita las etapas';
  end if;

  select orden into v_orden from etapas where clave = p_clave and not es_final;
  if v_orden is null then
    raise exception 'Esa etapa no se puede mover';
  end if;

  -- Se intercambia con la vecina: mover de a una deja el orden siempre
  -- consistente, sin renumerar todo y sin huecos.
  if p_hacia < 0 then
    select clave, orden into v_vecina, v_vecino from etapas
     where orden < v_orden and not es_final order by orden desc limit 1;
  else
    select clave, orden into v_vecina, v_vecino from etapas
     where orden > v_orden and not es_final order by orden asc limit 1;
  end if;

  if v_vecina is null then return; end if;

  update etapas set orden = v_vecino where clave = p_clave;
  update etapas set orden = v_orden  where clave = v_vecina;
end;
$$;

create or replace function apagar_etapa(p_clave text, p_activa boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_cuantos integer;
begin
  if not es_direccion() then
    raise exception 'Solo dirección edita las etapas';
  end if;

  if exists (select 1 from etapas where clave = p_clave and es_final) then
    raise exception 'Ganado no se puede apagar: es por donde una oportunidad pasa a proyecto';
  end if;

  if not p_activa then
    select count(*) into v_cuantos from proyectos where etapa = p_clave;
    if v_cuantos > 0 then
      raise exception 'Hay % oportunidades en esa etapa. Movelas antes de apagarla', v_cuantos;
    end if;
  end if;

  update etapas set activa = p_activa where clave = p_clave;
end;
$$;

create or replace function renombrar_estado(p_color color_estado, p_etiqueta text, p_ayuda text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_direccion() then
    raise exception 'Solo dirección renombra los estados';
  end if;
  if trim(p_etiqueta) = '' then
    raise exception 'El estado necesita un nombre';
  end if;
  update estados_proyecto
     set etiqueta = trim(p_etiqueta), ayuda = trim(p_ayuda)
   where color = p_color;
end;
$$;

grant execute on function guardar_etapa(text, text, text) to authenticated;
grant execute on function mover_etapa(text, integer) to authenticated;
grant execute on function apagar_etapa(text, boolean) to authenticated;
grant execute on function renombrar_estado(color_estado, text, text) to authenticated;

-- Cuántas oportunidades hay en cada etapa: apagar una con gente adentro
-- no debería siquiera intentarse.
create or replace view v_etapas
with (security_invoker = true)
as
select
  e.*,
  (select count(*) from proyectos p where p.etapa = e.clave) as cuantas
from etapas e
order by e.orden;

grant select on v_etapas to authenticated;
