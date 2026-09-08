-- ============================================================
-- Dos responsables, el programa que financia, y el monto editable.
-- ============================================================

-- ------------------------------------------------------------
-- Un proyecto tiene dos responsables y no son lo mismo: uno responde
-- por que se entregue, el otro por cómo está hecho.
-- ------------------------------------------------------------

alter table proyectos
  add column responsable_tecnico_id uuid references personas(id) on delete set null;

comment on column proyectos.responsable_id is
  'Responsable del proyecto: responde por la entrega, la fecha y el cliente.';
comment on column proyectos.responsable_tecnico_id is
  'Responsable técnico: responde por cómo está construido.';

-- ------------------------------------------------------------
-- Programa que financia o encuadra el proyecto: Kit 4.0, CFI, Repec.
-- Texto y no catálogo por ahora: no se sabe todavía cuántos son ni si
-- se repiten, y una tabla vacía de tres filas no aporta nada.
-- ------------------------------------------------------------

alter table proyectos
  add column programa text;

create index proyectos_por_programa on proyectos (programa) where programa is not null;

comment on column proyectos.programa is
  'Kit 4.0, CFI, Repec. Cuando haya suficientes y se repitan, se normaliza.';

-- ------------------------------------------------------------
-- Cambiar el monto del proyecto reajusta las entregas que todavía no
-- se facturaron. Las facturadas NO se tocan: ese número ya se le dijo
-- al cliente y a los participantes, y moverlo sería reescribir el pasado.
-- ------------------------------------------------------------

create or replace function reajustar_hitos(p_proyecto uuid)
returns void
language plpgsql
as $$
declare
  v_monto     numeric(14,2);
  v_congelado numeric(14,2);
  v_pct_libre numeric;
begin
  select coalesce(monto_neto, 0) into v_monto from proyectos where id = p_proyecto;

  -- lo que ya se facturó queda como está
  select coalesce(sum(monto_neto), 0) into v_congelado
    from hitos where proyecto_id = p_proyecto and facturado_at is not null;

  -- y el resto se reparte según los porcentajes de los hitos libres
  select coalesce(sum(porcentaje), 0) into v_pct_libre
    from hitos where proyecto_id = p_proyecto and facturado_at is null;

  if v_pct_libre <= 0 then
    return;
  end if;

  update hitos
     set monto_neto = round((v_monto - v_congelado) * (porcentaje / v_pct_libre), 2)
   where proyecto_id = p_proyecto
     and facturado_at is null;
end;
$$;

comment on function reajustar_hitos is
  'Un hito facturado no se reajusta nunca: ese número ya salió de la empresa.';

create or replace function proyectos_reajustan_hitos()
returns trigger
language plpgsql
as $$
begin
  if NEW.monto_neto is distinct from OLD.monto_neto then
    perform reajustar_hitos(NEW.id);
  end if;
  return NEW;
end;
$$;

create trigger proyectos_al_cambiar_monto
  after update of monto_neto on proyectos
  for each row execute function proyectos_reajustan_hitos();

-- ------------------------------------------------------------
-- Sumar y sacar gente del equipo sin poder leer lo que no corresponde.
-- ------------------------------------------------------------

create or replace function sumar_al_equipo(
  p_proyecto uuid,
  p_persona  uuid,
  p_rol      rol_sistema,
  p_apertura apertura_participacion default 'cerrada'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not ve_todo() then
    raise exception 'Sólo dirección, administración o coordinación arman el equipo';
  end if;

  insert into asignaciones (proyecto_id, persona_id, rol, apertura)
  values (p_proyecto, p_persona, p_rol, p_apertura)
  on conflict do nothing;
end;
$$;

-- Sacar a alguien no borra su paso por el proyecto: le pone fecha de baja.
-- Si nunca hubo nada que registrar, se borra la fila y listo.
create or replace function sacar_del_equipo(p_asignacion uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proyecto uuid;
  v_persona  uuid;
  v_hubo     boolean;
begin
  if not ve_todo() then
    raise exception 'Sólo dirección, administración o coordinación arman el equipo';
  end if;

  select proyecto_id, persona_id into v_proyecto, v_persona
    from asignaciones where id = p_asignacion;

  if v_proyecto is null then
    raise exception 'Esa asignación no existe';
  end if;

  select exists (
    select 1 from actualizaciones a
     where a.proyecto_id = v_proyecto and a.autor_id = v_persona
  ) or exists (
    select 1 from participaciones pa
     where pa.proyecto_id = v_proyecto and pa.persona_id = v_persona
  ) into v_hubo;

  if v_hubo then
    update asignaciones set hasta = current_date where id = p_asignacion;
    return 'Se le puso fecha de baja: dejó rastro en el proyecto y su paso queda registrado.';
  end if;

  delete from asignaciones where id = p_asignacion;
  return 'Sacado del equipo.';
end;
$$;

comment on function sacar_del_equipo is
  'Quien dejó rastro se da de baja con fecha; quien nunca hizo nada se borra. Cargarlo por error no debería ensuciar la historia.';

grant execute on function sumar_al_equipo(uuid, uuid, rol_sistema, apertura_participacion) to authenticated;
grant execute on function sacar_del_equipo(uuid) to authenticated;
grant execute on function reajustar_hitos(uuid) to authenticated;

-- ------------------------------------------------------------
-- Entregado, facturado y pagado son tres hechos independientes, cada
-- uno con su fecha.
--
-- El modelo obligaba a facturar antes de cobrar, y en la realidad de la
-- agencia hay mucho que se paga y no se factura, y otro tanto que se
-- paga y se factura después. Obligar el orden hacía imposible registrar
-- lo que de verdad pasó, y una regla que no se puede cumplir se evade.
-- ------------------------------------------------------------

alter table hitos drop constraint if exists cobro_despues_de_factura;

comment on column hitos.entregado_at is 'Cuándo se entregó. Independiente de facturar y de cobrar.';
comment on column hitos.facturado_at is 'Cuándo se emitió la factura. Puede no existir nunca.';
comment on column hitos.cobrado_at  is 'Cuándo entró la plata. Puede ser antes de facturar, o sin factura.';

-- El cobro deja de forzar la factura.
create or replace function cobro_impacta_hito()
returns trigger
language plpgsql
as $$
declare
  v_cobrado numeric(14,2);
  v_debido  numeric(14,2);
begin
  select coalesce(sum(monto), 0) into v_cobrado from cobros where hito_id = NEW.hito_id;
  select monto_neto into v_debido from hitos where id = NEW.hito_id;

  -- Un pago parcial no da por cobrado el hito. Un peso de tolerancia
  -- por redondeos.
  if v_cobrado >= v_debido - 1 then
    update hitos
       set cobrado_at = coalesce(cobrado_at, NEW.fecha::timestamptz)
     where id = NEW.hito_id
       and cobrado_at is null;
  end if;

  return NEW;
end;
$$;

-- Devengado significa facturado y sin cobrar. Si se cobra sin factura,
-- se saltea ese estado y va directo a liquidar: no hay nada que esperar.
comment on type estado_porcion is
  'comprometido: el hito no pasó. devengado: facturado y sin cobrar. a_liquidar: la plata entró. liquidado: se transfirió.';
