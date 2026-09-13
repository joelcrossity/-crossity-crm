-- ------------------------------------------------------------------
-- Abrir el mantenimiento del proyecto que se terminó.
--
-- La detección ya existía: v_sin_mantenimiento lista los terminados que
-- no tienen abono, y aparece en Hoy como recordatorio. Lo que faltaba
-- era la acción. Recordarle a alguien todos los días algo que no puede
-- resolver desde donde se lo estás recordando es peor que no avisarle.
--
-- El abono hereda del proyecto lo que tiene sentido heredar: el
-- cliente, la moneda, el dólar pactado y el responsable. No hereda el
-- monto: lo que costó construir algo no tiene relación con lo que sale
-- mantenerlo, y arrastrar ese número invita a dejarlo puesto.
--
-- origen_id los deja unidos. Así el abono sabe de dónde viene y el
-- proyecto sabe en qué terminó, sin duplicar la historia del cliente.
-- ------------------------------------------------------------------

create or replace function abrir_mantenimiento(
  p_proyecto uuid,
  p_nombre   text default null,
  p_mensual  numeric default null,
  p_desde    date default null,
  p_plan     text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p   proyectos%rowtype;
  v_id  uuid;
begin
  select * into v_p from proyectos where id = p_proyecto;
  if not found then raise exception 'Ese proyecto no existe.'; end if;

  if v_p.tipo <> 'proyecto' then
    raise exception 'Solo un proyecto abre un mantenimiento.'
      using hint = 'Esto ya es un abono.';
  end if;

  if not (ve_todo() or participa_en(p_proyecto)) then
    raise exception 'No tenés permiso sobre este proyecto.';
  end if;

  if exists (select 1 from proyectos where origen_id = p_proyecto) then
    raise exception 'Este proyecto ya tiene su mantenimiento.';
  end if;

  insert into proyectos (
    organizacion_id, nombre, tipo, color, subestado,
    esquema_cobro, moneda, casa_cotizacion, cotizacion_pactada,
    responsable_id, origen_id, plan, monto_mensual, modalidad,
    vigencia_desde, renovacion_automatica
  ) values (
    v_p.organizacion_id,
    coalesce(nullif(trim(coalesce(p_nombre, '')), ''), 'Mantenimiento · ' || v_p.nombre),
    'mantenimiento',
    -- Verde desde el arranque: un abono que se abre es un abono que
    -- factura. Si todavía no arranca, se le pone la vigencia adelante.
    'verde', 'en_curso',
    'mensual',
    v_p.moneda, v_p.casa_cotizacion, v_p.cotizacion_pactada,
    v_p.responsable_id, p_proyecto,
    p_plan,
    coalesce(p_mensual, 0),
    'fijo',
    coalesce(p_desde, current_date),
    true
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function abrir_mantenimiento(uuid, text, numeric, date, text) to authenticated;

comment on function abrir_mantenimiento is
  'Crea el abono que sale de un proyecto terminado, heredando cliente, moneda y dólar pactado. No hereda el monto: lo que costó construir no dice lo que sale mantener.';


-- ------------------------------------------------------------------
-- Mantenimientos muestra solo lo que está en producción.
--
-- v_recurrentes traía todo lo que no estuviera en rojo, así que un
-- abono acordado y todavía no arrancado figuraba junto a los que
-- facturan. Son dos cosas distintas: uno entra plata y el otro es una
-- promesa.
--
-- Se agrega la marca en vez de filtrarlos. Esconderlos haría que un
-- abono acordado no exista en ningún lado hasta que arranque, y ahí es
-- cuando alguien se olvida de arrancarlo.
-- ------------------------------------------------------------------

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
    -- Facturando de verdad: verde y con la vigencia ya arrancada.
    (p.color = 'verde'::color_estado
     and (p.vigencia_desde is null or p.vigencia_desde <= current_date)) AS en_produccion
   FROM proyectos p
     JOIN organizaciones o ON o.id = p.organizacion_id
     LEFT JOIN proyectos orig ON orig.id = p.origen_id
  WHERE p.tipo = 'mantenimiento'::tipo_trabajo
    AND p.color <> 'rojo'::color_estado
    AND p.archivado_at IS NULL;

grant select on v_recurrentes to authenticated;
