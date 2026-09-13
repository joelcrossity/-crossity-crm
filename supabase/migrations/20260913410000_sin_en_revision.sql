-- ------------------------------------------------------------------
-- Fuera "En revisión".
--
-- La agregué de arrastre junto con "Implementando" y nadie la pidió.
-- Una columna que no se usa no es neutral: ocupa ancho, corre las que
-- importan y obliga a decidir cada vez si algo va ahí o no.
--
-- No hay ningún proyecto en ese subestado, así que sacarla no mueve a
-- nadie. Y "En desarrollo" quedó sin recorte desde el principio
-- justamente para esto: se lleva todo lo verde que no está
-- implementando, incluido cualquier en_revision que apareciera después.
--
-- El valor del enum se queda. Quitarlo obligaría a recrear el tipo y
-- todas las columnas que lo usan, y no molesta: lo que define el
-- tablero son las columnas, no el enum.
-- ------------------------------------------------------------------

delete from columnas_tablero where clave = 'en_revision';

-- Por las dudas, lo que hubiera quedado ahí vuelve a desarrollo.
update proyectos set subestado = 'en_curso'
 where subestado = 'en_revision' and color = 'verde';
