-- ------------------------------------------------------------------
-- No se podía borrar un proyecto. Ninguno, nunca.
--
-- Al borrarlo, el trigger de auditoría intentaba registrar la baja
-- apuntando con proyecto_id al proyecto que se estaba borrando. La fila
-- ya no existe en ese momento, así que la clave foránea rechazaba el
-- evento y la baja entera se caía. El error aparece recién cuando
-- alguien intenta borrar uno, y como casi nunca se borra un proyecto,
-- podía quedarse ahí meses.
--
-- La baja de un proyecto no lleva proyecto_id: el evento habla del
-- proyecto, no cuelga de él. registro_id ya guarda cuál era, así que no
-- se pierde nada. Las bajas de otras tablas —un hito, una asignación—
-- sí lo llevan, porque ahí el proyecto sigue existiendo.
-- ------------------------------------------------------------------

create or replace function registrar_evento()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  fila_vieja jsonb;
  fila_nueva jsonb;
  clave      text;
  proy       uuid;
  org        uuid;
  quien      uuid;
  afectada   uuid;
begin
  quien := persona_actual();

  fila_vieja := case when TG_OP = 'INSERT' then '{}'::jsonb else to_jsonb(OLD) end;
  fila_nueva := case when TG_OP = 'DELETE' then '{}'::jsonb else to_jsonb(NEW) end;

  proy := coalesce(
    nullif(fila_nueva ->> 'proyecto_id', ''),
    nullif(fila_vieja ->> 'proyecto_id', '')
  )::uuid;

  if TG_TABLE_NAME = 'proyectos' then
    proy := coalesce(nullif(fila_nueva ->> 'id', ''), nullif(fila_vieja ->> 'id', ''))::uuid;
    -- Salvo cuando el proyecto es justamente lo que se está borrando.
    if TG_OP = 'DELETE' then
      proy := null;
    end if;
  end if;

  org := coalesce(
    nullif(fila_nueva ->> 'organizacion_id', ''),
    nullif(fila_vieja ->> 'organizacion_id', '')
  )::uuid;

  afectada := persona_afectada(
    TG_TABLE_NAME,
    case when TG_OP = 'DELETE' then fila_vieja else fila_nueva end
  );

  if TG_OP = 'INSERT' then
    insert into eventos (tabla, registro_id, proyecto_id, organizacion_id, accion,
                         actor_id, visibilidad, afecta_persona)
    values (TG_TABLE_NAME, (fila_nueva ->> 'id')::uuid, proy, org, 'alta',
            quien, visibilidad_de(TG_TABLE_NAME, null), afectada);
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    insert into eventos (tabla, registro_id, proyecto_id, organizacion_id, accion,
                         actor_id, visibilidad, afecta_persona)
    values (TG_TABLE_NAME, (fila_vieja ->> 'id')::uuid, proy, org, 'baja',
            quien, visibilidad_de(TG_TABLE_NAME, null), afectada);
    return OLD;
  end if;

  for clave in select jsonb_object_keys(fila_nueva) loop
    if campo_ruidoso(clave) then continue; end if;
    if fila_vieja -> clave is distinct from fila_nueva -> clave then
      insert into eventos (tabla, registro_id, proyecto_id, organizacion_id, accion,
                           campo, valor_anterior, valor_nuevo,
                           actor_id, visibilidad, afecta_persona)
      values (TG_TABLE_NAME, (fila_nueva ->> 'id')::uuid, proy, org, 'cambio',
              clave, fila_vieja ->> clave, fila_nueva ->> clave,
              quien, visibilidad_de(TG_TABLE_NAME, clave), afectada);
    end if;
  end loop;

  return NEW;
end;
$$;
