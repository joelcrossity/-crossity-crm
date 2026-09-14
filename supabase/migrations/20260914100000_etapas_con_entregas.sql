-- ------------------------------------------------------------------
-- Una cotización tiene dos niveles, y yo había armado uno solo.
--
-- Lo que hice fue una lista plana donde cada fila era a la vez el
-- alcance y la forma de pago. Sirve para un trabajo simple y no alcanza
-- para como se cotiza de verdad acá:
--
--   Etapa 1 · Sitio web      10.000     un alcance
--      Anticipo 50%           5.000     su forma de pago
--      Entrega  50%           5.000
--   Etapa 2 · Agente IA       8.000     otro alcance
--      Anticipo 30%           2.400     otra forma de pago
--      Avance   40%           3.200
--      Final    30%           2.400
--
-- Son dos cosas distintas y se mezclaban. La etapa es qué se hace: un
-- bloque de alcance que el cliente aprueba o no aprueba entero. La
-- entrega es cuándo se paga: la misma etapa puede ser 50/50 y la
-- siguiente 30/40/30, porque se negociaron por separado.
--
-- Mezclarlas obliga a lo que Joel describió: volver a armar otro
-- proyecto para la etapa dos, cuando es el mismo trabajo para el mismo
-- cliente y la cotización lo presenta junto.
--
-- La etapa lleva el alcance y el nombre. La plata sigue en las entregas
-- —monto, moneda, dólar, fechas— y el total de la etapa se suma. Poner
-- un total en la etapa además del de sus entregas sería tener dos
-- números que se separan la primera vez que alguien corrige uno.
-- ------------------------------------------------------------------

create table if not exists etapas_cotizacion (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  orden       integer not null,
  nombre      text not null,
  alcance     text,
  created_at  timestamptz not null default now(),
  unique (proyecto_id, orden)
);

comment on table etapas_cotizacion is
  'Un bloque de alcance dentro de una cotización: lo que el cliente aprueba o no aprueba entero. Sus entregas (hitos) dicen cómo se paga. El total se suma, no se guarda.';

alter table hitos add column if not exists etapa_id uuid references etapas_cotizacion(id) on delete cascade;

comment on column hitos.etapa_id is
  'De qué etapa de la cotización es esta entrega. Vacío en lo cargado antes de que existieran las etapas, y en los trabajos que se cotizan de una sola vez.';

create index if not exists hitos_por_etapa on hitos (etapa_id);

alter table etapas_cotizacion enable row level security;

drop policy if exists etapas_cot_lectura on etapas_cotizacion;
create policy etapas_cot_lectura on etapas_cotizacion for select to authenticated
  using (ve_todo() or participa_en(proyecto_id));

drop policy if exists etapas_cot_escritura on etapas_cotizacion;
create policy etapas_cot_escritura on etapas_cotizacion for all to authenticated
  using (ve_todo() or participa_en(proyecto_id))
  with check (ve_todo() or participa_en(proyecto_id));

grant select, insert, update, delete on etapas_cotizacion to authenticated;


-- ------------------------------------------------------------------
-- Guardar la cotización con sus dos niveles.
--
-- Reemplaza a guardar_etapas, que trabajaba con la lista plana. Recibe
-- las etapas y adentro de cada una sus entregas.
--
-- Lo que ya arrancó no se toca, igual que antes: una entrega activa
-- tiene plata repartida y cuentas que dependen de ella.
-- ------------------------------------------------------------------

