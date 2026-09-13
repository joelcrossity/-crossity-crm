-- ------------------------------------------------------------------
-- El abono de agentes: bloques de excedente, y qué deja el mes.
--
-- El modelo por consumo que ya había cobra por unidad: tantas
-- conversaciones por tantos pesos cada una. Los agentes no se venden
-- así. Se vende un plan con un tope incluido, y lo que pasa del tope se
-- cobra en bloques enteros: 100 conversaciones, 35 dólares, y el bloque
-- se cobra completo aunque se usen tres.
--
-- Por eso los campos nuevos no reemplazan a los viejos: los bloques
-- conviven con precio_unitario, y cada abono usa el que corresponde.
-- Si tamano_bloque está cargado, se cobra por bloques; si no, por
-- unidad, como hasta ahora. Ningún abono existente cambia de
-- comportamiento.
--
-- No hay monto_base_usd. proyectos ya tiene monto_mensual y moneda, y
-- una columna aparte en dólares sería un segundo lugar donde vive la
-- plata: el día que alguien cobre un abono en pesos, o que haya que
-- sumar todos los abonos, habría que acordarse de mirar las dos.
-- El plan en dólares se carga con moneda = 'USD'.
--
-- El límite incluido tampoco es nuevo: es incluido_en_base, que ya
-- existía y significa exactamente eso.
-- ------------------------------------------------------------------

alter table proyectos add column if not exists plan text;
alter table proyectos add column if not exists tamano_bloque integer;
alter table proyectos add column if not exists precio_bloque numeric(14,2);
alter table proyectos add column if not exists max_bloques integer;

alter table proyectos drop constraint if exists bloques_coherentes;
alter table proyectos add constraint bloques_coherentes check (
  (tamano_bloque is null and precio_bloque is null)
  or (tamano_bloque > 0 and precio_bloque >= 0)
);

comment on column proyectos.plan is 'Nombre comercial del plan, para que la ficha diga "Plan Agente 300" y no solo un monto.';
comment on column proyectos.tamano_bloque is 'Cuántas unidades trae un bloque de excedente. Cargado: se cobra por bloques enteros. Vacío: se cobra por unidad, con precio_unitario.';
comment on column proyectos.max_bloques is 'Hasta cuántos bloques se estira el plan antes de que convenga subir de plan. Se avisa, no se corta.';

-- Lo que cuesta atender el mes. Va en el consumo y no en el proyecto
-- porque cambia todos los meses: es la factura de Meta y la de la API.
alter table consumos add column if not exists costo_meta numeric(14,2);
alter table consumos add column if not exists costo_ia numeric(14,2);

comment on column consumos.costo_meta is 'Lo que facturó Meta ese mes por las conversaciones.';
comment on column consumos.costo_ia is 'Lo que facturó la API del modelo ese mes.';


-- ------------------------------------------------------------------
-- La cuenta de los bloques, en un solo lugar.
--
-- La hacen la función que carga el consumo y la vista que lo muestra.
-- Si cada una la escribiera por su lado, tarde o temprano la pantalla
-- diría un número y la factura otro.
-- ------------------------------------------------------------------

create or replace function bloques_excedidos(
  p_usado numeric, p_incluido numeric, p_tamano integer
) returns integer
language sql immutable
as $$
  -- Bloque empezado es bloque cobrado: 201 sobre 100 son 3 bloques.
  select case
    when p_tamano is null or p_tamano <= 0 then 0
    else greatest(ceil((coalesce(p_usado,0) - coalesce(p_incluido,0)) / p_tamano), 0)::integer
  end;
$$;

comment on function bloques_excedidos is
  'Cuántos bloques enteros de excedente entran en lo usado. Bloque empezado es bloque cobrado.';


create or replace function anotar_consumo(
  p_proyecto uuid,
  p_periodo date,
  p_cantidad numeric,
  p_notas text default null,
  p_costo_meta numeric default null,
  p_costo_ia numeric default null
) returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_p       proyectos%rowtype;
  v_precio  numeric;
  v_extra   numeric;
  v_bloques integer;
  v_monto   numeric;
  v_persona uuid;
