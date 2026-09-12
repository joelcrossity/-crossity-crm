-- ------------------------------------------------------------------
-- Fusionar dos clientes que son el mismo.
--
-- El esquema ya era el correcto: proyectos.organizacion_id es una clave
-- foránea a organizaciones, y un cliente ya podía tener N proyectos. Lo
-- que pasó es más simple y más difícil de ver: se cargó dos veces el
-- mismo cliente con el nombre escrito distinto —"Leffler Dietz" y
-- "Leffler - Dietz"—, y desde ahí cada uno se llevó sus proyectos.
--
-- La fusión recorre las claves foráneas declaradas en vez de tener la
-- lista de tablas escrita acá. Hoy son trece; la lista a mano queda
-- vieja la primera vez que alguien agrega una tabla, y el síntoma
-- aparece meses después como un dato que quedó colgado del cliente que
-- ya no existe.
--
-- El nombre viejo no se tira: queda como alias del que sobrevive. Sin
-- eso, el que vuelve a escribirlo así lo vuelve a crear, y estamos en
-- el mismo lugar.
-- ------------------------------------------------------------------

create or replace function fusionar_clientes(p_de uuid, p_hacia uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_nombre text;
begin
  if p_de = p_hacia then
    raise exception 'Es el mismo cliente.';
  end if;

  if not exists (select 1 from organizaciones where id = p_de)
     or not exists (select 1 from organizaciones where id = p_hacia) then
    raise exception 'Alguno de los dos clientes ya no existe.';
  end if;

  select nombre_canonico into v_nombre from organizaciones where id = p_de;

  -- Todo lo que apunta al que se va, pasa a apuntar al que queda.
  for r in
    select tc.table_name as tabla, k.column_name as col
    from information_schema.table_constraints tc
    join information_schema.key_column_usage k
      on k.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage c
      on c.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and c.table_name = 'organizaciones'
      and c.column_name = 'id'
      and tc.table_schema = 'public'
  loop
    execute format('update public.%I set %I = $1 where %I = $2', r.tabla, r.col, r.col)
      using p_hacia, p_de;
  end loop;

  -- El nombre viejo sobrevive como alias, para que no se vuelva a crear.
  update organizaciones
     set alias = (
       select array_agg(distinct a)
       from unnest(coalesce(alias, '{}') || array[v_nombre]) a
       where a is not null and a <> nombre_canonico
     )
   where id = p_hacia;

  delete from organizaciones where id = p_de;
end;
$$;

comment on function fusionar_clientes is
  'Pasa todo de un cliente a otro y borra el que sobra, guardando su nombre como alias. Recorre las claves foráneas para no olvidarse ninguna tabla.';

revoke execute on function fusionar_clientes(uuid, uuid) from public;
grant execute on function fusionar_clientes(uuid, uuid) to authenticated;


-- ------------------------------------------------------------------
-- Los que probablemente son el mismo.
--
-- Compara los nombres sin mayúsculas, sin tildes, sin puntuación y sin
-- el sufijo societario: así "Leffler - Dietz" y "Leffler Dietz" caen en
-- la misma clave. También mira los alias, porque el nombre viejo de una
-- fusión anterior tiene que seguir atrapando al que lo vuelva a
-- escribir.
--
-- Propone, no fusiona. Dos clientes con nombre parecido pueden ser dos
-- empresas distintas, y eso lo sabe una persona, no una consulta.
-- ------------------------------------------------------------------

create or replace function clave_cliente(p_nombre text)
returns text
language sql
immutable
as $$
  select regexp_replace(
           regexp_replace(
             translate(lower(coalesce(p_nombre, '')), 'áéíóúüñ', 'aeiouun'),
             '\y(s\.?a\.?s?|s\.?r\.?l|srl|sas|sa|ltda|ltd|inc|group|grupo)\y', '', 'g'),
           '[^a-z0-9]', '', 'g');
$$;

drop view if exists v_clientes_repetidos;
create view v_clientes_repetidos
with (security_invoker = true)
as
with claves as (
  select o.id, o.nombre_canonico, o.es_provisoria,
         clave_cliente(o.nombre_canonico) as clave,
         (select count(*) from proyectos p where p.organizacion_id = o.id) as proyectos,
         o.created_at
  from organizaciones o
  where clave_cliente(o.nombre_canonico) <> ''
)
select clave,
       count(*)                                          as cuantos,
       sum(proyectos)                                    as proyectos,
       (array_agg(id        order by proyectos desc, created_at))[1] as quedaria,
       (array_agg(nombre_canonico order by proyectos desc, created_at))[1] as nombre,
       array_agg(id             order by proyectos desc, created_at) as ids,
       array_agg(nombre_canonico order by proyectos desc, created_at) as nombres,
       array_agg(proyectos      order by proyectos desc, created_at) as cuantos_cada_uno
from claves
group by clave
having count(*) > 1;

grant select on v_clientes_repetidos to authenticated;

comment on view v_clientes_repetidos is
  'Clientes que probablemente son el mismo escrito distinto. Propone cuál dejar: el que más proyectos tiene. No fusiona nada.';
