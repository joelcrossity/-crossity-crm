-- ============================================================
-- Anotar una charla cuando todavía no se sabe de quién es.
--
-- Te llaman, hablás veinte minutos y colgás sin saber ni el nombre de
-- la empresa. Si el formulario exige elegir un cliente en ese momento,
-- la charla no se carga. Y la charla que no se carga es exactamente la
-- que se pierde.
--
-- El proyecto necesita una organización sí o sí —está en la base y lo
-- usan diez vistas—, así que en vez de aflojar esa regla se agrega una
-- cuenta provisoria donde esperan las charlas hasta tener nombre. Que
-- queden visibles ahí, juntas, es además una señal útil: son las que
-- todavía no se sabe de quién son.
-- ============================================================

alter table organizaciones
  add column es_provisoria boolean not null default false;

comment on column organizaciones.es_provisoria is
  'La cuenta donde esperan las charlas sin cliente. No es un cliente: es una sala de espera.';

create unique index organizaciones_una_provisoria on organizaciones (es_provisoria)
  where es_provisoria;

insert into organizaciones (nombre_canonico, alias, es_provisoria)
values ('Sin identificar', '{}', true);

create or replace function cuenta_provisoria()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select id from organizaciones where es_provisoria limit 1 $$;

grant execute on function cuenta_provisoria() to authenticated;

-- ------------------------------------------------------------
-- Las que están esperando nombre.
-- ------------------------------------------------------------

create or replace view v_sin_cliente
with (security_invoker = true)
as
select p.id, p.codigo, p.nombre, p.created_at, p.proxima_accion, p.proximo_seguimiento
from proyectos p
join organizaciones o on o.id = p.organizacion_id
where o.es_provisoria;

grant select on v_sin_cliente to authenticated;

comment on view v_sin_cliente is
  'Charlas anotadas sin saber de quién eran. Sirven igual, pero no cierran hasta tener cliente.';

-- Y que suene, para que no se queden ahí para siempre.
create or replace view v_campanita_futuro
with (security_invoker = true)
as
select
  'f' || p.id                         as clave,
  'fecha'::text                       as clase,
  (p.fecha_comprometida::timestamptz) as momento,
  case
    when p.fecha_comprometida < current_date then
      'Pasó la fecha de entrega hace ' || (current_date - p.fecha_comprometida) || ' días'
    when p.fecha_comprometida = current_date then 'Se entrega hoy'
    else 'Se entrega en ' || (p.fecha_comprometida - current_date) || ' días'
  end                                 as titulo,
  p.nombre                            as proyecto,
  p.codigo                            as codigo,
  false                               as es_mi_plata,
  case when p.fecha_comprometida <= current_date then 'alta' else 'normal' end as urgencia
from proyectos p
where p.color = 'verde'
  and p.fecha_comprometida is not null
  and p.fecha_comprometida <= current_date + 7

union all
select 's' || p.id, 'seguimiento', p.proximo_seguimiento,
  'Había que ' || lower(coalesce(p.proxima_accion, 'volver a hablar')),
  p.nombre, p.codigo, false, 'alta'
from proyectos p
where p.color = 'amarillo' and p.proximo_seguimiento is not null and p.proximo_seguimiento < now()

union all
select 'q' || p.id, 'frenado', now() - (v.dias_sin_novedades || ' days')::interval,
  v.dias_sin_novedades || ' días sin novedades', p.nombre, p.codigo, false, 'normal'
from proyectos p join v_pulso v on v.id = p.id
where p.color = 'verde' and v.dias_sin_novedades > 7

union all
select 'a' || p.id, 'anticipo', p.created_at,
  'No arranca hasta que entre el anticipo', p.nombre, p.codigo, false, 'alta'
from proyectos p
where p.color = 'gris' and p.motivo_gris = 'esperando_anticipo'

union all
select 'c' || c.id, 'comision', now(),
  'Vino por ' || c.referente || ' y su comisión no está acordada',
  c.nombre, c.codigo, false, 'normal'
from v_comisiones_sin_acordar c

union all
select 'm' || m.id, 'abono', now(),
  'Se entregó y no tiene mantenimiento abierto', m.nombre, m.codigo, false, 'normal'
from v_sin_mantenimiento m

union all
select 'n' || s.id, 'sin_cliente', s.created_at,
  'Falta decir de qué cliente es', s.nombre, s.codigo, false, 'normal'
from v_sin_cliente s;

grant select on v_campanita_futuro to authenticated;
