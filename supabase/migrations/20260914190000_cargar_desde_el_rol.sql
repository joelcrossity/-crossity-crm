-- ------------------------------------------------------------------
-- Vender y arrancar un proyecto es trabajo operativo.
--
-- Hasta ahora crear una oportunidad o un proyecto era ve_todo():
-- dirección, administración y coordinación. Un vendedor no podía cargar
-- una charla que él mismo tuvo, ni un project manager abrir el trabajo
-- que le tocó. Tenían que pedirlo, que es exactamente lo que este
-- sistema vino a sacar del medio.
--
-- EL PROBLEMA DE FONDO NO ERA EL PERMISO.
--
-- Ningún trigger asignaba al creador. Abrir el alta sin más habría dado
-- algo peor que no poder crear: el vendedor carga la oportunidad, se
-- guarda bien, y desaparece de su pantalla —porque no ve_todo() y no
-- participa en ella—. Un dato que se guarda y no se ve es más difícil
-- de entender que un error.
--
-- Así que el creador queda vinculado. Si nadie puso responsable, es él:
-- quien carga una venta la sigue hasta que alguien diga otra cosa. Y si
-- puso a otro, igual queda asignado, porque estuvo en la conversación y
-- va a querer ver cómo sigue.
--
-- El alta abre, la baja no. Borrar un proyecto es otra cosa: se hace
-- muy pocas veces, a propósito, y con algo que ya tiene plata alrededor.
-- ------------------------------------------------------------------

create or replace function quien_crea_participa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo  uuid;
  v_rol rol_sistema;
begin
  v_yo := persona_actual();
  -- Sin persona detrás —una migración, el service role— no hay a quién
  -- vincular, y forzar uno sería inventar un dueño.
  if v_yo is null then return new; end if;

  if new.responsable_id is null then
    update proyectos set responsable_id = v_yo where id = new.id;
  elsif new.responsable_id <> v_yo then
    -- Puso a otro de responsable: igual queda asignado, porque estuvo
    -- en la conversación y va a querer ver cómo sigue.
    select unnest(roles)::rol_sistema into v_rol
      from personas where id = v_yo limit 1;

    insert into asignaciones (proyecto_id, persona_id, rol, desde)
    values (new.id, v_yo, coalesce(v_rol, 'vendedor'), current_date)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists proyectos_quien_crea on proyectos;
create trigger proyectos_quien_crea
  after insert on proyectos
  for each row execute function quien_crea_participa();


-- ------------------------------------------------------------------
-- Quién puede dar de alta trabajo.
--
-- Se apoya en los roles y no en un switch nuevo: cargar una oportunidad
-- no es un permiso fino que se ajuste persona por persona, es lo que
-- define el puesto. Un vendedor que no carga ventas no es un vendedor.
-- ------------------------------------------------------------------

create or replace function carga_trabajo()
returns boolean
language sql stable
as $$
  select ve_todo() or exists (
    select 1 from personas
     where id = persona_actual()
       and (roles && array['vendedor','project_manager']::rol_sistema[])
  );
$$;

grant execute on function carga_trabajo() to authenticated;

comment on function carga_trabajo is
  'Quién puede abrir trabajo nuevo: dirección, administración, coordinación, y además vendedores y project managers. Es lo que define el puesto, no un ajuste fino.';


drop policy if exists proyectos_escritura_alta on proyectos;
create policy proyectos_escritura_alta on proyectos
  for insert to authenticated with check (carga_trabajo());

-- Un cliente nuevo aparece cuando entra trabajo nuevo, así que va con
-- lo mismo: pedirle a un vendedor que espere a que alguien le cargue el
-- cliente para poder anotar la charla es la mitad del problema.
drop policy if exists organizaciones_escritura_alta on organizaciones;
create policy organizaciones_escritura_alta on organizaciones
  for insert to authenticated with check (carga_trabajo());

-- Las entregas, para poder cotizar. Solo sobre lo propio: abrir trabajo
-- es una cosa y meter mano en el de otro es otra.
drop policy if exists hitos_escritura_alta on hitos;
create policy hitos_escritura_alta on hitos
  for insert to authenticated
  with check (ve_todo() or participa_en(proyecto_id));

drop policy if exists hitos_escritura_cambio on hitos;
create policy hitos_escritura_cambio on hitos
  for update to authenticated
  using (ve_todo() or participa_en(proyecto_id))
  with check (ve_todo() or participa_en(proyecto_id));

drop policy if exists hitos_escritura_baja on hitos;
create policy hitos_escritura_baja on hitos
  for delete to authenticated
  using (ve_todo() or participa_en(proyecto_id));
