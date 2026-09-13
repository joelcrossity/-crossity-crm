-- ------------------------------------------------------------------
-- v_consumo pasa a decidir ella el alcance, y la tabla queda cerrada.
--
-- El intento anterior no podía funcionar y conviene dejar escrito por
-- qué. La vista era security_invoker para heredar la RLS de consumos,
-- que es lo correcto casi siempre; pero para tapar los costos había que
-- quitarle a authenticated el select sobre la tabla, y una vista
-- invoker corre con los permisos de quien la llama, así que se quedaba
-- sin poder leer lo que necesitaba. Las dos cosas no entran juntas:
-- heredar la RLS exige el privilegio, y tapar columnas exige sacárselo.
--
-- Entonces la vista define el alcance ella misma y la tabla queda
-- cerrada del todo. El costo es que la regla de quién ve qué proyecto
-- queda escrita en dos lugares —acá y en la política de proyectos—, así
-- que si esa regla cambia hay que tocar las dos. Es el precio de que no
-- exista una puerta al costado: con el select abierto sobre consumos,
-- alcanzaba con pedir la tabla en vez de la vista para ver los costos y
-- lo facturado de todos los abonos.
-- ------------------------------------------------------------------

drop view if exists v_consumo;
create view v_consumo as
select
  c.id,
  c.proyecto_id,
  p.codigo,
  p.nombre,
  p.plan,
  o.nombre_canonico as cliente,
  c.periodo,
  c.cantidad         as usado,
  p.unidad_consumo   as unidad,
  p.incluido_en_base as incluido,
  p.tamano_bloque,
  p.max_bloques,
  bloques_excedidos(c.cantidad, p.incluido_en_base, p.tamano_bloque) as bloques,
  -- Se avisa cuando se pasó del máximo, no se corta: cortarle el agente
  -- al cliente para forzar un upgrade es perder al cliente.
  (p.max_bloques is not null
   and bloques_excedidos(c.cantidad, p.incluido_en_base, p.tamano_bloque) > p.max_bloques)
                     as requiere_upgrade,
  c.facturado_at,
  c.cobrado_at,
  c.notas,
  p.moneda,

  -- Lo facturado también se tapa, no solo los costos: saber que un mes
  -- salió 505 dólares ya es saber cuánto paga el cliente.
  case when puede_persona('ver_rentabilidad_mantenimientos') then c.monto      end as facturado,
  case when puede_persona('ver_rentabilidad_mantenimientos') then c.costo_meta end as costo_meta,
  case when puede_persona('ver_rentabilidad_mantenimientos') then c.costo_ia   end as costo_ia,
  case when puede_persona('ver_rentabilidad_mantenimientos')
            and (c.costo_meta is not null or c.costo_ia is not null)
       then c.monto - coalesce(c.costo_meta, 0) - coalesce(c.costo_ia, 0) end as margen,
  puede_persona('ver_rentabilidad_mantenimientos') as ve_la_plata

from consumos c
join proyectos p      on p.id = c.proyecto_id
join organizaciones o on o.id = p.organizacion_id
-- La misma regla que la política de proyectos. Si esa cambia, ésta
-- también: es el precio de cerrar la tabla.
where ve_todo() or participa_en(c.proyecto_id);

grant select on v_consumo to authenticated;

comment on view v_consumo is
  'El consumo del mes con los bloques calculados. Define su propio alcance porque consumos está cerrado a authenticated: sin eso, pedir la tabla en vez de la vista saltearía el tapado de costos.';
