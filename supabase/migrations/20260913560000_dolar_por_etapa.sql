-- ------------------------------------------------------------------
-- La cotización que se pactó en cada etapa.
--
-- El proyecto ya tiene casa_cotizacion y cotizacion_pactada, y eso
-- alcanza mientras todo se cotiza junto. Deja de alcanzar con las
-- etapas pre-cotizadas: la Etapa 3 se presupuestó en marzo a 1.100 y se
-- activa en septiembre con el dólar a 1.545. Si la etapa no guarda a
-- cuánto se acordó, activarla la revalúa sola y el cliente recibe una
-- factura que no se parece a lo que aprobó.
--
-- Por eso la etapa puede guardar la suya. Vacía, sigue al proyecto, que
-- es lo normal: casi siempre se cotiza todo al mismo dólar y no hay que
-- decidir nada por etapa.
--
-- La cadena queda: la de la etapa, si no la del proyecto, si no la del
-- mercado para la casa que el proyecto eligió. Tres niveles, del más
-- específico al más general, y cada uno pisa al de arriba solo si está.
-- ------------------------------------------------------------------

alter table hitos add column if not exists casa_cotizacion text;
alter table hitos add column if not exists cotizacion_pactada numeric(14,4);

alter table hitos drop constraint if exists casa_del_hito;
alter table hitos add constraint casa_del_hito check (
  casa_cotizacion is null
  or casa_cotizacion in ('oficial','blue','bolsa','tarjeta','pactado')
);

comment on column hitos.cotizacion_pactada is
  'A cuánto se acordó el dólar de esta etapa. Vacía sigue al proyecto. Importa en las pre-cotizadas: se presupuestan hoy y se activan meses después.';

create or replace function cotizacion_del_hito(p_hito uuid, p_fecha date default current_date)
returns numeric
language sql stable
as $$
  select coalesce(
    -- 1. Lo que se pactó para esta etapa.
    h.cotizacion_pactada,
    case when h.casa_cotizacion is not null and h.casa_cotizacion <> 'pactado'
         then cotizacion_de('USD', h.casa_cotizacion, p_fecha) end,
    -- 2. Lo del proyecto.
    cotizacion_del_proyecto(h.proyecto_id, p_fecha)
  )
  from hitos h where h.id = p_hito;
$$;

grant execute on function cotizacion_del_hito(uuid, date) to authenticated;


-- La porción hereda la de su etapa, no la del proyecto: si la etapa
-- pactó su dólar, lo que se le liquida al equipo por esa etapa tiene
-- que salir del mismo número que se le facturó al cliente.
create or replace function cotizacion_de_porcion(p_porcion uuid)
returns numeric
language sql stable
as $$
  select coalesce(
    po.cotizacion_pago,
    case when po.moneda = 'ARS' then 1
         else cotizacion_del_hito(po.hito_id) end
  )
  from porciones po where po.id = p_porcion;
$$;

grant execute on function cotizacion_de_porcion(uuid) to authenticated;


-- v_precotizado dice a cuánto se cotizó y cuánto es hoy, que es la
-- comparación que hay que hacer antes de activarla.
drop view if exists v_precotizado;
create view v_precotizado
with (security_invoker = true)
as
select
  h.id as hito_id, h.proyecto_id, p.codigo,
  p.nombre as trabajo, p.organizacion_id,
  o.nombre_canonico as cliente,
  p.etapa, p.color, h.orden,
  h.titulo as etapa_nombre, h.entregable,
  h.monto_neto, h.moneda, h.vence_at,
  coalesce(h.casa_cotizacion, p.casa_cotizacion) as casa,
  cotizacion_del_hito(h.id)                       as cotizacion_acordada,
  cotizacion_de('USD', coalesce(h.casa_cotizacion, p.casa_cotizacion)) as cotizacion_hoy,
  case when h.moneda = 'ARS' then h.monto_neto
       else round(h.monto_neto * cotizacion_del_hito(h.id), 2) end as en_pesos,
  (p.etapa = 'ganado' or p.etapa is null) as ya_es_proyecto
from hitos h
join proyectos p      on p.id = h.proyecto_id
join organizaciones o on o.id = p.organizacion_id
where h.activo = false and p.archivado_at is null;

grant select on v_precotizado to authenticated;
