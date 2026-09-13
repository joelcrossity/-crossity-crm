-- El valor del enum va solo: no se puede agregar y usar en la misma
-- transacción.
alter type accion_permitida add value if not exists 'editar_clientes';
