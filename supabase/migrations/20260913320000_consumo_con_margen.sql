-- v_consumo suma el tercer costo y el margen en porcentaje, y el
-- monto a facturar toma en cuenta el plan elegido.
drop view if exists v_consumo;
create view v_consumo as
select
  c.id, c.proyecto_id, p.codigo, p.nombre, p.plan,
  o.nombre_canonico as cliente,
  c.periodo,
  c.cantidad         as usado,
  p.unidad_consumo   as unidad,
  p.incluido_en_base as incluido,
  p.tamano_bloque, p.max_bloques,
  bloques_excedidos(c.cantidad, p.incluido_en_base, p.tamano_bloque) as bloques,
  (p.max_bloques is not null
   and bloques_excedidos(c.cantidad, p.incluido_en_base, p.tamano_bloque) > p.max_bloques)
                     as requiere_upgrade,
  c.facturado_at, c.cobrado_at, c.notas, p.moneda,

  case when puede_persona('ver_rentabilidad_mantenimientos') then p.monto_mensual end as base,
  case when puede_persona('ver_rentabilidad_mantenimientos')
       then round(bloques_excedidos(c.cantidad, p.incluido_en_base, p.tamano_bloque)
                  * coalesce(p.precio_bloque, 0), 2) end as excedente,
  case when puede_persona('ver_rentabilidad_mantenimientos') then c.monto       end as facturado,
  case when puede_persona('ver_rentabilidad_mantenimientos') then c.costo_meta  end as costo_meta,
  case when puede_persona('ver_rentabilidad_mantenimientos') then c.costo_ia    end as costo_ia,
  case when puede_persona('ver_rentabilidad_mantenimientos') then c.costo_otros end as costo_otros,
  case when puede_persona('ver_rentabilidad_mantenimientos')
       then coalesce(c.costo_meta,0) + coalesce(c.costo_ia,0) + coalesce(c.costo_otros,0)
       end as costo_total,
  case when puede_persona('ver_rentabilidad_mantenimientos')
            and (c.costo_meta is not null or c.costo_ia is not null or c.costo_otros is not null)
       then c.monto - coalesce(c.costo_meta,0) - coalesce(c.costo_ia,0) - coalesce(c.costo_otros,0)
       end as margen,
  -- El porcentaje solo si hay algo facturado: dividir por cero da un
  -- número que parece un dato y no lo es.
  case when puede_persona('ver_rentabilidad_mantenimientos')
            and coalesce(c.monto,0) > 0
            and (c.costo_meta is not null or c.costo_ia is not null or c.costo_otros is not null)
       then round(
              (c.monto - coalesce(c.costo_meta,0) - coalesce(c.costo_ia,0) - coalesce(c.costo_otros,0))
              * 100 / c.monto, 1)
       end as margen_pct,
  puede_persona('ver_rentabilidad_mantenimientos') as ve_la_plata

from consumos c
join proyectos p      on p.id = c.proyecto_id
join organizaciones o on o.id = p.organizacion_id
where ve_todo() or participa_en(c.proyecto_id);

grant select on v_consumo to authenticated;


-- anotar_consumo acepta el tercer costo.
create or replace function anotar_consumo(
  p_proyecto uuid, p_periodo date, p_cantidad numeric,
  p_notas text default null,
  p_costo_meta numeric default null,
  p_costo_ia numeric default null,
  p_costo_otros numeric default null
) returns numeric
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_p proyectos%rowtype; v_precio numeric; v_extra numeric;
  v_bloques integer; v_monto numeric; v_persona uuid;
begin
  select * into v_p from proyectos where id = p_proyecto;
  if v_p.tipo is distinct from 'mantenimiento' then
    raise exception 'El consumo solo se carga en un abono';
  end if;

  v_precio  := coalesce(v_p.precio_unitario, 0);
  v_bloques := bloques_excedidos(p_cantidad, v_p.incluido_en_base, v_p.tamano_bloque);

  if v_p.tamano_bloque is not null then
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
                        notas, cargado_por, costo_meta, costo_ia, costo_otros)
  values (p_proyecto, date_trunc('month', p_periodo)::date, p_cantidad, v_precio, v_monto,
          p_notas, v_persona, p_costo_meta, p_costo_ia, p_costo_otros)
  on conflict (proyecto_id, periodo) do update
    set cantidad=excluded.cantidad, precio_unitario=excluded.precio_unitario,
        monto=excluded.monto,
        notas=coalesce(excluded.notas, consumos.notas),
        costo_meta=coalesce(excluded.costo_meta, consumos.costo_meta),
        costo_ia=coalesce(excluded.costo_ia, consumos.costo_ia),
        costo_otros=coalesce(excluded.costo_otros, consumos.costo_otros);

  return v_monto;
end;
$$;

-- La versión de seis parámetros se va: con las dos, PostgREST no sabe
-- cuál llamar cuando faltan argumentos.
drop function if exists anotar_consumo(uuid, date, numeric, text, numeric, numeric);
grant execute on function anotar_consumo(uuid, date, numeric, text, numeric, numeric, numeric) to authenticated;


-- Aplicar un plan a un abono: completa los números y deja el abono
-- viviendo solo.
create or replace function aplicar_plan(p_proyecto uuid, p_plan text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v planes_abono%rowtype;
begin
  if not puede_persona('cambiar_montos') then
    raise exception 'No tenés el permiso para cambiar montos.';
  end if;
  select * into v from planes_abono where clave = p_plan and activo;
  if not found then raise exception 'Ese plan no existe.'; end if;

  update proyectos
     set plan = v.nombre, monto_mensual = v.monto, moneda = v.moneda,
         incluido_en_base = v.incluido, tamano_bloque = v.tamano_bloque,
         precio_bloque = v.precio_bloque, max_bloques = v.max_bloques,
         modalidad = 'fijo_mas_consumo'
   where id = p_proyecto and tipo = 'mantenimiento';
end;
$$;

grant execute on function aplicar_plan(uuid, text) to authenticated;
