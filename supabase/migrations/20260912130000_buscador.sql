-- ============================================================
-- El buscador de todo.
--
-- Una sola vista con lo que alguien puede querer encontrar escribiendo
-- tres letras: proyectos, clientes y personas. Hereda la RLS de cada
-- tabla, así que cada uno encuentra solo lo que ya podía ver.
--
-- La alternativa era buscar en cada pantalla por separado, que obliga a
-- saber de antemano en cuál está lo que se busca. Y si hay que saberlo,
-- ya no hace falta buscar.
-- ============================================================

create or replace view v_buscar
with (security_invoker = true)
as
select
  'proyecto'::text  as clase,
  p.id,
  p.nombre          as titulo,
  o.nombre_canonico as detalle,
  p.codigo          as codigo,
  '/proyecto/' || p.codigo as adonde,
  p.color           as señal,
  (p.nombre || ' ' || o.nombre_canonico || ' ' || p.codigo) as texto
from proyectos p
join organizaciones o on o.id = p.organizacion_id

union all

select
  'cliente',
  o.id,
  o.nombre_canonico,
  coalesce(array_to_string(o.alias, ', '), ''),
  o.codigo,
  '/cuentas/' || o.codigo,
  null,
  (o.nombre_canonico || ' ' || o.codigo || ' ' || coalesce(array_to_string(o.alias, ' '), ''))
from organizaciones o
where not o.es_provisoria

union all

select
  'persona',
  pe.id,
  pe.nombre,
  coalesce(array_to_string(array(select r::text from unnest(pe.roles) r), ', '), 'sin rol'),
  null,
  '/equipo',
  null,
  (pe.nombre || ' ' || coalesce(pe.email, ''))
from personas pe
where pe.activa;

grant select on v_buscar to authenticated;

comment on view v_buscar is
  'Buscar por pantalla obliga a saber de antemano en cuál está lo que se busca. Si hay que saberlo, ya no hace falta buscar.';
