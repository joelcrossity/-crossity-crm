-- ------------------------------------------------------------------
-- El switch de armar equipo estaba puesto y las funciones lo ignoraban.
--
-- Hace dos días abrí las reglas de asignaciones al permiso que ya
-- existía: puede_persona('configurar_equipo'), y solo sobre proyectos
-- donde la persona esté. Pero la pantalla no escribe en la tabla: llama
-- a sumar_al_equipo y sacar_del_equipo, que son security definer y por
-- eso saltean las reglas. Adentro seguía el ve_todo() escrito a mano de
-- cuando los switches no existían.
--
-- O sea: abrí la puerta y dejé el candado viejo en el camino que se usa.
-- Es el mismo error que el de ayer, y por eso lo escribo acá: cuando una
-- función es security definer, la función ES el permiso. Abrir la regla
-- de la tabla al lado no hace nada, y peor, hace creer que sí.
--
-- Santiago no necesita un permiso nuevo. project_manager tiene
-- configurar_equipo desde el día uno, por defecto, a propósito: un PM
-- que no puede poner a nadie en su proyecto no está a cargo de nada.
-- Lo que hacía falta era que la función se lo preguntara.
--
-- Y se pregunta lo mismo que la regla, palabra por palabra. Dos lugares
-- que contestan la misma pregunta con criterios distintos es exactamente
-- cómo se llega a una pantalla que se contradice con el servidor.
-- ------------------------------------------------------------------

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
  -- Los dos motivos son distintos y se dicen distinto: a uno le falta el
  -- permiso y hay que pedirlo, al otro le sobra el proyecto. Un mismo
  -- mensaje para ambos manda a la mitad a pedir algo que ya tiene.
  if not puede_persona('configurar_equipo') then
    raise exception 'Armar el equipo es un permiso aparte. Se habilita en Sistema → Usuarios y roles';
  end if;

  if not (ve_todo() or participa_en(p_proyecto)) then
    raise exception 'Podés armar el equipo de tus proyectos, no el de los demás';
  end if;

  insert into asignaciones (proyecto_id, persona_id, rol, apertura)
  values (p_proyecto, p_persona, p_rol, p_apertura)
  on conflict do nothing;
end;
$$;


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
  if not puede_persona('configurar_equipo') then
    raise exception 'Armar el equipo es un permiso aparte. Se habilita en Sistema → Usuarios y roles';
  end if;

  select proyecto_id, persona_id into v_proyecto, v_persona
    from asignaciones where id = p_asignacion;

  if v_proyecto is null then
    raise exception 'Esa asignación no existe';
  end if;

  -- Después de saber de qué proyecto es, porque antes no había con qué
  -- comparar.
  if not (ve_todo() or participa_en(v_proyecto)) then
    raise exception 'Podés armar el equipo de tus proyectos, no el de los demás';
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

comment on function sumar_al_equipo is
  'Suma a alguien al equipo. Pide el permiso configurar_equipo y que el proyecto sea tuyo: lo mismo que piden las reglas de la tabla.';