create or replace function guardar_cotizacion_por_etapas(p_proyecto uuid, p_etapas jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total    numeric := 0;
  v_etapas   uuid[] := array[]::uuid[];
  v_entregas uuid[] := array[]::uuid[];
  e          jsonb;
  h          jsonb;
  v_eid      uuid;
  v_hid      uuid;
  v_orden    integer := 0;
  v_sub      integer;
begin
  if not (ve_todo() or participa_en(p_proyecto)) then
    raise exception 'No tenés permiso sobre esta oportunidad.';
  end if;
  if not puede_persona('cambiar_montos') then
    raise exception 'No tenés el permiso para cambiar montos.'
      using hint = 'Se activa en Sistema → Usuarios y roles.';
  end if;

  -- Fuera del camino: el orden es único por proyecto y por etapa.
  update etapas_cotizacion set orden = orden + 10000 where proyecto_id = p_proyecto;
  update hitos set orden = orden + 10000 where proyecto_id = p_proyecto and activo = false;

  for e in select * from jsonb_array_elements(coalesce(p_etapas, '[]'::jsonb)) loop
    v_orden := v_orden + 1;
    v_eid := nullif(e->>'id', '')::uuid;

    if v_eid is null then
      insert into etapas_cotizacion (proyecto_id, orden, nombre, alcance)
      values (p_proyecto, v_orden, e->>'nombre', nullif(e->>'alcance',''))
      returning id into v_eid;
    else
      update etapas_cotizacion
         set orden = v_orden, nombre = e->>'nombre', alcance = nullif(e->>'alcance','')
       where id = v_eid and proyecto_id = p_proyecto;
    end if;
    v_etapas := v_etapas || v_eid;

    v_sub := 0;
    for h in select * from jsonb_array_elements(coalesce(e->'entregas', '[]'::jsonb)) loop
      v_sub := v_sub + 1;
      v_hid := nullif(h->>'id', '')::uuid;

      if v_hid is null then
        insert into hitos (proyecto_id, etapa_id, orden, titulo, entregable, porcentaje,
                           monto_neto, moneda, casa_cotizacion, cotizacion_pactada,
                           vence_at, es_anticipo, activo)
        values (p_proyecto, v_eid, v_orden * 100 + v_sub,
                h->>'titulo', nullif(h->>'entregable',''),
                nullif(h->>'porcentaje','')::numeric,
                (h->>'monto')::numeric,
                coalesce(nullif(h->>'moneda',''), 'ARS'),
                nullif(h->>'casa',''), nullif(h->>'cotizacion','')::numeric,
                nullif(h->>'vence','')::date,
                coalesce((h->>'es_anticipo')::boolean, v_sub = 1),
                false)
        returning id into v_hid;
      else
        update hitos
           set etapa_id = v_eid,
               orden = v_orden * 100 + v_sub,
               titulo = h->>'titulo',
               entregable = nullif(h->>'entregable',''),
               porcentaje = nullif(h->>'porcentaje','')::numeric,
               monto_neto = (h->>'monto')::numeric,
               moneda = coalesce(nullif(h->>'moneda',''), 'ARS'),
               casa_cotizacion = nullif(h->>'casa',''),
               cotizacion_pactada = nullif(h->>'cotizacion','')::numeric,
               vence_at = nullif(h->>'vence','')::date
         where id = v_hid and proyecto_id = p_proyecto and activo = false;
      end if;

      v_entregas := v_entregas || v_hid;
      v_total := v_total + (h->>'monto')::numeric;
    end loop;
  end loop;

  delete from hitos
   where proyecto_id = p_proyecto and activo = false and not (id = any(v_entregas));
  delete from etapas_cotizacion
   where proyecto_id = p_proyecto and not (id = any(v_etapas));

  update proyectos p
     set monto_neto = (select coalesce(sum(x.monto_neto), 0) from hitos x where x.proyecto_id = p.id)
   where p.id = p_proyecto;

  return v_total;
end;
$$;

grant execute on function guardar_cotizacion_por_etapas(uuid, jsonb) to authenticated;


-- Ganar activa etapas enteras, no entregas sueltas: el cliente aprueba
-- un alcance, no la mitad de un alcance.
create or replace function ganar_oportunidad(
  p_proyecto uuid,
  p_esquema esquema_cobro default 'cincuenta_cincuenta',
  p_activar uuid[] default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_cotizados integer; v_etapas integer;
begin
  if not (ve_todo() or participa_en(p_proyecto)) then
    raise exception 'No tenés permiso sobre esta oportunidad.';
  end if;

  select count(*) into v_cotizados from hitos where proyecto_id = p_proyecto;
  select count(*) into v_etapas from etapas_cotizacion where proyecto_id = p_proyecto;

  update proyectos
     set etapa = 'ganado', color = 'verde', subestado = 'en_curso',
         motivo_gris = null, esquema_cobro = p_esquema,
         fecha_inicio = coalesce(fecha_inicio, current_date),
         proxima_accion = null, proximo_seguimiento = null
   where id = p_proyecto;

  if v_cotizados = 0 then
    perform generar_hitos(p_proyecto, p_esquema);
    return;
  end if;

  if v_etapas > 0 then
    -- Lo que llega son ids de etapa: se activan sus entregas.
    update hitos h
       set activo = (p_activar is null or h.etapa_id = any(p_activar))
     where h.proyecto_id = p_proyecto;
  else
    -- Cotización plana, como se venía usando.
    update hitos set activo = (p_activar is null or id = any(p_activar))
     where proyecto_id = p_proyecto;
  end if;
end;
$$;

grant execute on function ganar_oportunidad(uuid, esquema_cobro, uuid[]) to authenticated;


-- ------------------------------------------------------------------
-- La cotización armada, para leerla de una.
-- ------------------------------------------------------------------

drop view if exists v_cotizacion;
create view v_cotizacion
with (security_invoker = true)
as
select
  e.id            as etapa_id,
  e.proyecto_id,
  p.codigo,
  o.nombre_canonico as cliente,
  e.orden,
  e.nombre,
  e.alcance,
  (select count(*) from hitos h where h.etapa_id = e.id)                       as entregas,
  (select coalesce(sum(h.monto_neto), 0) from hitos h where h.etapa_id = e.id) as total,
  (select min(h.moneda) from hitos h where h.etapa_id = e.id)                  as moneda,
  (select bool_and(h.activo) from hitos h where h.etapa_id = e.id)             as arrancada,
  (select bool_or(h.activo) from hitos h where h.etapa_id = e.id)              as arrancada_en_parte
from etapas_cotizacion e
join proyectos p      on p.id = e.proyecto_id
join organizaciones o on o.id = p.organizacion_id;

grant select on v_cotizacion to authenticated;
