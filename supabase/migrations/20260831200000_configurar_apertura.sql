-- ============================================================
-- Quién configura la apertura.
--
-- Administración y coordinación la manejan por proyecto y por persona.
-- Pero cambiar cuánto VE alguien y cambiar cuánto COBRA alguien son dos
-- cosas distintas: la primera es operativa, la segunda es un acuerdo
-- comercial. Sólo dirección toca los porcentajes.
--
-- Como todos comparten el mismo rol de base de datos, la diferencia no
-- se puede hacer con permisos de columna: va en disparadores.
-- ============================================================

create or replace function puede_configurar_visibilidad()
returns boolean
language sql
stable
as $$ select es_direccion() or es_admin() or es_coordinacion() $$;

-- ------------------------------------------------------------
-- Participaciones: la apertura la mueve administración o coordinación;
-- el porcentaje, sólo dirección.
-- ------------------------------------------------------------

drop policy if exists participaciones_escritura_alta on participaciones;
drop policy if exists participaciones_escritura_cambio on participaciones;
drop policy if exists participaciones_escritura_baja on participaciones;

create policy participaciones_alta on participaciones for insert to authenticated
  with check (es_direccion());
create policy participaciones_baja on participaciones for delete to authenticated
  using (es_direccion());
create policy participaciones_cambio on participaciones for update to authenticated
  using (puede_configurar_visibilidad())
  with check (puede_configurar_visibilidad());

create or replace function proteger_acuerdo()
returns trigger
language plpgsql
as $$
begin
  -- Sin sesión (migraciones, seed, jobs) no hay nada que controlar.
  if persona_actual() is null then
    return NEW;
  end if;

  if NEW.porcentaje is distinct from OLD.porcentaje and not es_direccion() then
    raise exception 'El porcentaje es un acuerdo comercial: sólo lo cambia dirección'
      using hint = 'La apertura sí la podés cambiar.';
  end if;

  if NEW.concepto is distinct from OLD.concepto and not es_direccion() then
    raise exception 'El concepto de la participación sólo lo cambia dirección';
  end if;

  -- Nadie se abre a sí mismo. Si no, quien configura termina viendo todo.
  if NEW.apertura is distinct from OLD.apertura
     and NEW.persona_id = persona_actual()
     and not es_direccion()
     and rango_apertura(NEW.apertura) > rango_apertura(OLD.apertura) then
    raise exception 'No podés ampliar tu propia visibilidad';
  end if;

  return NEW;
end;
$$;

create trigger participaciones_protegen_acuerdo
  before update on participaciones
  for each row execute function proteger_acuerdo();

-- ------------------------------------------------------------
-- Asignaciones: misma lógica, sin porcentaje de por medio.
-- ------------------------------------------------------------

drop policy if exists asignaciones_escritura_cambio on asignaciones;
create policy asignaciones_escritura_cambio on asignaciones for update to authenticated
  using (puede_configurar_visibilidad())
  with check (puede_configurar_visibilidad());

create or replace function proteger_apertura_asignacion()
returns trigger
language plpgsql
as $$
begin
  if persona_actual() is null then
    return NEW;
  end if;

  if NEW.apertura is distinct from OLD.apertura
     and NEW.persona_id = persona_actual()
     and not es_direccion()
     and rango_apertura(NEW.apertura) > rango_apertura(OLD.apertura) then
    raise exception 'No podés ampliar tu propia visibilidad';
  end if;

  return NEW;
end;
$$;

create trigger asignaciones_protegen_apertura
  before update on asignaciones
  for each row execute function proteger_apertura_asignacion();

comment on function proteger_acuerdo is
  'Quien configura la visibilidad no puede usarla para verse mejor a sí mismo.';

-- ------------------------------------------------------------
-- Los cambios de apertura son cambios sobre la plata de alguien:
-- entran en la traza y le son visibles a la persona afectada.
-- Ya lo hacen por el disparador de eventos; se deja anotado el porqué.
-- ------------------------------------------------------------

comment on column participaciones.apertura is
  'Configurable por proyecto y por persona desde administración o coordinación. Cada cambio queda en la traza y le llega al afectado.';

-- ------------------------------------------------------------
-- Configurar la apertura sin poder leer el acuerdo.
--
-- Para cambiar la apertura de una participación hay que poder
-- direccionar la fila, y direccionarla exige poder leerla. Pero
-- coordinación no tiene que ver los porcentajes de nadie.
--
-- Se resuelve con una función que hace exactamente esa operación y
-- ninguna otra: se puede configurar qué ve cada uno sin llegar nunca a
-- ver cuánto cobra.
-- ------------------------------------------------------------

create or replace function configurar_apertura(
  p_persona  uuid,
  p_proyecto uuid,
  p_nivel    apertura_participacion
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part integer := 0;
  v_asig integer := 0;
begin
  if not puede_configurar_visibilidad() then
    raise exception 'Sólo dirección, administración o coordinación configuran la visibilidad';
  end if;

  if p_persona = persona_actual() and not es_direccion() then
    raise exception 'No podés cambiar tu propia visibilidad';
  end if;

  update participaciones
     set apertura = p_nivel
   where proyecto_id = p_proyecto and persona_id = p_persona;
  get diagnostics v_part = row_count;

  update asignaciones
     set apertura = p_nivel
   where proyecto_id = p_proyecto and persona_id = p_persona and hasta is null;
  get diagnostics v_asig = row_count;

  if v_part + v_asig = 0 then
    raise exception 'Esa persona no interviene en ese proyecto';
  end if;

  return case p_nivel
    when 'abierta'   then 'Ahora ve el total del proyecto'
    when 'comercial' then 'Ahora ve la propuesta y los entregables'
    else                  'Ahora ve sólo lo suyo'
  end;
end;
$$;

comment on function configurar_apertura is
  'La única puerta para cambiar la apertura. Deja configurar qué ve cada uno sin poder leer cuánto cobra.';

revoke all on function configurar_apertura(uuid, uuid, apertura_participacion) from public, anon;
grant execute on function configurar_apertura(uuid, uuid, apertura_participacion) to authenticated;
