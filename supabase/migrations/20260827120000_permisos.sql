-- ============================================================
-- Permisos. La regla maestra:
--   cada uno ve TODO lo suyo de la plata y NADA de lo del otro.
--   Dirección y administración ven el conjunto.
-- ============================================================

create or replace function es_admin()
returns boolean language sql stable as $$ select tiene_rol('administracion') $$;

create or replace function es_pm()
returns boolean language sql stable as $$ select tiene_rol('project_manager') $$;

-- Ve la operación completa de todos los proyectos.
create or replace function ve_todo()
returns boolean language sql stable as $$ select es_direccion() or es_admin() or es_pm() $$;

create or replace function participa_en(p_proyecto uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from asignaciones a
     where a.proyecto_id = p_proyecto
       and a.persona_id = persona_actual()
       and a.hasta is null
  ) or exists (
    select 1 from participaciones pa
     where pa.proyecto_id = p_proyecto
       and pa.persona_id = persona_actual()
  )
$$;

-- La transparencia se decide por participación, no por rol.
create or replace function apertura_abierta_en(p_proyecto uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from participaciones pa
     where pa.proyecto_id = p_proyecto
       and pa.persona_id = persona_actual()
       and pa.apertura = 'abierta'
  )
$$;

-- Ve la economía del proyecto: dirección, administración, PM, o socio abierto.
create or replace function ve_economia_de(p_proyecto uuid)
returns boolean
language sql
stable
as $$ select ve_todo() or apertura_abierta_en(p_proyecto) $$;

-- ------------------------------------------------------------
-- Todo cerrado por defecto.
-- ------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'personas', 'usuarios', 'organizaciones', 'contactos', 'contratos',
    'proyectos', 'asignaciones', 'participaciones', 'hitos', 'gastos',
    'impuestos', 'porciones', 'liquidaciones', 'cobros', 'actualizaciones',
    'mensajes', 'notificaciones', 'documentos', 'eventos'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Personas y usuarios
-- ------------------------------------------------------------

create policy personas_lectura on personas for select to authenticated
  using (true);   -- el padrón es público adentro de la empresa; la plata no

create policy personas_escritura on personas for all to authenticated
  using (es_direccion() or es_admin()) with check (es_direccion() or es_admin());

create policy usuarios_propio on usuarios for select to authenticated
  using (persona_id = persona_actual() or es_direccion());

-- ------------------------------------------------------------
-- Clientes y contactos
-- ------------------------------------------------------------

create policy organizaciones_lectura on organizaciones for select to authenticated
  using (
    ve_todo()
    or exists (
      select 1 from proyectos p
       where p.organizacion_id = organizaciones.id
         and participa_en(p.id)
    )
  );

create policy organizaciones_escritura on organizaciones for all to authenticated
  using (ve_todo()) with check (ve_todo());

create policy contactos_lectura on contactos for select to authenticated
  using (
    ve_todo()
    or exists (
      select 1 from proyectos p
       where p.organizacion_id = contactos.organizacion_id
         and participa_en(p.id)
    )
  );

create policy contactos_escritura on contactos for all to authenticated
  using (ve_todo()) with check (ve_todo());

-- Los contratos son conversación comercial: no los ve desarrollo.
create policy contratos_lectura on contratos for select to authenticated
  using (es_direccion() or es_admin() or es_pm() or tiene_rol('vendedor'));

create policy contratos_escritura on contratos for all to authenticated
  using (es_direccion() or es_pm()) with check (es_direccion() or es_pm());

-- ------------------------------------------------------------
-- Proyectos
-- ------------------------------------------------------------

create policy proyectos_lectura on proyectos for select to authenticated
  using (ve_todo() or participa_en(id));

create policy proyectos_escritura on proyectos for all to authenticated
  using (ve_todo()) with check (ve_todo());

create policy asignaciones_lectura on asignaciones for select to authenticated
  using (ve_todo() or participa_en(proyecto_id));

create policy asignaciones_escritura on asignaciones for all to authenticated
  using (ve_todo()) with check (ve_todo());

-- ------------------------------------------------------------
-- La plata. Acá vive la regla maestra.
-- ------------------------------------------------------------

-- Cada uno ve SU participación. Nadie ve la del otro, ni siquiera el PM.
create policy participaciones_lectura on participaciones for select to authenticated
  using (
    es_direccion() or es_admin()
    or persona_id = persona_actual()
  );

create policy participaciones_escritura on participaciones for all to authenticated
  using (es_direccion()) with check (es_direccion());

-- Los hitos los ve todo el equipo del proyecto (son las entregas);
-- los montos se filtran a nivel vista, no a nivel fila.
create policy hitos_lectura on hitos for select to authenticated
  using (ve_todo() or participa_en(proyecto_id));

create policy hitos_escritura on hitos for all to authenticated
  using (ve_todo()) with check (ve_todo());

create policy gastos_lectura on gastos for select to authenticated
  using (ve_economia_de(proyecto_id));

create policy gastos_escritura on gastos for all to authenticated
  using (es_direccion() or es_admin() or es_pm())
  with check (es_direccion() or es_admin() or es_pm());

create policy impuestos_lectura on impuestos for select to authenticated
  using (ve_economia_de(proyecto_id));

create policy impuestos_escritura on impuestos for all to authenticated
  using (es_direccion() or es_admin())
  with check (es_direccion() or es_admin());

-- Mi posición: veo mis porciones y nada más.
create policy porciones_lectura on porciones for select to authenticated
  using (
    es_direccion() or es_admin()
    or exists (
      select 1 from participaciones pa
       where pa.id = porciones.participacion_id
         and pa.persona_id = persona_actual()
    )
  );

