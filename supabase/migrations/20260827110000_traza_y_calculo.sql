-- ============================================================
-- Traza inmutable, cálculo del reparto y la compuerta del anticipo
-- ============================================================

-- ------------------------------------------------------------
-- Quién está actuando. Devuelve null cuando no hay sesión
-- (migraciones, seed, jobs), y eso está bien.
-- ------------------------------------------------------------

create or replace function persona_actual()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.persona_id
    from usuarios u
   where u.id = auth.uid()
     and u.activo
$$;

create or replace function tiene_rol(r rol_sistema)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select r = any(p.roles) from personas p where p.id = persona_actual()),
    false
  )
$$;

create or replace function es_direccion()
returns boolean
language sql
stable
as $$ select tiene_rol('direccion') $$;

-- ------------------------------------------------------------
-- Eventos. Se escribe, nunca se modifica ni se borra.
-- Lo escriben disparadores, no la aplicación: si dependiera de que
-- el programador se acuerde, en la pantalla número once falta.
-- ------------------------------------------------------------

create table eventos (
  id              bigint generated always as identity primary key,
  tabla           text not null,
  registro_id     uuid,
  proyecto_id     uuid references proyectos(id) on delete cascade,
  organizacion_id uuid references organizaciones(id) on delete cascade,
  accion          text not null check (accion in ('alta', 'cambio', 'baja')),
  campo           text,
  valor_anterior  text,
  valor_nuevo     text,
  actor_id        uuid references personas(id) on delete set null,
  -- el evento hereda la visibilidad del dato que tocó
  visibilidad     tipo_actualizacion not null default 'administrativo',
  afecta_persona  uuid references personas(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index eventos_proyecto on eventos (proyecto_id, created_at desc);
create index eventos_registro on eventos (tabla, registro_id, created_at desc);

comment on column eventos.afecta_persona is
  'Cuando el cambio toca la plata de alguien, esa persona SIEMPRE lo ve — aunque su participación sea cerrada.';

-- Campos cuyo cambio no aporta nada al recorrido.
create or replace function campo_ruidoso(c text)
returns boolean
language sql
immutable
as $$ select c in ('created_at', 'updated_at', 'id') $$;

-- Clasifica el cambio para poder aplicarle la visibilidad después.
create or replace function visibilidad_de(tabla text, campo text)
returns tipo_actualizacion
language sql
immutable
as $$
  select case
    when tabla in ('participaciones', 'gastos', 'impuestos', 'porciones',
                   'cobros', 'liquidaciones')                  then 'administrativo'::tipo_actualizacion
    when tabla = 'contratos'                                    then 'comercial'::tipo_actualizacion
    when tabla = 'hitos' and campo in ('entregado_at')          then 'entrega'::tipo_actualizacion
    when tabla = 'hitos'                                        then 'administrativo'::tipo_actualizacion
    when tabla = 'proyectos' and campo in ('monto_neto', 'condicion',
         'motivo_condicion', 'esquema_cobro')                   then 'comercial'::tipo_actualizacion
    when tabla = 'proyectos' and campo in ('color', 'subestado', 'motivo_gris',
         'motivo_rojo', 'fecha_comprometida', 'prioridad', 'responsable_id')
                                                                then 'entrega'::tipo_actualizacion
    else 'administrativo'::tipo_actualizacion
  end
$$;

create or replace function registrar_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fila_vieja  jsonb;
  fila_nueva  jsonb;
  clave       text;
  proy        uuid;
  org         uuid;
  quien       uuid;
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
  end if;

  org := coalesce(
    nullif(fila_nueva ->> 'organizacion_id', ''),
    nullif(fila_vieja ->> 'organizacion_id', '')
  )::uuid;

  if TG_OP = 'INSERT' then
    insert into eventos (tabla, registro_id, proyecto_id, organizacion_id, accion,
                         actor_id, visibilidad, afecta_persona)
    values (TG_TABLE_NAME, (fila_nueva ->> 'id')::uuid, proy, org, 'alta',
            quien, visibilidad_de(TG_TABLE_NAME, null),
            nullif(fila_nueva ->> 'persona_id', '')::uuid);
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    insert into eventos (tabla, registro_id, proyecto_id, organizacion_id, accion,
                         actor_id, visibilidad, afecta_persona)
    values (TG_TABLE_NAME, (fila_vieja ->> 'id')::uuid, proy, org, 'baja',
            quien, visibilidad_de(TG_TABLE_NAME, null),
            nullif(fila_vieja ->> 'persona_id', '')::uuid);
    return OLD;
  end if;

  -- UPDATE: una fila de evento por campo que cambió
  for clave in select jsonb_object_keys(fila_nueva) loop
    if campo_ruidoso(clave) then
      continue;
    end if;
    if fila_vieja -> clave is distinct from fila_nueva -> clave then
      insert into eventos (tabla, registro_id, proyecto_id, organizacion_id, accion,
                           campo, valor_anterior, valor_nuevo,
                           actor_id, visibilidad, afecta_persona)
      values (TG_TABLE_NAME, (fila_nueva ->> 'id')::uuid, proy, org, 'cambio',
              clave, fila_vieja ->> clave, fila_nueva ->> clave,
              quien, visibilidad_de(TG_TABLE_NAME, clave),
              nullif(fila_nueva ->> 'persona_id', '')::uuid);
    end if;
  end loop;

  return NEW;
end;
$$;

-- Enganchado a todo lo que cuenta una historia.
do $$
declare t text;
begin
  foreach t in array array[
    'organizaciones', 'contactos', 'contratos', 'proyectos', 'asignaciones',
    'participaciones', 'hitos', 'gastos', 'impuestos', 'porciones', 'cobros'
  ] loop
    execute format(
      'create trigger %I_traza after insert or update or delete on %I
       for each row execute function registrar_evento()', t || '_traza', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Base de reparto de un hito.
--   monto del hito (neto, sin IVA)
--   − gastos propios del hito + prorrateo de los del proyecto
--   − impuestos y tasas
-- ------------------------------------------------------------

create or replace function base_de_reparto(p_hito uuid)
returns numeric
language plpgsql
stable
as $$
declare
  v_proyecto      uuid;
  v_monto         numeric(14,2);
  v_peso          numeric;
  v_gastos_propios numeric(14,2);
  v_gastos_sueltos numeric(14,2);
  v_impuestos     numeric(14,2);
begin
  select proyecto_id, monto_neto into v_proyecto, v_monto
    from hitos where id = p_hito;

  if v_proyecto is null then
    return 0;
  end if;

  -- peso del hito dentro del proyecto, para prorratear los gastos sin hito
  select case when sum(monto_neto) > 0 then v_monto / sum(monto_neto) else 0 end
    into v_peso
    from hitos where proyecto_id = v_proyecto;

  select coalesce(sum(costo_real), 0) into v_gastos_propios
    from gastos where hito_id = p_hito;

  select coalesce(sum(costo_real), 0) into v_gastos_sueltos
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
-- Porciones: se generan y recalculan solas desde las participaciones.
-- ------------------------------------------------------------

create or replace function recalcular_porciones(p_hito uuid)
returns void
language plpgsql
as $$
declare
  v_proyecto uuid;
  v_base     numeric(14,2);
begin
  select proyecto_id into v_proyecto from hitos where id = p_hito;
  if v_proyecto is null then return; end if;

  v_base := base_de_reparto(p_hito);

  insert into porciones (hito_id, participacion_id, monto)
  select p_hito, pa.id, round(v_base * pa.porcentaje / 100, 2)
    from participaciones pa
   where pa.proyecto_id = v_proyecto
  on conflict (hito_id, participacion_id) do update
    set monto = excluded.monto
  -- una porción ya liquidada no se toca nunca más
  where porciones.estado <> 'liquidado';
end;
$$;

create or replace function recalcular_proyecto(p_proyecto uuid)
returns void
language plpgsql
as $$
declare h uuid;
begin
  for h in select id from hitos where proyecto_id = p_proyecto loop
    perform recalcular_porciones(h);
  end loop;
end;
$$;

create or replace function porciones_al_cambiar_participacion()
returns trigger
language plpgsql
as $$
begin
  perform recalcular_proyecto(coalesce(NEW.proyecto_id, OLD.proyecto_id));
  return coalesce(NEW, OLD);
end;
$$;

create trigger participaciones_recalculan
  after insert or update or delete on participaciones
  for each row execute function porciones_al_cambiar_participacion();

create or replace function porciones_al_cambiar_hito()
returns trigger
language plpgsql
as $$
begin
  perform recalcular_porciones(NEW.id);
  return NEW;
end;
$$;

create trigger hitos_recalculan
  after insert or update of monto_neto on hitos
  for each row execute function porciones_al_cambiar_hito();

-- ------------------------------------------------------------
-- El recorrido de la plata.
--   facturado  → devengado
--   cobrado    → a liquidar
-- ------------------------------------------------------------

create or replace function avanzar_estado_porciones()
returns trigger
language plpgsql
as $$
begin
  if NEW.facturado_at is not null and OLD.facturado_at is null then
    update porciones set estado = 'devengado'
     where hito_id = NEW.id and estado = 'comprometido';
  end if;

  if NEW.cobrado_at is not null and OLD.cobrado_at is null then
    update porciones set estado = 'a_liquidar'
     where hito_id = NEW.id and estado in ('comprometido', 'devengado');
  end if;

  return NEW;
end;
$$;

create trigger hitos_avanzan_porciones
  after update of facturado_at, cobrado_at on hitos
  for each row execute function avanzar_estado_porciones();

-- ------------------------------------------------------------
-- La compuerta: cobrar el anticipo ES la autorización de arranque.
-- Nadie tiene que dar un aviso aparte.
-- ------------------------------------------------------------

create or replace function abrir_compuerta_anticipo()
returns trigger
language plpgsql
as $$
declare
  v_color color_estado;
  v_motivo motivo_gris;
begin
  if not NEW.es_anticipo then return NEW; end if;
  if NEW.cobrado_at is null or OLD.cobrado_at is not null then return NEW; end if;

  select color, motivo_gris into v_color, v_motivo
    from proyectos where id = NEW.proyecto_id;

  if v_color = 'gris' and v_motivo = 'esperando_anticipo' then
    update proyectos
       set color = 'verde',
           subestado = 'en_curso',
           motivo_gris = null,
           fecha_inicio = coalesce(fecha_inicio, current_date)
     where id = NEW.proyecto_id;

    insert into actualizaciones (proyecto_id, tipo, texto, canal)
    values (NEW.proyecto_id, 'administrativo',
            'Se cobró el anticipo. El proyecto pasa a en curso y el equipo puede arrancar.',
            'sistema');

    -- avisa a todo el equipo asignado, tenga cuenta o no
    insert into notificaciones (persona_id, proyecto_id, titulo, cuerpo, canal)
    select a.persona_id, NEW.proyecto_id,
           'Arranca ' || p.codigo || ' · ' || p.nombre,
           'Se cobró el anticipo. El proyecto está en curso'
             || coalesce(' y la entrega comprometida es el ' ||
                to_char(p.fecha_comprometida, 'DD/MM/YYYY'), '') || '.',
           'email'
      from asignaciones a
      join proyectos p on p.id = NEW.proyecto_id
     where a.proyecto_id = NEW.proyecto_id
       and a.hasta is null;
  end if;

  return NEW;
end;
$$;

create trigger hitos_abren_compuerta
  after update of cobrado_at on hitos
  for each row execute function abrir_compuerta_anticipo();

-- ------------------------------------------------------------
-- Generación de hitos según el esquema de cobro elegido.
-- ------------------------------------------------------------

create or replace function generar_hitos(
  p_proyecto uuid,
  p_esquema  esquema_cobro default null,
  p_cuotas   integer default 6
)
returns void
language plpgsql
as $$
declare
  v_esquema esquema_cobro;
  v_monto   numeric(14,2);
  v_fecha   date;
  i         integer;
begin
  select coalesce(p_esquema, esquema_cobro), coalesce(monto_neto, 0), fecha_comprometida
    into v_esquema, v_monto, v_fecha
    from proyectos where id = p_proyecto;

  if exists (select 1 from hitos where proyecto_id = p_proyecto) then
    raise exception 'El proyecto % ya tiene hitos', p_proyecto;
  end if;

  if v_esquema = 'cincuenta_cincuenta' then
    insert into hitos (proyecto_id, orden, titulo, porcentaje, monto_neto, es_anticipo, fecha_comprometida)
    values (p_proyecto, 1, 'Anticipo para arrancar', 50, round(v_monto * 0.5, 2), true, null),
           (p_proyecto, 2, 'Saldo contra entrega',   50, round(v_monto * 0.5, 2), false, v_fecha);

  elsif v_esquema = 'adelantado' then
    insert into hitos (proyecto_id, orden, titulo, porcentaje, monto_neto, es_anticipo, fecha_comprometida)
    values (p_proyecto, 1, 'Pago total por adelantado', 100, v_monto, true, null);

  elsif v_esquema = 'mensual' then
    for i in 1..p_cuotas loop
      insert into hitos (proyecto_id, orden, titulo, porcentaje, monto_neto, es_anticipo, fecha_comprometida)
      values (p_proyecto, i, 'Mes ' || i, round(100.0 / p_cuotas, 3),
              round(v_monto / p_cuotas, 2), i = 1,
              (coalesce(v_fecha, current_date) + ((i - 1) || ' month')::interval)::date);
    end loop;

  elsif v_esquema = 'por_hitos' then
    -- arranca con cuatro etapas parejas; se ajustan a mano por proyecto
    for i in 1..4 loop
      insert into hitos (proyecto_id, orden, titulo, porcentaje, monto_neto, es_anticipo, fecha_comprometida)
      values (p_proyecto, i, 'Entrega ' || i, 25, round(v_monto * 0.25, 2), i = 1, null);
    end loop;
  end if;

  -- Con hitos y sin anticipo cobrado, el proyecto queda en standby.
  if v_esquema <> 'a_convenir' then
    update proyectos
       set color = 'gris',
           motivo_gris = 'esperando_anticipo',
           subestado = null
     where id = p_proyecto
       and color <> 'rojo'
       and not arranco_sin_anticipo;
  end if;
end;
$$;
