-- ------------------------------------------------------------------
-- El que abre un proyecto tiene que poder verlo.
--
-- Santiago tenía el permiso —el servidor lo confirmó en pantalla, con
-- sus tres roles— y el alta rebotaba igual con un error de permisos.
-- Las dos cosas eran ciertas: el permiso estaba bien y el rechazo
-- también. Lo que estaba mal era de qué hablaba el rechazo.
--
-- El alta escribe y pide la fila de vuelta, porque necesita el código
-- para llevarte al proyecto recién creado. Y para devolverla, la base
-- tiene que dejarte leerla. La regla de lectura decía: podés verlo si
-- sos el responsable, si estás asignado o si tenés parte. Ninguna de
-- las tres se cumple en el instante del alta cuando pusiste a otro de
-- responsable: la asignación del creador existe, pero la escribe un
-- trigger AFTER, y esos corren cuando la sentencia ya terminó.
--
-- Así que la fila entraba y era invisible para quien acababa de
-- escribirla. La base lo reporta como lo único que puede: violación de
-- una regla de fila en proyectos. El sistema lo traducía a "no tenés
-- permiso para crear", que era la traducción razonable del caso
-- frecuente y la equivocada para este.
--
-- Por eso nunca lo pude reproducir: en mis pruebas dejaba el
-- responsable vacío, el trigger me ponía a mí, y la fila me quedaba
-- visible. El pozo se abre solo si elegís a otro, que es justo lo que
-- hace un project manager cuando abre trabajo para su equipo.
--
-- Se arregla anotando quién lo abrió. No existía esa columna: el
-- creador quedaba solo en eventos y en una asignación que llega tarde.
-- Es un dato que el sistema debería tener igual, más allá de este
-- error: quién trajo cada proyecto es la pregunta de todas las
-- reuniones de equipo.
-- ------------------------------------------------------------------

alter table proyectos
  add column if not exists creado_por uuid references personas(id);

comment on column proyectos.creado_por is
  'Quién lo abrió. Se anota solo y no cambia: el responsable puede pasar de mano, el que lo trajo no.';


-- El creador se anota siempre, sea o no el responsable. Antes solo se
-- deducía de quién había quedado a cargo, y eso se pierde en cuanto el
-- proyecto cambia de mano.
create or replace function quien_crea_es_responsable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin persona detrás —una migración, el service role— no hay a quién
  -- poner, y forzar uno sería inventar un dueño.
  if new.creado_por is null then
    new.creado_por := persona_actual();
  end if;

  if new.responsable_id is null then
    new.responsable_id := persona_actual();
  end if;

  return new;
end;
$$;


-- Las de antes, más la que faltaba. Se mira la columna de la fila que
-- se está evaluando y no se vuelve a consultar proyectos: es la misma
-- razón por la que esta regla ya se había reescrito una vez.
drop policy if exists proyectos_lectura on proyectos;
create policy proyectos_lectura on proyectos
  for select to authenticated
  using (
    ve_todo()
    or creado_por = persona_actual()
    or responsable_id = persona_actual()
    or exists (select 1 from asignaciones a
                where a.proyecto_id = proyectos.id
                  and a.persona_id = persona_actual()
                  and a.hasta is null)
    or exists (select 1 from participaciones pa
                where pa.proyecto_id = proyectos.id
                  and pa.persona_id = persona_actual())
  );


-- Lo ya existente se queda en nulo a propósito. Quién abrió cada
-- proyecto viejo no está en ninguna columna, y completarlo con el
-- responsable de hoy sería escribir como dato algo que es una
-- suposición. Ninguno cambia de visibilidad por esto: siguen entrando
-- por las otras cuatro vías, igual que hasta ahora.
