-- ------------------------------------------------------------------
-- Cuánto es eso en pesos.
--
-- v_mi_posicion agrupa por moneda, así que nunca sumó pesos con
-- dólares —eso está bien y se queda—. Lo que faltaba es poder ver todo
-- junto: alguien con una parte en pesos y otra en dólares no tenía
-- forma de saber cuánto le toca en total sin sacar la cuenta aparte.
--
-- La conversión usa el dólar de CADA proyecto, no uno general. Es el
-- punto de tener casa_cotizacion: si un cliente pactó al oficial y otro
-- al blue, valuar los dos al mismo dólar da un número que no le sirve a
-- nadie. Y si el proyecto tiene una cotización pactada, se usa ésa y no
-- se mueve: eso es justamente lo que significa pactar.
--
-- El equivalente se calcula por porción y recién después se suma. Al
-- revés —sumar y convertir— daría mal en cuanto dos proyectos usen
-- dólares distintos.
-- ------------------------------------------------------------------

create or replace function cotizacion_del_proyecto(p_proyecto uuid, p_fecha date default current_date)
returns numeric
language sql stable
as $$
  select case
    when p.casa_cotizacion = 'pactado' then p.cotizacion_pactada
    else cotizacion_de('USD', p.casa_cotizacion, p_fecha)
  end
  from proyectos p where p.id = p_proyecto;
$$;

grant execute on function cotizacion_del_proyecto(uuid, date) to authenticated;

comment on function cotizacion_del_proyecto is
  'A qué dólar se valúa este trabajo. Pactado no se mueve: para eso se pacta.';


drop view if exists v_mi_posicion;
create view v_mi_posicion
with (security_invoker = true)
as
select
  pa.persona_id,
  po.moneda,
  sum(po.monto) filter (where po.estado = 'comprometido') as comprometido,
  sum(po.monto) filter (where po.estado = 'devengado')    as devengado,
  sum(po.monto) filter (where po.estado = 'a_liquidar')   as a_liquidar,
  sum(po.monto) filter (where po.estado = 'liquidado')    as liquidado,
  count(distinct pa.proyecto_id)                          as proyectos,
  -- Lo mismo en pesos, convertido con el dólar de cada proyecto.
  -- Null si alguna no se pudo convertir: un total incompleto que se
  -- presenta como completo es peor que no mostrarlo.
  sum(case when po.moneda = 'ARS' then po.monto
           else po.monto * cotizacion_del_proyecto(h.proyecto_id) end)
    filter (where po.estado = 'a_liquidar')               as a_liquidar_ars,
  sum(case when po.moneda = 'ARS' then po.monto
           else po.monto * cotizacion_del_proyecto(h.proyecto_id) end)
    filter (where po.estado = 'devengado')                as devengado_ars
from porciones po
join participaciones pa on pa.id = po.participacion_id
join hitos h            on h.id = po.hito_id
group by pa.persona_id, po.moneda;

grant select on v_mi_posicion to authenticated;
