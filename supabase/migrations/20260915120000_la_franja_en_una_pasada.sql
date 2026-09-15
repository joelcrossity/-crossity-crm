-- ------------------------------------------------------------------
-- El censo de la franja en una pasada, no una consulta por casillero.
--
-- La franja se dibuja en todas las pantallas, así que su costo se paga
-- en cada navegación. Y se estaba pagando caro: preguntaba
-- cae_en_columna(proyecto, columna) para cada proyecto contra cada
-- columna, y esa función hace su propio join más un NOT EXISTS adentro.
-- Con dieciocho proyectos y cinco columnas son noventa consultas
-- anidadas, cada una evaluando además las reglas de fila de proyectos.
--
-- Andaba bien con seis proyectos. Crece multiplicando, así que el día
-- que no ande va a parecer que se rompió algo de golpe, y no: venía
-- empeorando desde el principio.
--
-- Ahora se resuelve al revés: se recorre proyectos una sola vez y a
-- cada uno se le busca su columna. La regla es la misma de siempre y
-- está dicha igual, sólo que una vez por proyecto en vez de una vez por
-- casillero: la columna que declara su detalle se lleva lo que coincide
-- exacto, y la que no lo declara es el comodín de su color.
--
-- cae_en_columna se queda: la usa el tablero para repartir tarjetas, y
-- ahí sí se pregunta de a una.
-- ------------------------------------------------------------------

drop view if exists v_estado_general;

create view v_estado_general
with (security_invoker = true)
as
with vivos as (
  select
    p.id, p.tipo, p.etapa, p.color::text as color,
    p.monto_mensual, p.vigencia_desde,
    case p.color::text
      when 'verde' then p.subestado::text
      when 'gris'  then p.motivo_gris::text
      else              p.motivo_rojo::text
    end as detalle
  from proyectos p
  where p.archivado_at is null
),
ubicados as (
  select
    v.*,
    -- Primero la columna que pide este detalle exacto; si ninguna lo
    -- pide, la que no declara detalle, que es el comodín del color.
    coalesce(
      (select c.clave from columnas_tablero c
        where c.color::text = v.color and c.detalle is not distinct from v.detalle
        limit 1),
      (select c.clave from columnas_tablero c
        where c.color::text = v.color and c.detalle is null
        limit 1)
    ) as columna
  from vivos v
),
arriba as (
  select u.*, c.etiqueta, c.orden
    from ubicados u
    join columnas_tablero c on c.clave = u.columna
   where c.zona = 'arriba'
     and u.tipo = 'proyecto'
     and (u.etapa is null or u.etapa = 'ganado')
)
select
  (select count(*) from arriba) as proyectos,

  (select coalesce(
            jsonb_agg(jsonb_build_object('etiqueta', x.etiqueta, 'n', x.n)
                      order by x.orden),
            '[]'::jsonb)
     from (select a.etiqueta, a.orden, count(*) as n
             from arriba a group by a.etiqueta, a.orden) x) as por_estado,

  (select count(*) from vivos v
    where v.tipo = 'mantenimiento' and v.color = 'verde'
      and (v.vigencia_desde is null or v.vigencia_desde <= current_date)) as abonos,

  (select count(*) from vivos v
    where v.color = 'amarillo' and v.etapa is not null and v.etapa <> 'ganado')
    as en_pipeline;

grant select on v_estado_general to authenticated;

comment on view v_estado_general is
  'Un censo para la franja: cuántos proyectos y en qué estado, cuántos abonos, cuántas oportunidades. Se resuelve en una pasada porque se dibuja en todas las pantallas.';


-- ------------------------------------------------------------------
-- Y un índice que faltaba.
--
-- v_tablero pregunta abono_cotizado(proyecto) por cada fila, y esa
-- función entra a etapas_cotizacion buscando por proyecto_id. Sin
-- índice, cada fila recorre la tabla entera: dieciocho proyectos son
-- dieciocho recorridas completas por cada vez que se abre el tablero.
--
-- Postgres no indexa solo las claves foráneas. Es de las cosas que no
-- se notan hasta que hay datos, y para cuando se notan parece que se
-- rompió algo de golpe.
-- ------------------------------------------------------------------

create index if not exists etapas_cot_por_proyecto
  on etapas_cotizacion (proyecto_id);
