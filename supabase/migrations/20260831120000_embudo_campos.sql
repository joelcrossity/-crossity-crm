-- ============================================================
-- Campos del embudo, moneda, y la regla que hace que se mueva.
-- ============================================================

alter table proyectos
  -- Sólo mientras es una venta. Al ganarse queda en 'ganado' y no se toca más.
  add column etapa            etapa_comercial,
  add column origen           origen_lead,
  add column origen_detalle   text,
  add column nurturing        estado_nurturing not null default 'pendiente',
  -- Lo que hace que el embudo avance. Sin esto, un lead está abandonado
  -- aunque figure activo.
  add column proxima_accion       text,
  add column proximo_seguimiento  timestamptz;

comment on column proyectos.origen_detalle is
  'Quién recomendó. Al ganarse, suele convertirse en una participación con concepto referido.';

comment on column proyectos.proximo_seguimiento is
  'Un lead sin seguimiento agendado es un lead perdido que todavía no se enteró.';

-- ------------------------------------------------------------
-- Moneda. CRONEXIA cotiza en dólares y la agencia en pesos:
-- guardar los montos pelados sería perder plata sin darse cuenta.
-- ------------------------------------------------------------

alter table proyectos add column moneda char(3) not null default 'ARS'
  check (moneda in ('ARS', 'USD'));

alter table hitos add column moneda char(3) not null default 'ARS'
  check (moneda in ('ARS', 'USD'));

-- La cotización se guarda en el cobro, no en el proyecto: lo que importa
-- es a cuánto entró la plata, no a cuánto se presupuestó.
alter table cobros
  add column moneda      char(3) not null default 'ARS' check (moneda in ('ARS', 'USD')),
  add column cotizacion  numeric(14,4),
  add column monto_ars   numeric(14,2);

comment on column cobros.cotizacion is
  'A qué cambio entró. Sin esto, la diferencia entre cotizar y cobrar se la come alguien sin que nadie lo haya decidido.';

-- ------------------------------------------------------------
-- Coherencia del embudo
-- ------------------------------------------------------------

alter table proyectos
  add constraint amarillo_tiene_etapa check (
    color <> 'amarillo' or etapa is not null
  ),
  add constraint cotizacion_tiene_monto check (
    etapa is null or etapa not in ('cotizacion', 'negociacion') or monto_neto is not null
  );

-- Al ganarse, la etapa queda congelada y el proyecto pasa a verde.
create or replace function ganar_oportunidad(
  p_proyecto uuid,
  p_esquema  esquema_cobro default 'cincuenta_cincuenta'
)
returns void
language plpgsql
as $$
begin
  update proyectos
     set etapa = 'ganado',
         color = 'verde',
         subestado = 'en_curso',
         motivo_gris = null,
         esquema_cobro = p_esquema,
         fecha_inicio = coalesce(fecha_inicio, current_date),
         proxima_accion = null,
         proximo_seguimiento = null
   where id = p_proyecto;

  perform generar_hitos(p_proyecto, p_esquema);
end;
$$;

comment on function ganar_oportunidad is
  'Ganar genera los hitos y deja el proyecto esperando el anticipo, no trabajando.';

-- ------------------------------------------------------------
-- El pipeline, y lo que se está cayendo solo.
-- ------------------------------------------------------------

create or replace view v_pipeline
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico  as cliente,
  p.etapa,
  p.nurturing,
  p.origen,
  p.origen_detalle,
  p.monto_neto,
  p.moneda,
  p.proxima_accion,
  p.proximo_seguimiento,
  v.nombre           as vendedor,
  -- las tres señales que hoy nadie mira
  (p.proximo_seguimiento is null)                                    as sin_agendar,
  (p.proximo_seguimiento < now())                                    as seguimiento_vencido,
  (p.etapa in ('cotizacion','negociacion') and p.nurturing <> 'completado') as negocia_sin_base
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas v on v.id = p.responsable_id
where p.color = 'amarillo';

comment on view v_pipeline is
  'negocia_sin_base marca lo que la planilla de CRONEXIA ya insinuaba: cotizar antes de haber hecho el nurturing.';

-- Lo que se apagó sin que nadie decidiera nada. Vuelve a los 3 meses.
create or replace view v_para_recontactar
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico as cliente,
  p.origen,
  p.monto_neto,
  p.moneda,
  (select max(a.ocurrido_at) from actualizaciones a where a.proyecto_id = p.id) as ultima_novedad
from proyectos p
join organizaciones o on o.id = p.organizacion_id
where p.color = 'gris'
  and p.motivo_gris = 'no_se_dio';

comment on view v_para_recontactar is
  'No es lo mismo perder que apagarse. Esto es material, no historia.';

grant select on v_pipeline, v_para_recontactar to authenticated;
