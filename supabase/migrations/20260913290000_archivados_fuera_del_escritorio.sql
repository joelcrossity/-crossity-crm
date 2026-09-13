-- ------------------------------------------------------------------
-- Lo archivado sale del escritorio.
--
-- Archivar sacaba el proyecto del tablero y del pipeline, y de ningún
-- lado más. Ya había un abono archivado que seguía apareciendo en los
-- recurrentes y contándose en la franja de arriba, así que archivarlo
-- no servía de nada: el número seguía ahí.
--
-- Se arreglan las vistas operativas, que son las que contestan "qué hay
-- que mirar hoy". Las financieras y las históricas quedan como están, a
-- propósito y no por olvido: la cuenta corriente de un proyecto
-- archivado sigue siendo plata que el cliente debe, lo que se le debe a
-- alguien no deja de debérsele porque el trabajo se archivó, y el
-- buscador tiene que encontrar lo archivado —para eso existe el
-- historial—. Filtrarlas escondería deuda real.
--
-- Quedan sin filtrar a sabiendas: v_cuenta_corriente, v_movimientos,
-- v_antiguedad, v_cashflow, v_posicion_de, v_mi_posicion,
-- v_posicion_general, v_posicion_proyecto, v_proyecto_plata, v_buscar,
-- v_interacciones, v_avance, v_por_facturar y v_facturas_a_recibir.
-- ------------------------------------------------------------------

create or replace view v_recurrente
with (security_invoker = true)
as
 SELECT 'entra'::text AS lado,
    p.nombre AS concepto,
    o.nombre_canonico AS quien,
        CASE p.modalidad
            WHEN 'fijo'::modalidad_abono THEN p.monto_mensual
            ELSE COALESCE(( SELECT avg(c.monto) AS avg
               FROM consumos c
              WHERE c.proyecto_id = p.id AND c.periodo >= (CURRENT_DATE - '3 mons'::interval)), p.monto_mensual, 0::numeric)
        END AS mensual,
    p.moneda,
    p.codigo
   FROM proyectos p
     JOIN organizaciones o ON o.id = p.organizacion_id
  WHERE p.tipo = 'mantenimiento'::tipo_trabajo
    AND p.color = 'verde'::color_estado
    AND p.archivado_at IS NULL
UNION ALL
 SELECT 'sale'::text AS lado,
    c.concepto,
    COALESCE(c.proveedor, '—'::text) AS quien,
    round(c.monto * veces_por_ano(c.cada) / 12::numeric, 2) AS mensual,
    c.moneda,
    NULL::text AS codigo
   FROM costos_fijos c
  WHERE c.desde <= CURRENT_DATE AND (c.hasta IS NULL OR c.hasta >= CURRENT_DATE);

grant select on v_recurrente to authenticated;


drop view if exists v_recurrentes;
create view v_recurrentes
with (security_invoker = true)
as
 SELECT p.id, p.codigo, p.nombre,
    o.nombre_canonico AS cliente,
    p.monto_mensual, p.moneda, p.modalidad,
    p.vigencia_desde, p.vigencia_hasta, p.renovacion_automatica, p.color,
    orig.codigo AS viene_de,
    p.vigencia_hasta IS NOT NULL AND p.vigencia_hasta <= (CURRENT_DATE + 60) AS vence_pronto
   FROM proyectos p
     JOIN organizaciones o ON o.id = p.organizacion_id
     LEFT JOIN proyectos orig ON orig.id = p.origen_id
  WHERE p.tipo = 'mantenimiento'::tipo_trabajo
    AND p.color <> 'rojo'::color_estado
    AND p.archivado_at IS NULL;

grant select on v_recurrentes to authenticated;


-- La franja de arriba: seis cuentas, todas sobre lo que está vivo.
create or replace view v_estado_general
with (security_invoker = true)
as
 SELECT ( SELECT count(*) FROM proyectos p
          WHERE p.color = 'verde'::color_estado AND p.tipo = 'proyecto'::tipo_trabajo
            AND p.archivado_at IS NULL) AS en_vivo,
    ( SELECT count(*) FROM proyectos p
          WHERE p.color = 'verde'::color_estado AND p.fecha_comprometida IS NOT NULL
            AND p.fecha_comprometida < CURRENT_DATE AND p.archivado_at IS NULL) AS atrasados,
    ( SELECT count(*) FROM proyectos p JOIN v_pulso v ON v.id = p.id
          WHERE p.color = 'verde'::color_estado AND v.dias_sin_novedades > 7
            AND p.archivado_at IS NULL) AS frenados,
    ( SELECT count(*) FROM proyectos p
          WHERE p.color = 'amarillo'::color_estado AND p.etapa IS NOT NULL
            AND p.etapa <> 'ganado'::text AND p.archivado_at IS NULL) AS en_pipeline,
    ( SELECT count(*) FROM proyectos p
          WHERE p.color = 'amarillo'::color_estado AND p.proximo_seguimiento IS NOT NULL
            AND p.proximo_seguimiento < now() AND p.archivado_at IS NULL) AS seguimientos_vencidos,
    -- Lo facturado y no cobrado NO se filtra: esa plata se sigue
    -- debiendo aunque el trabajo se haya archivado.
    ( SELECT COALESCE(sum(h.monto_neto), 0::numeric) FROM hitos h
          WHERE h.moneda = 'ARS'::bpchar AND h.facturado_at IS NOT NULL
            AND h.cobrado_at IS NULL) AS por_cobrar,
    ( SELECT count(*) FROM proyectos p
          WHERE p.tipo = 'mantenimiento'::tipo_trabajo AND p.color = 'verde'::color_estado
            AND p.archivado_at IS NULL) AS abonos;

grant select on v_estado_general to authenticated;
