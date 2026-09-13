-- ------------------------------------------------------------------
-- Los switches de /equipo pasan a mandar de verdad.
--
-- De los seis, solo dos se aplicaban: ver_facturacion y ver_economia,
-- vía ve_facturacion_de() y ve_economia_de(). Los otros cuatro se
-- guardaban en permisos_persona y no los consultaba nadie. Había dos
-- ajustes hechos para Tomás —cargar_cobros apagado, cambiar_montos
-- prendido— y ninguno de los dos tenía efecto.
--
-- Una pantalla de permisos que no se aplica es peor que no tenerla:
-- alguien apaga un switch, se queda tranquilo, y el permiso sigue ahí.
--
-- El reemplazo preserva el comportamiento actual. puede_persona()
-- resuelve primero el ajuste de la persona y, si no hay, lo que traen
-- sus roles; y roles_permisos ya daba cargar_cobros y cambiar_montos a
-- dirección y administración, que es exactamente lo que decía el
-- es_direccion() or es_admin() escrito a mano. Nadie pierde lo que
-- tenía: lo que cambia es que ahora el switch puede modificarlo.
-- ------------------------------------------------------------------


-- 1. cargar_cobros ---------------------------------------------------
-- Registrar que entró la plata de un cliente.

drop policy if exists cobros_escritura_alta on cobros;
create policy cobros_escritura_alta on cobros
  for insert to authenticated
  with check (puede_persona('cargar_cobros'));

drop policy if exists cobros_escritura_cambio on cobros;
create policy cobros_escritura_cambio on cobros
  for update to authenticated
  using (puede_persona('cargar_cobros'))
  with check (puede_persona('cargar_cobros'));

drop policy if exists cobros_escritura_baja on cobros;
create policy cobros_escritura_baja on cobros
  for delete to authenticated
  using (puede_persona('cargar_cobros'));


-- 2. cambiar_montos --------------------------------------------------
-- "Tocar el precio de un proyecto o de una entrega."
--
-- Va como trigger y no como política: RLS decide por fila, y acá lo que
-- hay que mirar es una columna. Con una política habría que prohibir
-- todo cambio sobre hitos, y entonces un PM no podría marcar una
-- entrega como entregada sin poder además cambiarle el precio. Son dos
-- permisos distintos y tienen que poder separarse.
--
-- Solo en UPDATE. Crear algo con un precio es cotizar, que es el
-- trabajo de un vendedor; cambiarle el precio a algo que ya existe y
-- que el cliente ya vio es otra cosa.

create or replace function exige_cambiar_montos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if puede_persona('cambiar_montos') then
    return new;
  end if;

  if tg_table_name = 'hitos' then
    if new.monto_neto is distinct from old.monto_neto then
      raise exception 'No tenés el permiso para cambiar montos.'
        using hint = 'Se activa en Sistema → Usuarios y roles.';
    end if;
  elsif tg_table_name = 'proyectos' then
    if new.monto_neto      is distinct from old.monto_neto
    or new.monto_mensual   is distinct from old.monto_mensual
    or new.precio_unitario is distinct from old.precio_unitario then
      raise exception 'No tenés el permiso para cambiar montos.'
        using hint = 'Se activa en Sistema → Usuarios y roles.';
    end if;
  end if;

  return new;
end;
$$;

comment on function exige_cambiar_montos is
  'Frena el cambio de precio si la persona no tiene cambiar_montos. Mira la columna, que es lo que RLS no puede hacer.';

drop trigger if exists hitos_cambiar_montos on hitos;
create trigger hitos_cambiar_montos
  before update on hitos
  for each row execute function exige_cambiar_montos();

drop trigger if exists proyectos_cambiar_montos on proyectos;
create trigger proyectos_cambiar_montos
  before update on proyectos
  for each row execute function exige_cambiar_montos();


-- 3. ver_comercial ---------------------------------------------------
-- "Lo que se habló en el embudo: precios tanteados, dudas del cliente."
--
-- Se suma al alcance por fila, no lo reemplaza: el switch dice si la
-- persona puede ver notas comerciales, y participa_en() sigue diciendo
-- de cuáles. Tener el permiso no es ver las de todos los proyectos.

drop policy if exists notas_lectura on notas_de_venta;
create policy notas_lectura on notas_de_venta
  for select to authenticated
  using (
    puede_persona('ver_comercial')
    and (ve_todo() or proyecto_id is null or participa_en(proyecto_id))
  );

drop policy if exists notas_alta on notas_de_venta;
create policy notas_alta on notas_de_venta
  for insert to authenticated
  with check (
    puede_persona('ver_comercial')
    and (ve_todo() or proyecto_id is null or participa_en(proyecto_id))
  );

drop policy if exists notas_cambio on notas_de_venta;
create policy notas_cambio on notas_de_venta
  for update to authenticated
  using (
    puede_persona('ver_comercial')
    and (ve_todo() or proyecto_id is null or participa_en(proyecto_id))
  );

drop policy if exists notas_baja on notas_de_venta;
create policy notas_baja on notas_de_venta
  for delete to authenticated
  using (puede_persona('ver_comercial') and ve_todo());


-- 4. configurar_equipo -----------------------------------------------
-- "Sumar y sacar gente de un proyecto."
--
-- Igual que arriba: el switch dice si puede armar equipos, y
-- participa_en() de qué proyectos. Un PM con el permiso arma el equipo
-- de los suyos, no el de toda la agencia.
--
-- participaciones queda como estaba, a propósito: eso no es armar un
-- equipo, es definir cuánta plata se lleva cada uno. Es otro permiso y
-- merece su propia decisión, no venir de arrastre con éste.

drop policy if exists asignaciones_escritura_alta on asignaciones;
create policy asignaciones_escritura_alta on asignaciones
  for insert to authenticated
  with check (
    puede_persona('configurar_equipo')
    and (ve_todo() or participa_en(proyecto_id))
  );

drop policy if exists asignaciones_escritura_baja on asignaciones;
create policy asignaciones_escritura_baja on asignaciones
  for delete to authenticated
  using (
    puede_persona('configurar_equipo')
    and (ve_todo() or participa_en(proyecto_id))
  );
