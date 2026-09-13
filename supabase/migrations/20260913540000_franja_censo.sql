-- ------------------------------------------------------------------
-- La franja pasa a ser un censo, no una lista de alarmas.
--
-- Tenía cuatro señales y tres eran alarmas: atrasados, sin novedades,
-- por cobrar. Una alarma que está en cero todos los días deja de
-- leerse, y cuando alguna vez se enciende ya nadie la mira. Peor: "sin
-- novedades" aparecía como dato destacado en varias pantallas sin serlo
-- —es algo que se revisa cuando uno entra a proyectos, no algo que
-- tenga que estar gritando todo el tiempo—.
--
-- Ahora cuenta: cuántos proyectos hay y en qué estado, cuántos abonos,
-- cuántas oportunidades. Eso no cambia de color ni pide nada: ubica.
-- Lo que hay que atender sigue estando en Hoy, que es la pantalla que
-- existe para eso.
--
-- El desglose por estado sale de las columnas del tablero, no de una
-- lista escrita acá: si mañana se agrega o se borra una columna, la
-- franja la refleja sin que nadie venga a tocarla.
-- ------------------------------------------------------------------

drop view if exists v_estado_general;
create view v_estado_general
with (security_invoker = true)
as
select
  -- Proyectos vivos, con el reparto por columna del tablero.
  (select count(*) from proyectos p
    where p.tipo = 'proyecto' and (p.etapa is null or p.etapa = 'ganado')
      and p.archivado_at is null
      and exists (select 1 from columnas_tablero c
                   where c.zona = 'arriba' and cae_en_columna(p.id, c.clave))) as proyectos,

  (select coalesce(jsonb_agg(jsonb_build_object('etiqueta', x.etiqueta, 'n', x.n)
                             order by x.orden), '[]'::jsonb)
     from (select c.etiqueta, c.orden,
                  (select count(*) from proyectos p
                    where p.tipo = 'proyecto' and (p.etapa is null or p.etapa = 'ganado')
                      and p.archivado_at is null and cae_en_columna(p.id, c.clave)) as n
             from columnas_tablero c where c.zona = 'arriba') x
    where x.n > 0) as por_estado,

  -- Abonos en producción: verdes y con la vigencia arrancada.
  (select count(*) from proyectos p
    where p.tipo = 'mantenimiento' and p.color = 'verde' and p.archivado_at is null
      and (p.vigencia_desde is null or p.vigencia_desde <= current_date)) as abonos,

  -- Oportunidades abiertas.
  (select count(*) from proyectos p
    where p.color = 'amarillo' and p.etapa is not null and p.etapa <> 'ganado'
      and p.archivado_at is null) as en_pipeline;

grant select on v_estado_general to authenticated;

comment on view v_estado_general is
  'Un censo para la franja: cuántos proyectos y en qué estado, cuántos abonos, cuántas oportunidades. Sin alarmas: lo que hay que atender vive en Hoy.';
