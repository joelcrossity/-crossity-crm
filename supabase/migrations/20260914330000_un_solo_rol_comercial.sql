-- ------------------------------------------------------------------
-- Vendedor y project manager eran el mismo puesto con dos nombres.
--
-- Vendedor traía: ver la facturación, ver lo comercial, cambiar montos,
-- editar clientes y abrir trabajo. Project manager traía todo eso y
-- además armar el equipo. No había una sola cosa que pudiera un vendedor
-- y no un PM: uno contenía al otro entero.
--
-- Dos nombres para un mismo puesto no son un matiz, son una pregunta que
-- alguien tiene que contestar cada vez que da de alta a una persona, y
-- que no tiene respuesta correcta. Queda uno.
--
-- Nadie pierde nada. Los que eran vendedores ganan armar el equipo, que
-- es la única diferencia que había, y es la que corresponde a quien
-- lleva un proyecto de punta a punta.
-- ------------------------------------------------------------------

-- Antes de tocar: queda escrito quién era qué, con fecha. Si mañana hay
-- que volver atrás, esto dice exactamente a quién.
create table if not exists respaldo_vendedores (
  cuando     timestamptz not null default now(),
  que        text not null,
  quien      uuid not null,
  nombre     text,
  antes      text not null
);

insert into respaldo_vendedores (que, quien, nombre, antes)
select 'persona', p.id, p.nombre, array_to_string(p.roles, ',')
  from personas p where 'vendedor' = any(p.roles);

insert into respaldo_vendedores (que, quien, nombre, antes)
select 'asignacion', a.id, pe.nombre, a.rol::text
  from asignaciones a left join personas pe on pe.id = a.persona_id
 where a.rol = 'vendedor';


-- El puesto. Se reemplaza y se deduplica: quien ya era las dos cosas
-- —el caso de Santiago— queda con project_manager una sola vez.
update personas
   set roles = (
     select array_agg(distinct r order by r)
       from unnest(array_replace(roles, 'vendedor'::rol_sistema,
                                        'project_manager'::rol_sistema)) r
   )
 where 'vendedor' = any(roles);


-- El papel dentro de un proyecto, que es otra cosa y comparte el tipo.
-- Acá no se pierde quién vendió: eso vive en participaciones.concepto,
-- que tiene sus propios valores ('venta', 'referido') y no se toca.
update asignaciones set rol = 'project_manager' where rol = 'vendedor';

delete from roles_permisos where rol = 'vendedor';


-- Que no vuelva a entrar por la ventana. El valor sigue existiendo en el
-- tipo y esto es a propósito: sacarlo del enum obliga a recrear el tipo,
-- y con él las tres columnas que lo usan y las quince funciones que lo
-- nombran en su firma, y con ellas todas las políticas que dependen de
-- esas funciones. Es cirugía sobre la tabla de permisos de un sistema en
-- uso para borrar una palabra que ya no usa nadie.
--
-- Estas dos reglas dan el mismo resultado observable —no se puede ser
-- vendedor, no se puede asignar a alguien como vendedor— con un riesgo
-- que es cero. Si algún día hay otra razón para recrear el tipo, se
-- aprovecha ese viaje y se cae solo.
alter table personas drop constraint if exists sin_vendedor;
alter table personas add constraint sin_vendedor
  check (not ('vendedor' = any(roles)));

alter table asignaciones drop constraint if exists sin_vendedor;
alter table asignaciones add constraint sin_vendedor
  check (rol <> 'vendedor');


-- Abrir trabajo ya no pregunta por los dos.
create or replace function carga_trabajo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select ve_todo() or tiene_rol('project_manager');
$$;

comment on function carga_trabajo is
  'Quién puede abrir trabajo nuevo: dirección, administración, coordinación y project managers.';


-- Y el que crea un proyecto para otro queda asignado con el papel que
-- tenga; si no tiene ninguno, con el que ahora es el comercial.
create or replace function quien_crea_participa()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_yo  uuid;
  v_rol rol_sistema;
begin
  v_yo := persona_actual();
  if v_yo is null or new.responsable_id = v_yo then return new; end if;

  select unnest(roles)::rol_sistema into v_rol from personas where id = v_yo limit 1;

  insert into asignaciones (proyecto_id, persona_id, rol, desde)
  values (new.id, v_yo, coalesce(v_rol, 'project_manager'), current_date)
  on conflict do nothing;

  return new;
end;
$$;


-- ------------------------------------------------------------------
-- Y de paso, contratos, que nombraba a vendedor y quedaba con una
-- referencia muerta.
--
-- Era la última tabla que se abría por rol puro, sin acotar por
-- proyecto: cualquier PM leía los contratos de toda la agencia —montos,
-- vigencias, notas— y podía escribirlos, aunque no tuviera nada que ver
-- con ese cliente. Todo el resto del sistema acota por participación
-- desde hace dos semanas; esta se quedó atrás y nadie la miró porque
-- seguía funcionando.
--
-- Ahora pide las dos cosas, como corresponde: poder ver facturación
-- —que es lo que un contrato dice— y que el cliente sea tuyo. Un PM ve
-- lo que cobra de sus clientes, no lo que cobra la agencia.
--
-- Escribir queda en dirección y administración. Un contrato es lo que
-- la empresa firma, no lo que un proyecto acuerda.
-- ------------------------------------------------------------------

drop policy if exists contratos_lectura on contratos;
create policy contratos_lectura on contratos
  for select to authenticated
  using (puede_persona('ver_facturacion') and cliente_mio(organizacion_id));

drop policy if exists contratos_escritura on contratos;
create policy contratos_escritura on contratos
  for all to authenticated
  using (es_direccion() or es_admin())
  with check (es_direccion() or es_admin());
