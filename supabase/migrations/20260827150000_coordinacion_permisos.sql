-- ============================================================
-- Coordinación ve la operación completa, no la plata.
-- ============================================================

create or replace function es_coordinacion()
returns boolean language sql stable as $$ select tiene_rol('coordinacion') $$;

-- ve_todo() rige la operación: proyectos, clientes, estado.
-- La economía sigue decidiéndose por participación, no por rol.
create or replace function ve_todo()
returns boolean
language sql
stable
as $$ select es_direccion() or es_admin() or es_pm() or es_coordinacion() $$;

-- Pero la plata no: coordinación queda fuera de gastos, impuestos y cobros,
-- salvo que tenga participación abierta en ese proyecto.
create or replace function ve_economia_de(p_proyecto uuid)
returns boolean
language sql
stable
as $$
  select es_direccion() or es_admin() or es_pm() or apertura_abierta_en(p_proyecto)
$$;

comment on function es_coordinacion() is
  'Coordina la ejecución: necesita ver todos los proyectos y sus tiempos, no los números.';
