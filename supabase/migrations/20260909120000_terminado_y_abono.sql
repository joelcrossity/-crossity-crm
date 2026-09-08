-- ============================================================
-- Lo que pasa después de terminar.
--
-- Dos cosas que quedaron desalineadas cuando se separó "terminado" de
-- "perdido" con el color naranja:
--
-- 1. v_sin_mantenimiento seguía buscando rojo + entregado. Desde que
--    los terminados van a naranja, esa vista no encuentra nunca nada:
--    la pregunta "¿a éste le abrimos el abono?" dejó de hacerse sola.
--
-- 2. Terminar un proyecto es el momento exacto en que se decide si hay
--    mantenimiento, y es también el momento en que nadie se acuerda,
--    porque el proyecto ya salió de la vista. Va a la campanita.
-- ============================================================

create or replace view v_sin_mantenimiento
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico as cliente,
  p.fecha_comprometida
from proyectos p
join organizaciones o on o.id = p.organizacion_id
where p.tipo = 'proyecto'
  -- Naranja es el terminado de hoy; el rojo+entregado quedó de antes.
  and (p.color = 'naranja' or (p.color = 'rojo' and p.motivo_rojo = 'entregado'))
  and not exists (select 1 from proyectos m where m.origen_id = p.id);

comment on view v_sin_mantenimiento is
  'Se entregó y nadie abrió el abono. Es plata recurrente que se pierde por no preguntar a tiempo.';

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

select
  's' || p.id, 'seguimiento', p.proximo_seguimiento,
  'Había que ' || lower(coalesce(p.proxima_accion, 'volver a hablar')),
  p.nombre, p.codigo, false, 'alta'
from proyectos p
where p.color = 'amarillo'
  and p.proximo_seguimiento is not null
  and p.proximo_seguimiento < now()

union all

select
  'q' || p.id, 'frenado', now() - (v.dias_sin_novedades || ' days')::interval,
  v.dias_sin_novedades || ' días sin novedades',
  p.nombre, p.codigo, false, 'normal'
from proyectos p
join v_pulso v on v.id = p.id
where p.color = 'verde' and v.dias_sin_novedades > 7

union all

select
  'a' || p.id, 'anticipo', p.created_at,
  'No arranca hasta que entre el anticipo',
  p.nombre, p.codigo, false, 'alta'
from proyectos p
where p.color = 'gris' and p.motivo_gris = 'esperando_anticipo'

union all

select
  'c' || c.id, 'comision', now(),
  'Vino por ' || c.referente || ' y su comisión no está acordada',
  c.nombre, c.codigo, false, 'normal'
from v_comisiones_sin_acordar c

union all

-- Terminó y nadie preguntó por el abono
select
  'm' || m.id, 'abono', now(),
  'Se entregó y no tiene mantenimiento abierto',
  m.nombre, m.codigo, false, 'normal'
from v_sin_mantenimiento m;

grant select on v_campanita_futuro, v_sin_mantenimiento to authenticated;
