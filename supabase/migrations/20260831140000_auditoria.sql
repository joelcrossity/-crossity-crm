-- ============================================================
-- Correcciones de la auditoría previa a subir a la nube.
-- Cada bloque arregla algo que estaba roto de verdad, no de estilo.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cargar un gasto no recalculaba la parte de nadie.
--
-- Los recálculos colgaban sólo de participaciones y del monto del hito.
-- Alguien cargaba una licencia de $80.000 y las porciones seguían mostrando
-- el número viejo: todos veían de más y nadie se enteraba.
-- ------------------------------------------------------------

create or replace function porciones_al_cambiar_costo()
returns trigger
language plpgsql
as $$
declare v_proyecto uuid;
begin
  v_proyecto := coalesce(NEW.proyecto_id, OLD.proyecto_id);
  perform recalcular_proyecto(v_proyecto);
  return coalesce(NEW, OLD);
end;
$$;

create trigger gastos_recalculan
  after insert or update or delete on gastos
  for each row execute function porciones_al_cambiar_costo();

create trigger impuestos_recalculan
  after insert or update or delete on impuestos
  for each row execute function porciones_al_cambiar_costo();

-- ------------------------------------------------------------
-- 2. Una porción ya devengada no se puede mover.
--
-- El recálculo respetaba sólo lo liquidado. Pero devengado significa
-- facturado: el número ya se le dijo al cliente y a la persona. Si un
-- gasto tardío lo bajara, alguien cobraría menos de lo que se le informó.
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
  where porciones.estado = 'comprometido';
end;
$$;

-- ------------------------------------------------------------
-- 3. Registrar un cobro no hacía absolutamente nada.
--
-- Toda la cadena —devengado a liquidar, y la compuerta del anticipo—
-- colgaba de `hitos.cobrado_at`, que había que actualizar a mano.
-- Insertar en cobros no lo tocaba: administración registraba el pago
-- y el equipo nunca se enteraba de que podía arrancar.
-- ------------------------------------------------------------

create or replace function cobro_impacta_hito()
returns trigger
language plpgsql
as $$
declare
  v_cobrado numeric(14,2);
  v_debido  numeric(14,2);
begin
  select coalesce(sum(monto), 0) into v_cobrado
    from cobros where hito_id = NEW.hito_id;

  select monto_neto into v_debido from hitos where id = NEW.hito_id;

  -- Un pago parcial no habilita nada: el hito se da por cobrado
  -- cuando entró todo. Con un peso de tolerancia por redondeos.
  if v_cobrado >= v_debido - 1 then
    update hitos
       set cobrado_at = coalesce(cobrado_at, NEW.fecha::timestamptz),
           facturado_at = coalesce(facturado_at, NEW.fecha::timestamptz)
     where id = NEW.hito_id
       and cobrado_at is null;
  end if;

  return NEW;
end;
$$;

create trigger cobros_impactan_hito
  after insert or update on cobros
  for each row execute function cobro_impacta_hito();

-- ------------------------------------------------------------
-- 4. La regla que no se cumplía: "los cambios sobre tu propia plata
--    siempre te son visibles".
--
-- El registro sacaba `afecta_persona` de una columna `persona_id` que
-- porciones no tiene: cuelga de la participación. Resultado: justo los
-- cambios que la regla protegía eran los que no la activaban.
-- ------------------------------------------------------------

create or replace function persona_afectada(p_tabla text, p_fila jsonb)
returns uuid
language plpgsql
stable
as $$
declare v_id uuid;
begin
  -- directo
  v_id := nullif(p_fila ->> 'persona_id', '')::uuid;
  if v_id is not null then return v_id; end if;

  -- a través de la participación
  if p_tabla = 'porciones' and (p_fila ->> 'participacion_id') is not null then
    select pa.persona_id into v_id
      from participaciones pa
     where pa.id = (p_fila ->> 'participacion_id')::uuid;
    return v_id;
  end if;

  return null;
end;
$$;

create or replace function registrar_evento()
returns trigger
language plpgsql
security definer
set search_path = public
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

-- Las porciones no tenían traza: se agrega, que es donde vive la plata.
-- (el trigger ya existía; queda igual, pero ahora resuelve la persona)

-- ------------------------------------------------------------
-- 5. Los impuestos también pueden estar en otra moneda.
--
-- El impuesto al cheque se paga en pesos aunque el proyecto sea en
-- dólares. Sin esto, un proyecto en USD descontaba pesos como si
-- fueran dólares: un error de dos órdenes de magnitud.
-- ------------------------------------------------------------

