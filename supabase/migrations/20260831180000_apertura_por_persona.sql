-- ============================================================
-- La apertura se decide por persona Y por proyecto.
--
-- El rol dice qué puede hacer alguien. Cuánto ve de la economía de un
-- proyecto puntual no lo decide su rol: lo decide lo que se acordó para
-- ese proyecto. Claudio puede ser socio abierto donde también armó la
-- propuesta y estar a ciegas donde sólo desarrolla; Germán puede ver la
-- propuesta y los entregables sin ver nunca el reparto.
-- ============================================================

-- La apertura también vive en la asignación: se puede participar de un
-- proyecto sin llevarse un porcentaje.
alter table asignaciones
  add column apertura apertura_participacion not null default 'cerrada';

comment on column asignaciones.apertura is
  'Para quien interviene sin llevarse un porcentaje. Misma escala que la de las participaciones.';

-- Escala explícita, para no depender del orden del enum.
create or replace function rango_apertura(a apertura_participacion)
returns integer
language sql
immutable
as $$
  select case a
    when 'abierta'   then 3   -- el total del proyecto: monto, costos, base y su parte
    when 'comercial' then 2   -- la propuesta, el alcance, los entregables y si se cobró
    else 1                    -- sólo lo suyo
  end
$$;

-- Si alguien está por dos vías, manda la más abierta.
create or replace function apertura_en(p_proyecto uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(greatest(
    (select max(rango_apertura(pa.apertura)) from participaciones pa
      where pa.proyecto_id = p_proyecto and pa.persona_id = persona_actual()),
    (select max(rango_apertura(a.apertura)) from asignaciones a
      where a.proyecto_id = p_proyecto and a.persona_id = persona_actual()
        and a.hasta is null)
  ), 0)
$$;

-- ------------------------------------------------------------
-- Las tres puertas, ahora por persona y proyecto.
-- ------------------------------------------------------------

-- La propuesta, el alcance, los entregables y si el cliente pagó.
create or replace function ve_facturacion_de(p_proyecto uuid)
returns boolean
language sql
stable
as $$ select es_direccion() or es_admin() or apertura_en(p_proyecto) >= 2 $$;

-- El total del proyecto: costos, base de reparto, todo.
create or replace function ve_economia_de(p_proyecto uuid)
returns boolean
language sql
stable
as $$ select es_direccion() or es_admin() or apertura_en(p_proyecto) >= 3 $$;

comment on function ve_economia_de is
  'Los gastos van acá y no en facturación: un desarrollador contratado a monto fijo entra como gasto, así que revelan el arreglo igual que las participaciones.';

-- Compatibilidad: quedaba usada en la política de cobros.
create or replace function apertura_abierta_en(p_proyecto uuid)
returns boolean
language sql
stable
as $$ select apertura_en(p_proyecto) >= 3 $$;

-- ------------------------------------------------------------
-- Quién ve qué, resumido, para poder auditarlo de un vistazo.
-- ------------------------------------------------------------

create or replace view v_quien_ve_que
with (security_invoker = true)
as
with vinculos as (
  -- por participación: lleva porcentaje
  select pa.proyecto_id, pa.persona_id, pa.concepto::text as interviene,
         pa.porcentaje, rango_apertura(pa.apertura) as nivel
    from participaciones pa
   where pa.persona_id is not null
  union all
  -- por asignación: interviene sin llevarse un porcentaje
  select a.proyecto_id, a.persona_id, a.rol::text, null::numeric,
         rango_apertura(a.apertura)
    from asignaciones a
   where a.hasta is null
)
select
  p.codigo,
  p.nombre          as proyecto,
  o.nombre_canonico as cliente,
  pe.nombre         as persona,
  string_agg(distinct v.interviene, ' · ' order by v.interviene) as interviene_como,
  max(v.porcentaje) as porcentaje,
  max(v.nivel)      as nivel,
  case max(v.nivel)
    when 3 then 'el total del proyecto'
    when 2 then 'la propuesta y los entregables'
    else        'sólo lo suyo'
  end               as ve
from vinculos v
join proyectos p      on p.id = v.proyecto_id
join organizaciones o on o.id = p.organizacion_id
join personas pe      on pe.id = v.persona_id
group by p.codigo, p.nombre, o.nombre_canonico, pe.nombre;

comment on view v_quien_ve_que is
  'Un permiso que no se puede leer de un vistazo es un permiso que nadie revisa.';

grant select on v_quien_ve_que to authenticated;
