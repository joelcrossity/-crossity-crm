-- ------------------------------------------------------------------
-- La bitácora: qué se le entregó a cada proyecto y cuándo.
--
-- Hoy eso no está en ningún lado. Se hace una mejora, se arregla un
-- error, se suma una función, y queda en el chat de WhatsApp del que la
-- hizo. A fin de mes, cuando el cliente del abono pregunta qué se hizo
-- con su plata, hay que reconstruirlo de memoria y de los commits. Se
-- reconstruye mal y se reconstruye de menos: lo chico se olvida, y lo
-- chico sumado es la mitad del mes.
--
-- Es distinta de actualizaciones, que está al lado y podría confundirse.
-- Esa registra lo que se habló —tiene canal: whatsapp, mail, llamada— y
-- es la conversación con el cliente. Esta registra lo que se hizo, y su
-- público es el informe de fin de mes. No hay que fusionarlas: una nota
-- de que el cliente llamó preguntando no es una entrega, y una entrega
-- no siempre se habla.
--
-- visibilidad_cliente existe porque no todo lo que se hace se cuenta.
-- Migrar un servidor porque el anterior se estaba cayendo es trabajo
-- real y no es algo que uno quiera poner en el resumen mensual. Nace
-- en verdadero porque el caso normal es que sí se cuenta, y lo que se
-- esconde es la excepción.
-- ------------------------------------------------------------------

create type tipo_bitacora as enum (
  'mejora', 'bugfix', 'nueva_funcionalidad', 'soporte'
);

create table bitacora (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references proyectos(id) on delete cascade,
  tipo          tipo_bitacora not null default 'mejora',
  titulo        text not null,
  descripcion   text,
  -- Cuándo se entregó, que no es cuándo se anotó: se carga los viernes
  -- lo que se hizo en la semana, y la fecha que importa es la de verdad.
  fecha_entrega date not null default current_date,
  creado_por    uuid references personas(id) on delete set null,
  visibilidad_cliente boolean not null default true,
  created_at    timestamptz not null default now(),

  constraint titulo_no_vacio check (length(trim(titulo)) > 0)
);

create index bitacora_por_proyecto on bitacora (proyecto_id, fecha_entrega desc);

comment on table bitacora is
  'Qué se entregó en cada proyecto. Distinta de actualizaciones, que registra lo que se habló con el cliente.';
comment on column bitacora.visibilidad_cliente is
  'Si entra en el resumen que ve el cliente. Falso para el trabajo real que no se cuenta.';
comment on column bitacora.fecha_entrega is
  'Cuándo se entregó, no cuándo se anotó. Se carga después y la fecha que importa es la de verdad.';


-- El autor se pone solo. Pedirlo sería dejar que alguien anote a nombre
-- de otro, y que se olvide de ponerlo cuando tiene apuro.
create or replace function bitacora_autor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.creado_por is null then
    new.creado_por := persona_actual();
  end if;
  return new;
end;
$$;

create trigger bitacora_quien_anota
  before insert on bitacora
  for each row execute function bitacora_autor();


alter table bitacora enable row level security;

-- Se lee y se escribe sobre lo propio, como las entregas. Quien trabaja
-- en el proyecto anota lo que hizo; quien no, no tiene nada que anotar.
create policy bitacora_lectura on bitacora
  for select to authenticated
  using (ve_todo() or participa_en(proyecto_id));

create policy bitacora_alta on bitacora
  for insert to authenticated
  with check (ve_todo() or participa_en(proyecto_id));

create policy bitacora_cambio on bitacora
  for update to authenticated
  using (ve_todo() or participa_en(proyecto_id))
  with check (ve_todo() or participa_en(proyecto_id));

-- Borrar es más estrecho que corregir: una entrega anotada y borrada
-- desaparece del resumen del mes sin dejar rastro. Quien la escribió
-- puede sacarla —se equivocó de proyecto, pasa— y dirección también.
create policy bitacora_baja on bitacora
  for delete to authenticated
  using (es_direccion() or creado_por = persona_actual());

grant select, insert, update, delete on bitacora to authenticated;
