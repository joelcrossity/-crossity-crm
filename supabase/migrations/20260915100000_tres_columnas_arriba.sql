-- ------------------------------------------------------------------
-- Arriba quedan las tres del flujo real: comenzar, en proceso,
-- implementando.
--
-- Las otras dos se tratan distinto, y la diferencia no es de estilo: es
-- que una es comodín y la otra no.
--
-- Una columna sin detalle se lleva todo lo de su color que no reclamó
-- ninguna otra. "En desarrollo" es el comodín de los verdes y "Frenado"
-- el de los grises. Sacar un comodín no mueve proyectos de lugar: los
-- deja sin lugar, fuera del tablero y fuera de todos los conteos, sin
-- error y sin que nadie lo decida.
--
-- Por eso:
--
-- En revisión se borra. Es un recorte dentro del verde, no el comodín,
-- así que lo que tenía cae solo en "En desarrollo". Antes se mueven los
-- proyectos a en_curso para que el cambio sea explícito y quede en la
-- historia, en vez de que se acomoden solos y nadie sepa cuándo pasó.
--
-- Frenado se pliega, no se borra. Es el comodín de los grises, y
-- "Comenzar" solo acepta esperando_anticipo: si se fuera, un proyecto
-- pausado por el cliente o dormido quedaría sin columna. Plegado sigue
-- recibiéndolos y sigue siendo visible, que es exactamente lo que se
-- pidió: fuera de la zona de trabajo, no fuera del sistema.
--
-- Acabamos de perder dos días por un proyecto en verde que estaba
-- archivado y no aparecía en ningún lado. No vale la pena repetirlo por
-- ahorrar una columna plegada.
-- ------------------------------------------------------------------

-- Primero los proyectos, después la columna. Al revés funcionaría igual
-- —caerían en el comodín— pero el movimiento no quedaría registrado.
update proyectos
   set subestado = 'en_curso'
 where color = 'verde' and subestado::text = 'en_revision';

delete from columnas_tablero where clave = 'en_revision';

-- Antes de los finales: algo pausado todavía puede volver, y terminado
-- y perdido no.
update columnas_tablero
   set zona = 'abajo', orden = 30
 where clave = 'frenado';

comment on table columnas_tablero is
  'Una columna no es un color: es un color y, a veces, un detalle. Las que no lo definen son el comodín de su color y no se pueden borrar sin dejar proyectos sin lugar.';
