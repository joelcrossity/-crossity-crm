-- ------------------------------------------------------------------
-- Vender incluye ponerle precio.
--
-- cambiar_montos venía solo para dirección y administración, y con eso
-- un vendedor podía crear la oportunidad y no cotizarla. Media
-- funcionalidad: carga la charla, arma las etapas, y al poner el número
-- le dice que no tiene permiso.
--
-- Se agrega a vendedor y project manager. No abre nada de más: sobre
-- qué proyectos pueden hacerlo ya lo decide la política por fila, así
-- que le ponen precio a lo suyo y a nada más. Y sigue siendo un switch:
-- si a alguien puntual no se le quiere dar, se le apaga en su ficha.
--
-- ver_comercial va con lo mismo. Un vendedor que no ve lo que se habló
-- en el embudo está vendiendo a ciegas sobre su propia conversación.
-- ------------------------------------------------------------------

insert into roles_permisos (rol, accion) values
  ('vendedor', 'cambiar_montos'),
  ('project_manager', 'cambiar_montos')
on conflict do nothing;

insert into roles_permisos (rol, accion) values
  ('project_manager', 'ver_comercial')
on conflict do nothing;
