-- v_pipeline suma lo que el panel de edición necesita, y si esta
-- persona puede editarla. Va en la vista y no en una consulta aparte al
-- abrir el panel: son campos de la misma fila que ya se trae.
--
-- El resto queda tal cual estaba. La reescribí de memoria la primera
-- vez y me comí que nurturing es un enum, no texto: un coalesce a
-- cadena vacía lo rompía. Traerla como está y solo agregarle al final
-- evita inventar diferencias donde no las hay.
create or replace view v_pipeline
with (security_invoker = true)
as
 SELECT p.id,
    p.codigo,
    p.nombre,
    o.nombre_canonico AS cliente,
    p.etapa,
    p.nurturing,
    p.origen,
    p.origen_detalle,
    p.monto_neto,
    p.moneda,
    p.proxima_accion,
    p.proximo_seguimiento,
    pe.nombre AS vendedor,
    p.proximo_seguimiento IS NULL AS sin_agendar,
    p.proximo_seguimiento < now() AS seguimiento_vencido,
    (p.etapa = ANY (ARRAY['cotizado'::text, 'negociacion'::text])) AND p.nurturing <> 'completado'::estado_nurturing AS negocia_sin_base,
    (p.etapa = ANY (ARRAY['cotizado'::text, 'negociacion'::text])) AND p.monto_neto IS NULL AS cotizado_sin_monto,
    p.color = 'gris'::color_estado AND p.motivo_gris = 'no_se_dio'::motivo_gris AS enfriada,
    p.organizacion_id,
    p.responsable_id,
    p.descripcion,
    p.casa_cotizacion,
    p.cotizacion_pactada,
    (ve_todo() OR participa_en(p.id)) AS puedo_editar,
    (SELECT count(*) FROM hitos h WHERE h.proyecto_id = p.id AND NOT h.activo) AS etapas_cotizadas
   FROM proyectos p
     JOIN organizaciones o ON o.id = p.organizacion_id
     LEFT JOIN personas pe ON pe.id = p.responsable_id
  WHERE p.etapa IS NOT NULL AND p.etapa <> 'ganado'::text AND p.archivado_at IS NULL AND (p.color = 'amarillo'::color_estado OR p.color = 'gris'::color_estado AND p.motivo_gris = 'no_se_dio'::motivo_gris);

grant select on v_pipeline to authenticated;
