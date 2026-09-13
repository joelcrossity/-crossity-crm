-- El valor del enum va solo, en su propio archivo: Postgres no deja
-- agregar un valor y usarlo en la misma transacción.
alter type accion_permitida add value if not exists 'ver_rentabilidad_mantenimientos';
