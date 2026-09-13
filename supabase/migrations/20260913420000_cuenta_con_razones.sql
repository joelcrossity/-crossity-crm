-- v_cuenta suma los nombres de las razones sociales, para que el
-- selector encuentre al cliente escribiendo la sociedad por la que
-- factura. Pasa seguido: uno se acuerda de "Gastronómica del Litoral
-- SRL" y no del nombre de fantasía con el que está cargado.
--
-- razones_sociales sigue siendo el conteo y no se toca: lo usa la lista
-- de clientes para mostrar cuántas tiene. La columna nueva va al final,
-- que es donde create or replace view deja agregar.
create or replace view v_cuenta
with (security_invoker = true)
as
 SELECT o.id, o.codigo, o.nombre_canonico AS cuenta,
    (SELECT count(*) FROM razones_sociales r WHERE r.organizacion_id = o.id) AS razones_sociales,
    (SELECT string_agg(m.nombre, ' · ' ORDER BY m.nombre) FROM marcas m
      WHERE m.organizacion_id = o.id) AS marcas,
    count(*) FILTER (WHERE p.color = 'verde'::color_estado) AS en_vivo,
    count(*) FILTER (WHERE p.color = 'amarillo'::color_estado) AS en_pipeline,
    count(*) FILTER (WHERE p.tipo = 'mantenimiento'::tipo_trabajo AND (p.color <> ALL (ARRAY['rojo'::color_estado, 'naranja'::color_estado]))) AS abonos,
    count(*) FILTER (WHERE p.condicion = 'bonificado'::condicion_comercial) AS bonificados,
    count(*) AS proyectos_totales,
    coalesce(o.alias, '{}') AS alias,
    o.cuit,
    (SELECT array_remove(array_agg(distinct x), null) FROM unnest(
       array[o.cuit_normalizado] ||
       coalesce((select array_agg(r.cuit_normalizado) from razones_sociales r
                  where r.organizacion_id = o.id), '{}')) x) AS cuits,
    (SELECT string_agg(r.razon_social, ' · ' ORDER BY r.razon_social)
       FROM razones_sociales r WHERE r.organizacion_id = o.id) AS razones
   FROM organizaciones o
     LEFT JOIN proyectos p ON p.organizacion_id = o.id
  GROUP BY o.id, o.codigo, o.nombre_canonico, o.alias, o.cuit, o.cuit_normalizado;

grant select on v_cuenta to authenticated;