begin
  select * into v_p from proyectos where id = p_proyecto;

  if v_p.tipo is distinct from 'mantenimiento' then
    raise exception 'El consumo solo se carga en un abono';
  end if;

  v_precio  := coalesce(v_p.precio_unitario, 0);
  v_bloques := bloques_excedidos(p_cantidad, v_p.incluido_en_base, v_p.tamano_bloque);

  if v_p.tamano_bloque is not null then
    -- Por bloques: el piso más los bloques enteros que se pasaron.
    v_monto := coalesce(v_p.monto_mensual, 0)
             + round(v_bloques * coalesce(v_p.precio_bloque, 0), 2);
  elsif v_p.modalidad = 'fijo_mas_consumo' then
    v_extra := greatest(p_cantidad - coalesce(v_p.incluido_en_base, 0), 0);
    v_monto := coalesce(v_p.monto_mensual, 0) + round(v_extra * v_precio, 2);
  elsif v_p.modalidad = 'consumo' then
    v_monto := round(p_cantidad * v_precio, 2);
  else
    v_monto := coalesce(v_p.monto_mensual, 0);
  end if;

  select persona_id into v_persona from usuarios where id = auth.uid();

  insert into consumos (proyecto_id, periodo, cantidad, precio_unitario, monto,
                        notas, cargado_por, costo_meta, costo_ia)
  values (p_proyecto, date_trunc('month', p_periodo)::date, p_cantidad, v_precio, v_monto,
          p_notas, v_persona, p_costo_meta, p_costo_ia)
  on conflict (proyecto_id, periodo) do update
    set cantidad        = excluded.cantidad,
        precio_unitario = excluded.precio_unitario,
        monto           = excluded.monto,
        notas           = coalesce(excluded.notas, consumos.notas),
        -- null no pisa: cargar las conversaciones sin la factura de
        -- Meta todavía no tiene que borrar la que ya estaba.
        costo_meta      = coalesce(excluded.costo_meta, consumos.costo_meta),
        costo_ia        = coalesce(excluded.costo_ia, consumos.costo_ia);

  return v_monto;
end;
$$;

grant execute on function anotar_consumo(uuid, date, numeric, text, numeric, numeric) to authenticated;


-- ------------------------------------------------------------------
-- v_consumo: el mes, con la cuenta hecha y la plata tapada.
--
-- Los costos y el margen solo salen si la persona tiene el permiso.
-- No se tapan en la pantalla: se tapan acá, porque una pantalla que
-- esconde un campo que la API igual devuelve no esconde nada —se ve en
-- la respuesta de red, y cualquiera que abra el inspector lo lee—.
--
-- Por eso además se le quita el select directo sobre consumos a
-- authenticated: si quedara, alcanzaría con pedir la tabla en vez de la
-- vista para saltear todo esto.
-- ------------------------------------------------------------------

drop view if exists v_consumo;
create view v_consumo
with (security_invoker = true)
as
select
  c.id,
  c.proyecto_id,
  p.codigo,
  p.nombre,
  p.plan,
  o.nombre_canonico as cliente,
  c.periodo,
  c.cantidad                     as usado,
  p.unidad_consumo               as unidad,
  p.incluido_en_base             as incluido,
  p.tamano_bloque,
  p.max_bloques,
  bloques_excedidos(c.cantidad, p.incluido_en_base, p.tamano_bloque) as bloques,
  -- Se avisa cuando se pasó del máximo, no se corta: cortarle el agente
  -- al cliente para forzar un upgrade es perder al cliente.
  (p.max_bloques is not null
   and bloques_excedidos(c.cantidad, p.incluido_en_base, p.tamano_bloque) > p.max_bloques)
                                 as requiere_upgrade,
  c.facturado_at,
  c.cobrado_at,
  c.notas,
  p.moneda,

  case when puede_persona('ver_rentabilidad_mantenimientos') then c.monto      end as facturado,
  case when puede_persona('ver_rentabilidad_mantenimientos') then c.costo_meta end as costo_meta,
  case when puede_persona('ver_rentabilidad_mantenimientos') then c.costo_ia   end as costo_ia,
  case when puede_persona('ver_rentabilidad_mantenimientos')
       then c.monto - coalesce(c.costo_meta, 0) - coalesce(c.costo_ia, 0) end as margen,
  puede_persona('ver_rentabilidad_mantenimientos') as ve_la_plata

from consumos c
join proyectos p     on p.id = c.proyecto_id
join organizaciones o on o.id = p.organizacion_id;

grant select on v_consumo to authenticated;

comment on view v_consumo is
  'El consumo del mes con los bloques calculados. Los costos y el margen salen en null si la persona no tiene ver_rentabilidad_mantenimientos: se tapan acá y no en la pantalla, para que no viajen en la respuesta.';

-- El select directo sobre la tabla se va: dejarlo sería una puerta al
-- costado de la vista. La escritura sigue pasando por anotar_consumo.
revoke select on consumos from authenticated;


-- ------------------------------------------------------------------
-- El permiso.
-- ------------------------------------------------------------------

insert into acciones_catalogo (accion, etiqueta, ayuda, grupo, orden)
values ('ver_rentabilidad_mantenimientos',
        'Ver la rentabilidad de los abonos',
        'Cuánto cuesta atender cada abono —Meta, la API del modelo— y cuánto queda.',
        'Plata', 25)
on conflict (accion) do nothing;

insert into roles_permisos (rol, accion)
values ('direccion', 'ver_rentabilidad_mantenimientos'),
       ('administracion', 'ver_rentabilidad_mantenimientos')
on conflict do nothing;
