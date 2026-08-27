-- Coordinación: entra en su propia migración porque un valor nuevo de enum
-- no se puede agregar y usar en la misma transacción.
alter type rol_sistema add value 'coordinacion';
