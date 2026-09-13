-- ------------------------------------------------------------------
-- consumos: se tapan las columnas de plata, no la tabla entera.
--
-- Quitarle el select completo dejaba fuera de servicio marcar un
-- consumo como facturado o borrarlo: para filtrar por id hay que poder
-- leer id, y sin select no se puede.
--
-- Postgres permite dar el permiso por columna, que es exactamente lo
-- que hace falta: el período y la cantidad se pueden leer —son las
-- conversaciones que el cliente usó, y eso lo ve cualquiera del
-- equipo— y el monto y los tres costos no. Así la puerta al costado
-- sigue cerrada para lo que importa sin romper lo que funcionaba.
--
-- v_consumo lee todo porque corre con los permisos de su dueño, y ahí
-- adentro decide qué mostrar según el permiso de quien pregunta.
-- ------------------------------------------------------------------

grant select (
  id, proyecto_id, periodo, cantidad, precio_unitario,
  notas, facturado_at, cobrado_at, cargado_por, created_at
) on consumos to authenticated;

comment on column consumos.monto is
  'Lo facturado del mes. Sin grant de select para authenticated: se lee por v_consumo, que lo tapa si la persona no tiene ver_rentabilidad_mantenimientos.';
