-- ============================================================
-- El reparto, y cerrar un mantenimiento.
--
-- El reparto era la pieza que faltaba y explica buena parte de la
-- confusión: el sistema calculaba porciones, liquidaciones y "cuánto
-- queda para Crossity" a partir de participaciones que NO se podían ver
-- ni cargar desde ninguna pantalla. Los números salían de algo
-- invisible, y un número que sale de algo invisible no se puede creer.
--
-- Y un mantenimiento necesita algo que un proyecto no: terminar. Un
-- proyecto se entrega; un abono se da de baja, en una fecha y por un
-- motivo. Sin eso la única salida era marcarlo perdido, que es otra
-- cosa: perdido es que salió mal.
-- ============================================================

-- ------------------------------------------------------------
-- Cargar y sacar participaciones.
-- ------------------------------------------------------------

create or replace function guardar_reparto(
  p_proyecto    uuid,
  p_persona     uuid,
  p_es_crossity boolean,
  p_concepto    concepto_participacion,
  p_porcentaje  numeric,
  p_apertura    apertura_participacion default 'cerrada'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_total numeric;
begin
  if not es_direccion() then
    raise exception 'Solo dirección define el reparto';
  end if;

  if p_porcentaje <= 0 or p_porcentaje > 100 then
    raise exception 'El porcentaje tiene que estar entre 0 y 100';
  end if;

  -- Se permite pasar de 100 y solo se avisa: hay acuerdos que se cargan
  -- en dos pasos, y bloquear el paso intermedio obliga a inventar un
  -- número para poder guardar, que es peor que un total mal por un rato.
  select coalesce(sum(porcentaje), 0) into v_total
    from participaciones
   where proyecto_id = p_proyecto
     and concepto = p_concepto
     and coalesce(persona_id::text, 'casa') <> coalesce(p_persona::text, 'casa');

  insert into participaciones (proyecto_id, persona_id, es_crossity, concepto, porcentaje, apertura)
  values (p_proyecto, case when p_es_crossity then null else p_persona end,
          p_es_crossity, p_concepto, p_porcentaje, p_apertura)
  on conflict (proyecto_id, persona_id, concepto) where persona_id is not null
    do update set porcentaje = excluded.porcentaje, apertura = excluded.apertura
  returning id into v_id;

  -- Las porciones ya calculadas se rehacen con el reparto nuevo.
  perform recalcular_porciones(h.id) from hitos h where h.proyecto_id = p_proyecto;

  return v_id;
end;
$$;

create or replace function quitar_reparto(p_participacion uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proyecto uuid;
  v_pagado   integer;
begin
  if not es_direccion() then
    raise exception 'Solo dirección define el reparto';
  end if;

  select pa.proyecto_id into v_proyecto from participaciones pa where pa.id = p_participacion;

  select count(*) into v_pagado
    from porciones po
   where po.participacion_id = p_participacion
     and po.estado in ('a_liquidar', 'liquidado');

  if v_pagado > 0 then
    raise exception 'Ya se le liquidó o hay plata lista para transferirle. Eso es historia y no se borra';
  end if;

  delete from participaciones where id = p_participacion;
  perform recalcular_porciones(h.id) from hitos h where h.proyecto_id = v_proyecto;
end;
$$;

grant execute on function guardar_reparto(uuid, uuid, boolean, concepto_participacion, numeric, apertura_participacion) to authenticated;
grant execute on function quitar_reparto(uuid) to authenticated;

comment on function guardar_reparto is
  'No bloquea si el total pasa de 100: avisa. Bloquear el paso intermedio obliga a inventar un número para poder guardar, que es peor que un total mal por un rato.';

-- ------------------------------------------------------------
-- El reparto de un proyecto, para poder mostrarlo.
-- ------------------------------------------------------------

create or replace view v_reparto
with (security_invoker = true)
as
select
  pa.id,
  pa.proyecto_id,
  pa.concepto,
  pa.porcentaje,
  pa.apertura,
  pa.es_crossity,
  pa.persona_id,
  coalesce(pe.nombre, 'Crossity') as quien,
  (select coalesce(sum(po.monto), 0) from porciones po where po.participacion_id = pa.id) as devengado,
  (select count(*) from porciones po
    where po.participacion_id = pa.id and po.estado in ('a_liquidar','liquidado')) as ya_movio
from participaciones pa
left join personas pe on pe.id = pa.persona_id;

grant select on v_reparto to authenticated;

-- ------------------------------------------------------------
-- Cerrar un mantenimiento.
--
-- Un proyecto se entrega; un abono se da de baja. Son cosas distintas y
-- merecen caminos distintos: marcar un abono como "perdido" diría que
-- salió mal, cuando lo normal es que simplemente terminó.
-- ------------------------------------------------------------

create or replace function cerrar_mantenimiento(
  p_proyecto uuid,
  p_hasta    date default current_date,
  p_motivo   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_tipo tipo_trabajo;
begin
  select tipo into v_tipo from proyectos where id = p_proyecto;

  if v_tipo is distinct from 'mantenimiento' then
    raise exception 'Esto no es un mantenimiento';
  end if;

  update proyectos
     set vigencia_hasta = p_hasta,
         renovacion_automatica = false,
         color = 'naranja',
         subestado = null,
         motivo_gris = null,
         motivo_rojo = null,
         motivo_condicion = coalesce(p_motivo, motivo_condicion)
   where id = p_proyecto;
end;
$$;

create or replace function reabrir_mantenimiento(p_proyecto uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update proyectos
     set vigencia_hasta = null,
         color = 'verde',
         subestado = 'en_curso',
         motivo_rojo = null,
         motivo_gris = null
   where id = p_proyecto and tipo = 'mantenimiento';
end;
$$;

grant execute on function cerrar_mantenimiento(uuid, date, text) to authenticated;
grant execute on function reabrir_mantenimiento(uuid) to authenticated;

comment on function cerrar_mantenimiento is
  'Se da de baja con fecha, no se marca perdido. Perdido diría que salió mal; lo normal es que simplemente terminó.';
