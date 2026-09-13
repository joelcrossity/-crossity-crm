-- ------------------------------------------------------------------
-- Varias etapas de trabajo activo, y una columna que no puede mentir.
--
-- El modal de motivo al pasar algo a "Implementando" no era un bug del
-- arrastre: la lógica hacía lo correcto. Lo que estaba mal es que
-- renombrar una columna dejaba cambiarle el nombre sin cambiarle lo que
-- significa. "Implementando" seguía siendo la columna frenado —gris,
-- "arrancó y se detuvo"—, así que soltar ahí preguntaba por qué se
-- había detenido. La etiqueta decía una cosa y la columna hacía otra.
--
-- Y de paso el tablero se había quedado sin dónde poner lo pausado.
--
-- El modelo ya tenía la respuesta y estaba usada a medias. Una columna
-- es un color y, opcionalmente, un recorte dentro de ese color. Eso ya
-- funcionaba para gris, partido por motivo_gris. Faltaba que funcionara
-- igual para verde, partido por subestado: implementar y revisar son
-- fases de trabajo en curso, no estados distintos de un proyecto.
--
-- Por eso la columna que discrimina se llama ahora detalle y no motivo:
-- contra qué campo se compara lo decide el color.
-- ------------------------------------------------------------------

alter table columnas_tablero rename column motivo to detalle;
alter table columnas_tablero rename column motivo_al_soltar to detalle_al_soltar;

comment on column columnas_tablero.detalle is
  'El recorte dentro del color. Se compara contra subestado si el color es verde, motivo_gris si es gris y motivo_rojo si es rojo. Vacío: la columna se queda con lo que no cayó en ninguna de las que sí lo definen.';
comment on column columnas_tablero.detalle_al_soltar is
  'Qué detalle se pone al soltar acá. Cargado, no se pregunta nada: soltar en "Implementando" ya dice en qué fase está.';

-- El tablero que Joel quiere, con los nombres que ya había puesto.
-- Se reescriben las cinco de arriba de una: cambian orden y sentido.
delete from columnas_tablero where zona = 'arriba';

insert into columnas_tablero (clave, etiqueta, ayuda, color, detalle, zona, orden, detalle_al_soltar)
values
  ('por_arrancar',  'Comenzar',       'ganado, esperando el anticipo', 'gris',  'esperando_anticipo', 'arriba', 10, 'esperando_anticipo'),
  ('en_vivo',       'En desarrollo',  'se está construyendo',          'verde', null,                 'arriba', 20, 'en_curso'),
  ('implementando', 'Implementando',  'se está poniendo en marcha',    'verde', 'implementando',      'arriba', 30, 'implementando'),
  ('en_revision',   'En revisión',    'esperando la devolución',       'verde', 'en_revision',        'arriba', 40, 'en_revision'),
  ('frenado',       'Frenado',        'arrancó y está detenido',       'gris',  null,                 'arriba', 50, null);

-- En desarrollo queda sin detalle a propósito: se lleva todo lo verde
-- que no está implementando ni en revisión. Si mañana aparece un
-- subestado nuevo, cae ahí en vez de desaparecer del tablero.


-- ------------------------------------------------------------------
-- Renombrar deja de poder mentir.
--
-- Antes solo cambiaba la etiqueta, y la ayuda seguía describiendo lo
-- que la columna era antes. Ahora se cambian las dos juntas: el nombre
-- y lo que dice que hace.
-- ------------------------------------------------------------------

create or replace function renombrar_columna(p_clave text, p_etiqueta text, p_ayuda text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_direccion() then
    raise exception 'Solo dirección cambia las columnas del tablero.';
  end if;
  if length(trim(coalesce(p_etiqueta, ''))) = 0 then
    raise exception 'La columna necesita un nombre.';
  end if;

  update columnas_tablero
     set etiqueta = trim(p_etiqueta),
         ayuda    = coalesce(nullif(trim(coalesce(p_ayuda, '')), ''), ayuda)
   where clave = p_clave;
end;
$$;

grant execute on function renombrar_columna(text, text, text) to authenticated;
