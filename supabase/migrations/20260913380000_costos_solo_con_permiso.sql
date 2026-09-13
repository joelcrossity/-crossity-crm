-- anotar_consumo es SECURITY DEFINER —tiene que escribir en consumos,
-- que está cerrada— y por eso escribía también los costos sin fijarse
-- si quien llama puede verlos. Quedaba una asimetría rara: alguien
-- podía cargar el costo de Meta y después no poder leerlo. Peor: podía
-- pisar el que cargó otro sin llegar a ver qué estaba pisando.
--
-- Ahora los costos se ignoran si no tiene el permiso. Las
-- conversaciones se siguen cargando: eso es trabajo operativo y lo hace
-- quien lleva el abono.
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
  v_bloques integer; v_monto numeric; v_persona uuid; v_puede boolean;
begin
  select * into v_p from proyectos where id = p_proyecto;
  if v_p.tipo is distinct from 'mantenimiento' then
    raise exception 'El consumo solo se carga en un abono';
  end if;

  v_puede := puede_persona('ver_rentabilidad_mantenimientos');
  if not v_puede then
    p_costo_meta  := null;
    p_costo_ia    := null;
    p_costo_otros := null;
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
