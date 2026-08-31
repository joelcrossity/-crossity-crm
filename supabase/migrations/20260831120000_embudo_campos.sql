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
-- Moneda. La agencia factura en pesos, CRONEXIA cotiza en dólares
-- y puede aparecer un euro. Referencia al catálogo, no lista fija.
-- ------------------------------------------------------------

alter table proyectos
  add column moneda char(3) not null default 'ARS' references monedas(codigo);

alter table hitos
  add column moneda char(3) not null default 'ARS' references monedas(codigo);

-- Un gasto puede venir en otra moneda que el proyecto: una licencia en
-- dólares dentro de un proyecto en pesos es el caso normal, no la excepción.
alter table gastos
  add column moneda     char(3) not null default 'ARS' references monedas(codigo),
  -- cuántas unidades de la moneda del proyecto vale una de la del gasto
  add column cotizacion numeric(14,4) not null default 1;

comment on column gastos.cotizacion is
  'Se guarda en el gasto y no se recalcula: el costo fue el del día que se pagó.';

-- La cotización se guarda en el cobro, no en el proyecto: lo que importa
-- es a cuánto entró la plata, no a cuánto se presupuestó.
alter table cobros
  add column moneda      char(3) not null default 'ARS' references monedas(codigo),
  add column cotizacion  numeric(14,4);

comment on column cobros.cotizacion is
  'Entre cotizar y cobrar hay una diferencia. Con participaciones de por medio, esa diferencia no puede quedar sin registrar.';

-- El hito hereda la moneda del proyecto salvo que se diga otra cosa.
create or replace function heredar_moneda()
returns trigger
language plpgsql
as $$
begin
  if TG_TABLE_NAME = 'hitos' then
    select moneda into NEW.moneda from proyectos where id = NEW.proyecto_id;
  end if;
  return NEW;
end;
$$;

create trigger hitos_heredan_moneda
  before insert on hitos
  for each row execute function heredar_moneda();

-- ------------------------------------------------------------
-- La base de reparto se calcula EN LA MONEDA DEL PROYECTO.
-- Si el proyecto es en dólares, la parte de cada uno es en dólares;
-- recién al pagar se decide en qué moneda y a qué cambio.
-- ------------------------------------------------------------

create or replace function base_de_reparto(p_hito uuid)
returns numeric
language plpgsql
stable
as $$
declare
  v_proyecto       uuid;
  v_monto          numeric(14,2);
  v_peso           numeric;
  v_gastos_propios numeric(14,2);
  v_gastos_sueltos numeric(14,2);
  v_impuestos      numeric(14,2);
begin
  select proyecto_id, monto_neto into v_proyecto, v_monto
    from hitos where id = p_hito;

  if v_proyecto is null then
    return 0;
  end if;

  select case when sum(monto_neto) > 0 then v_monto / sum(monto_neto) else 0 end
    into v_peso
    from hitos where proyecto_id = v_proyecto;

  -- costo_real por su cotización: el gasto entra convertido a la
  -- moneda del proyecto, que es donde vive el reparto.
  select coalesce(sum(costo_real * cotizacion), 0) into v_gastos_propios
    from gastos where hito_id = p_hito;

  select coalesce(sum(costo_real * cotizacion), 0) into v_gastos_sueltos
    from gastos where proyecto_id = v_proyecto and hito_id is null;

  select coalesce(sum(monto), 0) into v_impuestos
    from impuestos where hito_id = p_hito;

  return greatest(
    round(v_monto - v_gastos_propios - (v_gastos_sueltos * v_peso) - v_impuestos, 2),
    0
  );
end;
$$;

-- ------------------------------------------------------------
-- Coherencia del embudo
-- ------------------------------------------------------------

alter table proyectos
  add constraint amarillo_tiene_etapa check (
    color <> 'amarillo' or etapa is not null
  );

-- Se pensó en obligar el monto a partir de la cotización, y está mal:
-- forzarlo hace que alguien invente un número para poder guardar, que es
-- peor que no tenerlo. Va como señal en la vista, no como impedimento.
-- Es la misma lógica que la excepción del anticipo: la regla que no se
-- puede cumplir se evade, y ahí el sistema empieza a mentir.

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
  (p.etapa in ('cotizacion','negociacion') and p.nurturing <> 'completado') as negocia_sin_base,
  (p.etapa in ('cotizacion','negociacion') and p.monto_neto is null)         as cotizado_sin_monto
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
