-- ------------------------------------------------------------------
-- El abono, cotizado junto con el proyecto.
--
-- La propuesta de AMCAP lo trae y el sistema lo perdía: después del
-- desarrollo hay una página de planes de mantenimiento con su precio
-- mensual. Se cotiza ahí, el cliente lo aprueba ahí, y cuando el
-- proyecto termina alguien tiene que acordarse de a cuánto se había
-- acordado. Si no se acuerda, se abre el abono con un número inventado
-- o no se abre.
--
-- Entonces un componente puede ser recurrente: su monto es por mes, no
-- por una vez. No suma al total del proyecto —son dos plata distintas y
-- sumarlas daría un número que no es ninguno de los dos— y se muestra
-- aparte, que es como lo muestra la propuesta.
--
-- Al terminar el proyecto, abrir el mantenimiento propone ese monto: ya
-- estaba acordado, no hay que recordarlo ni volver a negociarlo.
-- ------------------------------------------------------------------

alter table componentes add column if not exists recurrente boolean not null default false;

comment on column componentes.recurrente is
  'Su monto es por mes, no por una vez. No suma al total del proyecto: es el abono que arranca cuando el trabajo termina.';

-- Un recurrente sin precio no tiene sentido: lo que se cotiza es
-- justamente cuánto sale por mes.
alter table componentes drop constraint if exists componente_coherente;
alter table componentes add constraint componente_coherente check (
  (estado = 'cotizado'    and monto is not null and monto > 0) or
  (estado = 'bonificado'  and monto is not null and monto >= 0) or
  (estado = 'sin_cotizar' and monto is null and not recurrente)
);


-- v_etapas_descuadradas cuelga de ésta: se recrea al final.
drop view if exists v_etapas_descuadradas;
drop view if exists v_cotizacion;
create view v_cotizacion
with (security_invoker = true)
as
select
  e.id as etapa_id, e.proyecto_id, p.codigo,
  o.nombre_canonico as cliente,
  e.orden, e.nombre, e.alcance,

  (select count(*) from componentes c where c.etapa_id = e.id)                     as componentes,
  -- El total por una vez: lo recurrente no entra.
  (select coalesce(sum(c.monto), 0) from componentes c
    where c.etapa_id = e.id and c.estado = 'cotizado' and not c.recurrente)        as total,
  (select coalesce(sum(c.monto), 0) from componentes c
    where c.etapa_id = e.id and c.estado = 'bonificado' and not c.recurrente)      as bonificado,
  -- Y lo que va a entrar todos los meses cuando esto termine.
  (select coalesce(sum(c.monto), 0) from componentes c
    where c.etapa_id = e.id and c.recurrente and c.estado <> 'sin_cotizar')        as mensual,
  (select count(*) from componentes c
    where c.etapa_id = e.id and c.estado = 'sin_cotizar')                          as sin_cotizar,
  (select min(c.moneda) from componentes c where c.etapa_id = e.id)                as moneda,

  (select count(*) from hitos h where h.etapa_id = e.id)                           as cuotas,
  (select coalesce(sum(h.monto_neto), 0) from hitos h where h.etapa_id = e.id)     as repartido,
  (select bool_and(h.activo) from hitos h where h.etapa_id = e.id)                 as arrancada,
  (select bool_or(h.activo) from hitos h where h.etapa_id = e.id)                  as arrancada_en_parte
from etapas_cotizacion e
join proyectos p      on p.id = e.proyecto_id
join organizaciones o on o.id = p.organizacion_id;

grant select on v_cotizacion to authenticated;


-- Cuánto se cotizó de abono para un proyecto, sumando todas sus etapas.
-- Lo usa el ofrecimiento al terminar: el monto ya está acordado.
create or replace function abono_cotizado(p_proyecto uuid)
returns numeric
language sql stable
as $$
  select coalesce(sum(c.monto), 0)
    from componentes c
    join etapas_cotizacion e on e.id = c.etapa_id
   where e.proyecto_id = p_proyecto
     and c.recurrente and c.estado <> 'sin_cotizar';
$$;

grant execute on function abono_cotizado(uuid) to authenticated;

comment on function abono_cotizado is
  'El mensual que se cotizó junto con el proyecto. Al terminar, es el monto que se propone para abrir el abono: ya estaba acordado.';


-- v_tablero lo trae, para que el ofrecimiento al soltar en Terminado
-- venga con el monto puesto en vez de vacío.
create or replace view v_tablero
with (security_invoker = true)
as
select
  p.id, p.codigo, p.nombre,
  o.nombre_canonico as cliente,
  o.codigo          as cliente_codigo,
  p.color, p.subestado, p.motivo_gris, p.prioridad, p.fecha_comprometida,
  p.es_producto_propio, p.condicion, p.tipo,
  r.nombre          as responsable,
  (current_date - p.fecha_comprometida) as dias_de_atraso,
  cerrado_at(p.id, p.color::text) as cerrado_at,
  extract(day from now() - coalesce(
      (select max(a.ocurrido_at) from actualizaciones a where a.proyecto_id = p.id),
      p.created_at))::int as dias_sin_novedades,
  p.motivo_rojo,
  p.organizacion_id, p.responsable_id, p.fecha_inicio, p.monto_neto, p.descripcion,
  (ve_todo() or participa_en(p.id)) as puedo_editar,
  exists (select 1 from proyectos m where m.origen_id = p.id) as tiene_abono,
  abono_cotizado(p.id) as abono_cotizado
from proyectos p
join organizaciones o on o.id = p.organizacion_id
left join personas r  on r.id = p.responsable_id
where p.tipo = 'proyecto'
  and (p.etapa is null or p.etapa = 'ganado')
  and p.archivado_at is null;

grant select on v_tablero to authenticated;


drop view if exists v_etapas_descuadradas;
create view v_etapas_descuadradas
with (security_invoker = true)
as
select
  v.etapa_id, v.proyecto_id, v.codigo, v.cliente, v.nombre,
  v.total, v.repartido, (v.total - v.repartido) as diferencia, v.moneda
from v_cotizacion v
where v.cuotas > 0 and abs(v.total - v.repartido) > 0.01;

grant select on v_etapas_descuadradas to authenticated;
