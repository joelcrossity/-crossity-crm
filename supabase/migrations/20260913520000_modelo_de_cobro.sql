-- ------------------------------------------------------------------
-- Los dos modelos de abono ya se distinguen; faltaba decirlo.
--
-- No hace falta tipo_modelo_cobro. Un abono con tamaño de bloque
-- cargado cobra excedentes y lleva costos de API; uno de modalidad fija
-- sin bloques es un fee plano donde el cliente pone sus propias
-- credenciales. Esa diferencia ya está en los datos que definen el
-- cobro, así que agregar una columna que la repita crea la posibilidad
-- de que las dos digan cosas distintas: alguien marca "fee fijo" y deja
-- el bloque cargado, y entonces la pantalla dice una cosa y la factura
-- hace otra.
--
-- Se deriva. Si mañana aparece un tercer modelo, lo que lo define es
-- cómo se cobra, no una etiqueta al lado.
-- ------------------------------------------------------------------

create or replace function modelo_de_cobro(p_modalidad modalidad_abono, p_bloque integer)
returns text
language sql immutable
as $$
  select case
    when p_bloque is not null then 'consumo_incluido'
    when p_modalidad = 'fijo' then 'fee_fijo'
    else 'por_consumo'
  end;
$$;

grant execute on function modelo_de_cobro(modalidad_abono, integer) to authenticated;

comment on function modelo_de_cobro is
  'Cómo se le cobra a este abono, deducido de cómo está configurado. No es una etiqueta aparte: una etiqueta puede contradecir a la configuración.';

drop view if exists v_recurrentes;
create view v_recurrentes
with (security_invoker = true)
as
 SELECT p.id, p.codigo, p.nombre,
    o.nombre_canonico AS cliente,
    p.monto_mensual, p.moneda, p.modalidad, p.plan,
    p.vigencia_desde, p.vigencia_hasta, p.renovacion_automatica, p.color,
    orig.codigo AS viene_de,
    p.vigencia_hasta IS NOT NULL AND p.vigencia_hasta <= (CURRENT_DATE + 60) AS vence_pronto,
    (p.color = 'verde'::color_estado
     and (p.vigencia_desde is null or p.vigencia_desde <= current_date)) AS en_produccion,
    modelo_de_cobro(p.modalidad, p.tamano_bloque) AS modelo,
    p.incluido_en_base, p.tamano_bloque, p.precio_bloque, p.max_bloques,
    p.unidad_consumo
   FROM proyectos p
     JOIN organizaciones o ON o.id = p.organizacion_id
     LEFT JOIN proyectos orig ON orig.id = p.origen_id
  WHERE p.tipo = 'mantenimiento'::tipo_trabajo
    AND p.color <> 'rojo'::color_estado
    AND p.archivado_at IS NULL;

grant select on v_recurrentes to authenticated;
