-- ============================================================
-- Cotizado, y lo que se enfrió.
--
-- Lo que ya estaba en 'cotizacion' significaba, según el comentario
-- original, "se armó y se envió la propuesta". Ésas pasan a 'cotizado'.
-- La etapa vieja queda en el enum porque Postgres no deja sacarla, pero
-- ya no se usa.
--
-- Y la parte importante: dónde descansa una cotización que se mandó y
-- nunca tuvo respuesta.
--
-- No es una etapa más. Una etapa dice hasta dónde llegó la conversación,
-- y eso no cambia porque el cliente deje de contestar: sigue siendo una
-- cotización enviada. Lo que cambia es que está fría. Por eso se guarda
-- como estado (gris, no_se_dio) CONSERVANDO la etapa, y por eso volver
-- a levantarla es gratis: la conversación retoma donde estaba, no desde
-- el principio.
-- ============================================================

update proyectos set etapa = 'cotizado' where etapa = 'cotizacion';

-- Las señales del pipeline miran las dos etapas nuevas. Se recrea en
-- vez de reemplazarse porque cambian las columnas, y `create or replace`
-- no deja cambiar nombres ni orden.
drop view if exists v_pipeline;

create view v_pipeline
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico as cliente,
  p.etapa,
  p.nurturing,
  p.origen,
  p.origen_detalle,
  p.monto_neto,
  p.moneda,
  p.proxima_accion,
  p.proximo_seguimiento,
  pe.nombre as vendedor,
  (p.proximo_seguimiento is null)                                  as sin_agendar,
  (p.proximo_seguimiento < now())                                  as seguimiento_vencido,
  (p.etapa in ('cotizado','negociacion') and p.nurturing <> 'completado') as negocia_sin_base,
  (p.etapa in ('cotizado','negociacion') and p.monto_neto is null)        as cotizado_sin_monto,
  -- Se mandó la cotización y se apagó. Sigue viva, solo que fría.
  (p.color = 'gris' and p.motivo_gris = 'no_se_dio')               as enfriada
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas pe on pe.id = p.responsable_id
where p.etapa is not null
  and p.etapa <> 'ganado'
  and (
    p.color = 'amarillo'
    -- Las enfriadas siguen en el tablero, en su propia columna.
    or (p.color = 'gris' and p.motivo_gris = 'no_se_dio')
  );

grant select on v_pipeline to authenticated;

comment on view v_pipeline is
  'Incluye las enfriadas. Sacarlas del tablero era la forma segura de que nadie las volviera a mirar.';

-- ------------------------------------------------------------
-- Enfriar y volver a levantar.
--
-- Enfriar conserva la etapa: la conversación llegó hasta donde llegó.
-- Levantarla la devuelve exactamente ahí, no al principio.
-- ------------------------------------------------------------

create or replace function enfriar(p_proyecto uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update proyectos
     set color = 'gris',
         motivo_gris = 'no_se_dio',
         subestado = null,
         motivo_condicion = coalesce(p_motivo, motivo_condicion),
         proxima_accion = null,
         proximo_seguimiento = null
   where id = p_proyecto
     and etapa is not null
     and etapa <> 'ganado';
end;
$$;

create or replace function reflotar(p_proyecto uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update proyectos
     set color = 'amarillo',
         motivo_gris = null,
         proxima_accion = 'Volver a escribirle'
   where id = p_proyecto
     and color = 'gris';
end;
$$;

grant execute on function enfriar(uuid, text) to authenticated;
grant execute on function reflotar(uuid) to authenticated;

comment on function enfriar is
  'Conserva la etapa. Que el cliente deje de contestar no borra hasta dónde se había llegado.';
