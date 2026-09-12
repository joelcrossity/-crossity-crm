-- ============================================================
-- Las columnas del tablero, en la base.
--
-- El problema: la configuración editaba `estados_proyecto`, pero el
-- tablero dibujaba sus columnas desde una lista escrita en el código.
-- Dos fuentes para lo mismo, así que renombrar una columna en
-- configuración no cambiaba nada en el tablero. No era un problema de
-- caché ni de refresco: el tablero nunca estuvo leyendo eso.
--
-- Y aparece algo más al mirarlo de cerca. Un proyecto ganado que espera
-- el anticipo y uno que el cliente pausó son los dos `gris`, pero no
-- son lo mismo: el primero no arrancó y el segundo se detuvo. La
-- distinción ya estaba guardada en `motivo_gris` y el tablero la
-- ignoraba, mostrando los dos en la misma pila.
--
-- Entonces una columna del tablero no es un color: es un color más,
-- opcionalmente, un motivo. Eso es lo que se guarda acá.
-- ============================================================

create table columnas_tablero (
  clave       text primary key,
  etiqueta    text not null,
  ayuda       text not null,
  color       color_estado not null,
  -- Cuando hay motivo, la columna es un recorte dentro de ese color.
  motivo      text,
  zona        text not null default 'arriba' check (zona in ('arriba', 'abajo')),
  orden       integer not null,
  -- Qué motivo se pone al soltar algo acá. Null significa preguntarlo.
  motivo_al_soltar text
);

comment on table columnas_tablero is
  'Una columna no es un color: es un color y, a veces, un motivo. Esperando el anticipo y pausado por el cliente son los dos gris y no son lo mismo.';

comment on column columnas_tablero.motivo_al_soltar is
  'Null significa preguntar. Si la columna ya define el motivo, no tiene sentido preguntarlo.';

insert into columnas_tablero (clave, etiqueta, ayuda, color, motivo, zona, orden, motivo_al_soltar) values
  ('por_arrancar', 'Por arrancar', 'ganado, esperando el anticipo', 'gris', 'esperando_anticipo', 'arriba', 10, 'esperando_anticipo'),
  ('en_vivo',      'En vivo',      'se trabaja ahora',              'verde',   null,  'arriba', 20, 'en_curso'),
  ('frenado',      'Frenado',      'arrancó y se detuvo',           'gris',    null,  'arriba', 30, null),
  ('terminado',    'Terminado',    'no hay más que hacer',          'naranja', null,  'abajo',  40, null),
  ('perdido',      'Perdido',      'salió mal o se descartó',       'rojo',    null,  'abajo',  50, null);

alter table columnas_tablero enable row level security;
create policy columnas_lectura on columnas_tablero for select to authenticated using (true);
grant select on columnas_tablero to authenticated;

-- ------------------------------------------------------------
-- Editarlas: renombrar, mover, y pasar de arriba a abajo.
--
-- No se pueden crear ni borrar: cada una es un recorte de un color que
-- la base ya define, y un color nuevo rompería reglas que existen por
-- buenas razones. Lo que sí cambia es cómo se llaman, en qué orden se
-- miran y si molestan todos los días o viven plegadas al pie.
-- ------------------------------------------------------------

create or replace function renombrar_columna(p_clave text, p_etiqueta text, p_ayuda text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_direccion() then
    raise exception 'Solo dirección cambia las columnas';
  end if;
  if trim(p_etiqueta) = '' then
    raise exception 'La columna necesita un nombre';
  end if;
  update columnas_tablero
     set etiqueta = trim(p_etiqueta), ayuda = trim(p_ayuda)
   where clave = p_clave;
end;
$$;

create or replace function mover_columna(p_clave text, p_hacia integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden integer; v_zona text; v_vecina text; v_otro integer;
begin
  if not es_direccion() then
    raise exception 'Solo dirección cambia las columnas';
  end if;

  select orden, zona into v_orden, v_zona from columnas_tablero where clave = p_clave;
  if v_orden is null then return; end if;

  -- Solo se mueve dentro de su zona: cruzar de arriba a abajo es otra
  -- decisión y tiene su propio control.
  if p_hacia < 0 then
    select clave, orden into v_vecina, v_otro from columnas_tablero
     where zona = v_zona and orden < v_orden order by orden desc limit 1;
  else
    select clave, orden into v_vecina, v_otro from columnas_tablero
     where zona = v_zona and orden > v_orden order by orden asc limit 1;
  end if;

  if v_vecina is null then return; end if;

  update columnas_tablero set orden = v_otro  where clave = p_clave;
  update columnas_tablero set orden = v_orden where clave = v_vecina;
end;
$$;

create or replace function cambiar_zona(p_clave text, p_zona text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_direccion() then
    raise exception 'Solo dirección cambia las columnas';
  end if;
  if p_zona not in ('arriba', 'abajo') then
    raise exception 'La zona es arriba o abajo';
  end if;
  update columnas_tablero set zona = p_zona where clave = p_clave;
end;
$$;

grant execute on function renombrar_columna(text, text, text) to authenticated;
grant execute on function mover_columna(text, integer) to authenticated;
grant execute on function cambiar_zona(text, text) to authenticated;
