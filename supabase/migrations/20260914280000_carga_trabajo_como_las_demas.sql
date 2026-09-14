-- ------------------------------------------------------------------
-- carga_trabajo se salía del patrón de las funciones de permiso.
--
-- Todas las demás —es_direccion, es_admin, es_coordinacion— delegan en
-- tiene_rol, que es security definer y lee personas con sus propios
-- permisos. carga_trabajo consultaba personas directamente y sin ser
-- definer, o sea con los permisos de quien pregunta.
--
-- Eso está mal por principio aunque hoy funcione: una función que
-- contesta "¿tenés permiso?" no puede depender de qué filas podés leer,
-- porque entonces una regla de visibilidad cambia en silencio la
-- respuesta de una regla de permiso. Y son cosas distintas: no ver a
-- alguien no es lo mismo que no ser alguien.
--
-- Santiago figura como project manager en su propia pantalla y el
-- sistema le dice que no tiene el rol para crear. No pude reproducirlo
-- desde la base, y esta diferencia es la única que quedaba entre lo que
-- yo probé y lo que corre en su sesión.
-- ------------------------------------------------------------------

create or replace function carga_trabajo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select ve_todo() or tiene_rol('vendedor') or tiene_rol('project_manager');
$$;

grant execute on function carga_trabajo() to authenticated;


-- ------------------------------------------------------------------
-- Y para no volver a quedarnos mirando una captura: que el servidor
-- pueda decir qué ve de vos.
--
-- Un permiso que se niega sin explicar por qué obliga a pedir una
-- captura, adivinar, y probar a ciegas. Esto contesta las cuatro cosas
-- que hacen falta: si te reconoce, quién sos, qué roles ve, y qué
-- puntos de la cadena dan verdadero.
-- ------------------------------------------------------------------

create or replace function quien_soy_para_el_sistema()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'me_reconoce',    persona_actual() is not null,
    'persona_id',     persona_actual(),
    'nombre',         (select nombre from personas where id = persona_actual()),
    'roles',          (select roles from personas where id = persona_actual()),
    'cuenta_activa',  (select activo from usuarios where id = auth.uid()),
    've_todo',        ve_todo(),
    'carga_trabajo',  carga_trabajo(),
    'editar_clientes', puede_persona('editar_clientes'),
    'cambiar_montos', puede_persona('cambiar_montos')
  );
$$;

grant execute on function quien_soy_para_el_sistema() to authenticated;
