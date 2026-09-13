-- ------------------------------------------------------------------
-- v_cuenta suma los alias, para que el buscador del selector los
-- encuentre.
--
-- Después de fusionar, el nombre viejo queda como alias. Si el selector
-- no busca ahí, el que escribe "Leffler - Dietz" no encuentra nada y
-- crea el duplicado otra vez, que es exactamente lo que la fusión vino
-- a arreglar.
--
-- La columna va al final: create or replace view deja agregar columnas
-- pero no insertarlas en el medio ni renombrarlas.
-- ------------------------------------------------------------------

create or replace view v_cuenta
with (security_invoker = true)
as
 SELECT o.id,
    o.codigo,
    o.nombre_canonico AS cuenta,
    ( SELECT count(*) AS count
           FROM razones_sociales r
          WHERE r.organizacion_id = o.id) AS razones_sociales,
    ( SELECT string_agg(m.nombre, ' · '::text ORDER BY m.nombre) AS string_agg
           FROM marcas m
          WHERE m.organizacion_id = o.id) AS marcas,
    count(*) FILTER (WHERE p.color = 'verde'::color_estado) AS en_vivo,
    count(*) FILTER (WHERE p.color = 'amarillo'::color_estado) AS en_pipeline,
    count(*) FILTER (WHERE p.tipo = 'mantenimiento'::tipo_trabajo AND (p.color <> ALL (ARRAY['rojo'::color_estado, 'naranja'::color_estado]))) AS abonos,
    count(*) FILTER (WHERE p.condicion = 'bonificado'::condicion_comercial) AS bonificados,
    count(*) AS proyectos_totales,
    coalesce(o.alias, '{}') AS alias
   FROM organizaciones o
     LEFT JOIN proyectos p ON p.organizacion_id = o.id
  GROUP BY o.id, o.codigo, o.nombre_canonico, o.alias;

grant select on v_cuenta to authenticated;
