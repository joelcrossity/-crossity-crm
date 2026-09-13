-- ------------------------------------------------------------------
-- Editar un cliente pasa a ser un permiso, no un rol.
--
-- Hasta ahora lo editaba ve_todo(): dirección, administración y
-- coordinación. El problema no es tanto quién entra sino que no se
-- podía ajustar: o tenías coordinación y editabas todos los clientes, o
-- no editabas ninguno. No había forma de darle a una persona puntual el
-- permiso de corregir un CUIT sin ascenderla.
--
-- Ahora es un switch más de /equipo, con dirección y administración
-- prendidos por defecto. Coordinación lo pierde: tocar el CUIT o la
-- razón social de un cliente es un dato estructural que impacta en la
-- facturación, no trabajo del día.
--
-- Las tres tablas del cliente usan el mismo permiso. Separarlas
-- —editar el nombre sí pero los contactos no— sería una distinción que
-- nadie pidió y que habría que explicar cada vez.
-- ------------------------------------------------------------------

insert into acciones_catalogo (accion, etiqueta, ayuda, grupo, orden)
values ('editar_clientes', 'Editar la ficha de clientes',
        'Nombre, CUIT, razones sociales y contactos. Impacta en la facturación.',
        'Trabajo', 55)
on conflict (accion) do nothing;

insert into roles_permisos (rol, accion)
values ('direccion', 'editar_clientes'), ('administracion', 'editar_clientes')
on conflict do nothing;

drop policy if exists organizaciones_escritura_cambio on organizaciones;
create policy organizaciones_escritura_cambio on organizaciones
  for update to authenticated
  using (puede_persona('editar_clientes')) with check (puede_persona('editar_clientes'));

drop policy if exists contactos_escritura_cambio on contactos;
create policy contactos_escritura_cambio on contactos
  for update to authenticated
  using (puede_persona('editar_clientes')) with check (puede_persona('editar_clientes'));

drop policy if exists contactos_escritura_alta on contactos;
create policy contactos_escritura_alta on contactos
  for insert to authenticated with check (puede_persona('editar_clientes'));

drop policy if exists contactos_escritura_baja on contactos;
create policy contactos_escritura_baja on contactos
  for delete to authenticated using (puede_persona('editar_clientes'));

drop policy if exists razones_cambio on razones_sociales;
create policy razones_cambio on razones_sociales
  for update to authenticated
  using (puede_persona('editar_clientes')) with check (puede_persona('editar_clientes'));

drop policy if exists razones_alta on razones_sociales;
create policy razones_alta on razones_sociales
  for insert to authenticated with check (puede_persona('editar_clientes'));

drop policy if exists razones_baja on razones_sociales;
create policy razones_baja on razones_sociales
  for delete to authenticated using (puede_persona('editar_clientes'));

-- El alta de un cliente se queda en ve_todo(): crear una cuenta pasa
-- cuando entra trabajo nuevo, y eso lo hace cualquiera que venda.


-- Quién tocó la ficha por última vez, con el mismo trigger que los
-- proyectos: lo pone la base, no la pantalla.
alter table organizaciones add column if not exists updated_at timestamptz;
alter table organizaciones add column if not exists updated_by uuid references personas(id);

drop trigger if exists organizaciones_sellar on organizaciones;
create trigger organizaciones_sellar
  before update on organizaciones
  for each row execute function sellar_edicion();