create policy porciones_escritura on porciones for all to authenticated
  using (es_direccion() or es_admin())
  with check (es_direccion() or es_admin());

create policy liquidaciones_lectura on liquidaciones for select to authenticated
  using (es_direccion() or es_admin());

create policy liquidaciones_escritura on liquidaciones for all to authenticated
  using (es_direccion() or es_admin())
  with check (es_direccion() or es_admin());

create policy cobros_lectura on cobros for select to authenticated
  using (
    es_direccion() or es_admin()
    or exists (
      select 1 from hitos h
       where h.id = cobros.hito_id
         and apertura_abierta_en(h.proyecto_id)
    )
  );

create policy cobros_escritura on cobros for all to authenticated
  using (es_direccion() or es_admin())
  with check (es_direccion() or es_admin());

-- ------------------------------------------------------------
-- Línea de tiempo: la visibilidad se aplica POR TIPO de entrada.
-- Lo que no corresponde no aparece como candado: no existe.
-- ------------------------------------------------------------

create policy actualizaciones_lectura on actualizaciones for select to authenticated
  using (
    es_direccion()
    or (
      (proyecto_id is null or ve_todo() or participa_en(proyecto_id))
      and (
        tipo <> 'comercial'
        or es_pm() or tiene_rol('vendedor')
      )
      and (
        tipo <> 'decision'
        or es_pm() or es_admin()
      )
    )
  );

create policy actualizaciones_escritura on actualizaciones for insert to authenticated
  with check (proyecto_id is null or ve_todo() or participa_en(proyecto_id));

create policy mensajes_lectura on mensajes for select to authenticated
  using (proyecto_id is null and ve_todo() or ve_todo() or participa_en(proyecto_id));

create policy mensajes_escritura on mensajes for insert to authenticated
  with check (ve_todo() or participa_en(proyecto_id));

-- Cada uno ve sus propios avisos.
create policy notificaciones_propias on notificaciones for select to authenticated
  using (persona_id = persona_actual() or es_direccion());

create policy notificaciones_marcar on notificaciones for update to authenticated
  using (persona_id = persona_actual()) with check (persona_id = persona_actual());

create policy documentos_lectura on documentos for select to authenticated
  using (
    ve_todo()
    or (proyecto_id is not null and participa_en(proyecto_id))
  );

create policy documentos_escritura on documentos for all to authenticated
  using (ve_todo()) with check (ve_todo());

-- ------------------------------------------------------------
-- La traza. Se lee filtrada; NO se modifica ni se borra, para nadie.
-- Si dirección pudiera editarla, no probaría nada.
-- ------------------------------------------------------------

create policy eventos_lectura on eventos for select to authenticated
  using (
    -- lo que toca mi propia plata siempre lo veo: sin excepción
    afecta_persona = persona_actual()
    or es_direccion()
    or (
      (proyecto_id is null or ve_todo() or participa_en(proyecto_id))
      and (visibilidad <> 'comercial' or es_pm() or tiene_rol('vendedor'))
      and (visibilidad <> 'decision'  or es_pm() or es_admin())
    )
  );

-- Sin políticas de update ni delete: quedan denegadas para todos.
revoke update, delete on eventos from authenticated, anon;

comment on table eventos is
  'Append-only. Un registro que se puede editar no es un registro.';

-- ------------------------------------------------------------
-- Vistas: lo que RLS no puede hacer (filtrar columnas, no filas).
-- ------------------------------------------------------------

-- El tablero: sólo lo que está vivo, ordenado por prioridad.
create or replace view v_tablero
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico            as cliente,
  o.codigo                     as cliente_codigo,
  p.color,
  p.subestado,
  p.motivo_gris,
  p.prioridad,
  p.fecha_comprometida,
  p.es_producto_propio,
  p.condicion,
  r.nombre                     as responsable,
  (current_date - p.fecha_comprometida)                       as dias_de_atraso,
  extract(day from now() - coalesce(
      (select max(a.ocurrido_at) from actualizaciones a where a.proyecto_id = p.id),
      p.created_at))::int                                     as dias_sin_novedades
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas r  on r.id = p.responsable_id;

comment on view v_tablero is
  'Días sin novedades es la columna que más importa: es el detector automático de los proyectos que se están cayendo.';

-- Mi posición: los cuatro estados de mi plata, sólo la mía.
create or replace view v_mi_posicion
with (security_invoker = true)
as
select
  pa.persona_id,
  sum(po.monto) filter (where po.estado = 'comprometido') as comprometido,
  sum(po.monto) filter (where po.estado = 'devengado')    as devengado,
  sum(po.monto) filter (where po.estado = 'a_liquidar')   as a_liquidar,
  sum(po.monto) filter (where po.estado = 'liquidado')    as liquidado,
  count(distinct pa.proyecto_id)                          as proyectos
from porciones po
join participaciones pa on pa.id = po.participacion_id
group by pa.persona_id;

-- Posición por participante, para administración.
create or replace view v_posicion_general
with (security_invoker = true)
as
select
  coalesce(pe.nombre, 'Crossity · gestión') as participante,
  pa.persona_id,
  pa.es_crossity,
  sum(po.monto) filter (where po.estado = 'devengado')  as devengado,
  sum(po.monto) filter (where po.estado = 'a_liquidar') as a_liquidar,
  sum(po.monto) filter (where po.estado = 'liquidado')  as liquidado,
  count(distinct pa.proyecto_id)                        as proyectos
from porciones po
join participaciones pa on pa.id = po.participacion_id
left join personas pe   on pe.id = pa.persona_id
group by pe.nombre, pa.persona_id, pa.es_crossity;
