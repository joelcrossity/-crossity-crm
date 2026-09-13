-- ------------------------------------------------------------------
-- La franja decía "4 en vivo, 5 frenados".
--
-- Un subconjunto más grande que el conjunto. La cuenta de "en vivo"
-- filtra tipo = 'proyecto' y la de al lado no, así que sumaba también
-- los abonos sin novedades. Dos cuentas sobre lo mismo con reglas
-- distintas: cualquiera que las mire juntas concluye que el sistema
-- está mal, y esta vez tenía razón.
--
-- Y el nombre dejó de significar lo que decía. "Frenados" era la
-- columna gris del tablero, que ya no existe; esto siempre midió otra
-- cosa: proyectos verdes de los que no se sabe nada hace más de una
-- semana. Se llama sin_novedades, que es lo que cuenta.
-- ------------------------------------------------------------------

create or replace view v_estado_general
with (security_invoker = true)
as
 SELECT ( SELECT count(*) FROM proyectos p
          WHERE p.color = 'verde'::color_estado AND p.tipo = 'proyecto'::tipo_trabajo
            AND p.archivado_at IS NULL) AS en_vivo,
    ( SELECT count(*) FROM proyectos p
          WHERE p.color = 'verde'::color_estado AND p.tipo = 'proyecto'::tipo_trabajo
            AND p.fecha_comprometida IS NOT NULL
            AND p.fecha_comprometida < CURRENT_DATE AND p.archivado_at IS NULL) AS atrasados,
    ( SELECT count(*) FROM proyectos p JOIN v_pulso v ON v.id = p.id
          WHERE p.color = 'verde'::color_estado AND p.tipo = 'proyecto'::tipo_trabajo
            AND v.dias_sin_novedades > 7 AND p.archivado_at IS NULL) AS frenados,
    ( SELECT count(*) FROM proyectos p
          WHERE p.color = 'amarillo'::color_estado AND p.etapa IS NOT NULL
            AND p.etapa <> 'ganado'::text AND p.archivado_at IS NULL) AS en_pipeline,
    ( SELECT count(*) FROM proyectos p
          WHERE p.color = 'amarillo'::color_estado AND p.proximo_seguimiento IS NOT NULL
            AND p.proximo_seguimiento < now() AND p.archivado_at IS NULL) AS seguimientos_vencidos,
    ( SELECT COALESCE(sum(h.monto_neto), 0::numeric) FROM hitos h
          WHERE h.moneda = 'ARS'::bpchar AND h.facturado_at IS NOT NULL
            AND h.cobrado_at IS NULL) AS por_cobrar,
    ( SELECT count(*) FROM proyectos p
          WHERE p.tipo = 'mantenimiento'::tipo_trabajo AND p.color = 'verde'::color_estado
            AND p.archivado_at IS NULL) AS abonos;

grant select on v_estado_general to authenticated;


-- v_tablero dice si el proyecto ya tiene su abono, para no ofrecer
-- abrirlo cuando ya está abierto.
create or replace view v_tablero
with (security_invoker = true)
as
select
  p.id, p.codigo, p.nombre,
  o.nombre_canonico as cliente,
  o.codigo          as cliente_codigo,
  p.color, p.subestado, p.motivo_gris, p.prioridad, p.fecha_comprometida,
  p.es_producto_propio, p.condicion, p.tipo,
  r.nombre          as responsable,
  (current_date - p.fecha_comprometida) as dias_de_atraso,
  cerrado_at(p.id, p.color::text) as cerrado_at,
  extract(day from now() - coalesce(
      (select max(a.ocurrido_at) from actualizaciones a where a.proyecto_id = p.id),
      p.created_at))::int as dias_sin_novedades,
  p.motivo_rojo,
  p.organizacion_id, p.responsable_id, p.fecha_inicio, p.monto_neto, p.descripcion,
  (ve_todo() or participa_en(p.id)) as puedo_editar,
  exists (select 1 from proyectos m where m.origen_id = p.id) as tiene_abono
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas r  on r.id = p.responsable_id
where p.tipo = 'proyecto'
  and (p.etapa is null or p.etapa = 'ganado')
  and p.archivado_at is null;

grant select on v_tablero to authenticated;
