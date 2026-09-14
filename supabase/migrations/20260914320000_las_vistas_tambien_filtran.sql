-- ------------------------------------------------------------------
-- Dos vistas se leían con los permisos de quien las creó.
--
-- Una vista sin security_invoker corre con los permisos de su dueño, no
-- con los de quien pregunta. O sea que no aplica las reglas de las
-- tablas que junta: las esquiva, en silencio y sin error.
--
-- De sesenta y pico de vistas del sistema, estas dos quedaron sin la
-- opción. No fue una decisión, fue un olvido, y es la clase de olvido
-- que no se nota: la vista anda bien, devuelve datos, nadie ve un
-- problema. Solo devuelve de más.
--
-- v_consumo es la que importa. Junta consumos, proyectos y clientes, y
-- sin invoker cualquiera con sesión podía leer por la API el consumo de
-- todos los mantenimientos de la agencia, con nombre de cliente y de
-- proyecto. Los montos estaban protegidos aparte, columna por columna
-- con puede_persona, y eso aguantó. Las filas no.
--
-- En la pantalla no se notaba porque siempre se la filtra por un
-- proyecto al que ya tenés acceso. Esa es justamente la trampa: la
-- pantalla tapaba el agujero, y la pantalla no es la cerradura.
--
-- v_cotizacion_hoy son los valores del dólar. Son iguales para todos y
-- su tabla se lee con using(true), así que no exponía nada. Se corrige
-- igual: una excepción sin motivo obliga a recordar por qué era una
-- excepción, y dentro de un mes nadie se acuerda.
--
-- Se usa alter view y no create or replace a propósito: cambia el
-- permiso sin tocar una coma de la definición. Recrearlas sería abrir
-- la posibilidad de alterar qué devuelven, que no es lo que se busca.
-- ------------------------------------------------------------------

alter view v_consumo        set (security_invoker = true);
alter view v_cotizacion_hoy set (security_invoker = true);

comment on view v_consumo is
  'Consumo de los mantenimientos. Filtra por las reglas de consumos: ve_todo o participar del proyecto.';