alter table impuestos
  add column moneda     char(3) not null default 'ARS' references monedas(codigo),
  add column cotizacion numeric(14,4) not null default 1;

comment on column impuestos.cotizacion is
  'Cuántas unidades de la moneda del proyecto vale una de la del impuesto.';

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

  if v_proyecto is null then return 0; end if;

  select case when sum(monto_neto) > 0 then v_monto / sum(monto_neto) else 0 end
    into v_peso
    from hitos where proyecto_id = v_proyecto;

  select coalesce(sum(costo_real * cotizacion), 0) into v_gastos_propios
    from gastos where hito_id = p_hito;

  select coalesce(sum(costo_real * cotizacion), 0) into v_gastos_sueltos
    from gastos where proyecto_id = v_proyecto and hito_id is null;

  select coalesce(sum(monto * cotizacion), 0) into v_impuestos
    from impuestos where hito_id = p_hito;

  return greatest(
    round(v_monto - v_gastos_propios - (v_gastos_sueltos * v_peso) - v_impuestos, 2),
    0
  );
end;
$$;

-- ------------------------------------------------------------
-- 6. El tablero mezclaba obra y abono.
--
-- Son dos preguntas distintas: de un proyecto se pregunta si llega a la
-- fecha; de un mantenimiento, si sigue vigente y al día. Juntos, los
-- abonos inflan el tablero y esconden lo que sí necesita atención.
-- ------------------------------------------------------------

drop view if exists v_tablero;
create view v_tablero
with (security_invoker = true)
as
select
  p.id, p.codigo, p.nombre,
  o.nombre_canonico as cliente,
  o.codigo          as cliente_codigo,
  p.color, p.subestado, p.motivo_gris, p.etapa,
  p.prioridad, p.fecha_comprometida,
  p.es_producto_propio, p.condicion, p.moneda,
  r.nombre          as responsable,
  (current_date - p.fecha_comprometida) as dias_de_atraso,
  extract(day from now() - coalesce(
      (select max(a.ocurrido_at) from actualizaciones a where a.proyecto_id = p.id),
      p.created_at))::int as dias_sin_novedades
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas r  on r.id = p.responsable_id
where p.tipo = 'proyecto';

grant select on v_tablero to authenticated;

-- ------------------------------------------------------------
-- 7. La política de mensajes decía una cosa y hacía otra.
--
-- `a is null and ve_todo() or ve_todo() or participa_en(...)` colapsa por
-- precedencia a `ve_todo() or participa_en(...)`. Funcionaba, pero un
-- permiso que no se lee como lo que hace es un permiso que en la próxima
-- edición alguien rompe sin darse cuenta.
-- ------------------------------------------------------------

drop policy if exists mensajes_lectura on mensajes;
create policy mensajes_lectura on mensajes for select to authenticated
  using (
    ve_todo()
    or (proyecto_id is not null and participa_en(proyecto_id))
  );

-- ------------------------------------------------------------
-- 8. Nada avisaba si el reparto no cerraba en 100 %.
--
-- Va como señal y no como restricción, porque las participaciones se
-- cargan de a una: obligar el 100 % en cada fila haría imposible cargar
-- la primera.
-- ------------------------------------------------------------

create or replace view v_reparto_incompleto
with (security_invoker = true)
as
select
  p.id, p.codigo, p.nombre,
  o.nombre_canonico as cliente,
  coalesce(sum(pa.porcentaje), 0) as suma_porcentajes,
  100 - coalesce(sum(pa.porcentaje), 0) as diferencia
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join participaciones pa on pa.proyecto_id = p.id
where p.color in ('verde', 'gris')
group by p.id, p.codigo, p.nombre, o.nombre_canonico
having coalesce(sum(pa.porcentaje), 0) <> 100;

comment on view v_reparto_incompleto is
  'Un proyecto que reparte 80 % deja un 20 % sin dueño y nadie se entera hasta la liquidación.';

grant select on v_reparto_incompleto to authenticated;

-- ------------------------------------------------------------
-- 9. La historia no se edita.
--
-- actualizaciones tenía política de alta pero ninguna de cambio o baja,
-- así que ya estaba cerrado. Se deja explícito para que se lea como
-- decisión y no como olvido.
-- ------------------------------------------------------------

revoke update, delete on actualizaciones from authenticated;

comment on table actualizaciones is
  'Append-only, como eventos: la línea de tiempo cuenta lo que pasó, no lo que preferiríamos.';
