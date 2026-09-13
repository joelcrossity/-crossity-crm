-- ------------------------------------------------------------------
-- El CUIT como identificador, normalizado y único.
--
-- No hace falta una columna nueva: el CUIT ya vive en dos lugares y los
-- dos tienen razón de ser. razones_sociales.cuit es el de cada entidad
-- legal —un cliente puede facturar por dos sociedades distintas, y cada
-- una tiene el suyo— y organizaciones.cuit es el atajo para el caso
-- simple, que es casi siempre uno solo. Agregar identificacion_fiscal
-- sería un tercer lugar donde vive el mismo dato.
--
-- Lo que faltaba es que "30-71234567-8" y "30712345678" se reconozcan
-- como el mismo número. Eso lo resuelve una columna generada: se
-- calcula sola en cada escritura, así que no hay forma de que se
-- desincronice del valor que la persona cargó.
--
-- Y sobre ella va el índice único, que es lo que de verdad impide el
-- duplicado. Sin él, la validación viviría solo en la pantalla, y una
-- validación que solo vive en la pantalla se saltea sin querer: dos
-- personas cargando el mismo cliente al mismo tiempo pasan las dos.
--
-- Una cosa que NO se puede hacer todavía: exigirlo. De las 34 razones
-- sociales cargadas, ninguna tiene CUIT. Un NOT NULL hoy rompe la carga
-- de cualquier cliente y deja la base en un estado donde nada se puede
-- editar sin completar un dato que nadie tiene a mano. Se vuelve
-- obligatorio cuando estén cargados, no antes.
-- ------------------------------------------------------------------

alter table organizaciones
  add column if not exists cuit_normalizado text
  generated always as (nullif(regexp_replace(coalesce(cuit, ''), '[^0-9]', '', 'g'), '')) stored;

alter table razones_sociales
  add column if not exists cuit_normalizado text
  generated always as (nullif(regexp_replace(coalesce(cuit, ''), '[^0-9]', '', 'g'), '')) stored;

create unique index if not exists organizaciones_cuit_unico
  on organizaciones (cuit_normalizado) where cuit_normalizado is not null;

create unique index if not exists razones_cuit_unico
  on razones_sociales (cuit_normalizado) where cuit_normalizado is not null;

comment on column organizaciones.cuit_normalizado is
  'El CUIT sin puntos ni guiones, calculado solo. Sobre esto va el índice único: es lo que impide cargar dos veces el mismo número escrito distinto.';


-- ------------------------------------------------------------------
-- Quién tiene ese CUIT.
--
-- Busca en los dos lugares y devuelve la cuenta, para que el selector
-- pueda decir "ya existe, es éste" en vez de dejar que el índice único
-- reviente con un error que nadie entiende.
--
-- Definer a propósito: tiene que encontrar al cliente aunque quien
-- pregunta no lo vea. Si no, alguien que no ve la cuenta de otro área
-- intentaría crear el duplicado, el índice lo frenaría, y el mensaje
-- sería "ya existe" sin poder decir cuál. Devuelve solo el nombre, que
-- es lo mínimo para poder pedir que se lo asignen.
-- ------------------------------------------------------------------

create or replace function cliente_con_cuit(p_cuit text)
returns table (id uuid, nombre text, donde text)
language sql
stable
security definer
set search_path = public
as $$
  with limpio as (select nullif(regexp_replace(coalesce(p_cuit,''), '[^0-9]', '', 'g'), '') as c)
  select o.id, o.nombre_canonico, 'la cuenta'::text
    from organizaciones o, limpio
   where o.cuit_normalizado = limpio.c
  union
  select r.organizacion_id, o.nombre_canonico, 'la razón social ' || r.razon_social
    from razones_sociales r
    join organizaciones o on o.id = r.organizacion_id, limpio
   where r.cuit_normalizado = limpio.c
  limit 5;
$$;

grant execute on function cliente_con_cuit(text) to authenticated;


-- ------------------------------------------------------------------
-- El CUIT llega al selector y a la cuenta corriente.
-- ------------------------------------------------------------------

create or replace view v_cuenta
with (security_invoker = true)
as
 SELECT o.id,
    o.codigo,
    o.nombre_canonico AS cuenta,
    ( SELECT count(*) AS count
           FROM razones_sociales r
          WHERE r.organizacion_id = o.id) AS razones_sociales,
    ( SELECT string_agg(m.nombre, ' · '::text ORDER BY m.nombre) AS string_agg
           FROM marcas m
          WHERE m.organizacion_id = o.id) AS marcas,
    count(*) FILTER (WHERE p.color = 'verde'::color_estado) AS en_vivo,
    count(*) FILTER (WHERE p.color = 'amarillo'::color_estado) AS en_pipeline,
    count(*) FILTER (WHERE p.tipo = 'mantenimiento'::tipo_trabajo AND (p.color <> ALL (ARRAY['rojo'::color_estado, 'naranja'::color_estado]))) AS abonos,
    count(*) FILTER (WHERE p.condicion = 'bonificado'::condicion_comercial) AS bonificados,
    count(*) AS proyectos_totales,
    coalesce(o.alias, '{}') AS alias,
    o.cuit,
    -- Todos los CUIT del cliente, el de la cuenta y los de sus
    -- sociedades: el selector tiene que encontrarlo por cualquiera.
    ( SELECT array_remove(array_agg(distinct x), null)
        FROM unnest(
               array[o.cuit_normalizado] ||
               coalesce((select array_agg(r.cuit_normalizado)
                           from razones_sociales r
                          where r.organizacion_id = o.id), '{}')
             ) x ) AS cuits
   FROM organizaciones o
     LEFT JOIN proyectos p ON p.organizacion_id = o.id
  GROUP BY o.id, o.codigo, o.nombre_canonico, o.alias, o.cuit, o.cuit_normalizado;

grant select on v_cuenta to authenticated;
