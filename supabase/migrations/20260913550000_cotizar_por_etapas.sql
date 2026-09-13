-- ------------------------------------------------------------------
-- Cotizar una oportunidad por etapas, y elegir cuáles arrancan.
--
-- No hace falta oportunidad_etapas. Una cotización por etapas ya es una
-- lista de hitos: título, monto, moneda y orden, que es exactamente lo
-- que la tabla tiene. Y una tabla paralela habría que copiarla a hitos
-- al ganar, con lo que a partir de ahí existirían dos versiones del
-- mismo presupuesto que se separan en cuanto alguien corrija un número
-- de un solo lado.
--
-- Lo que faltaba es una distinción que la tabla no hacía: un hito
-- cotizado no es lo mismo que un hito que se va a ejecutar. El primero
-- es una propuesta y no compromete a nadie; el segundo es trabajo que
-- alguien tiene que hacer y plata que alguien va a cobrar.
--
-- Por eso "activo". Mientras está en falso el hito existe, se ve y se
-- suma como propuesta, pero no genera porciones para el equipo ni entra
-- en la previsión de cobros. Al ganar se eligen cuáles se activan, y
-- los que quedan siguen ahí como lo que son: cosas ya cotizadas que el
-- cliente puede pedir más adelante.
-- ------------------------------------------------------------------

alter table hitos add column if not exists activo boolean not null default true;

comment on column hitos.activo is
  'Falso mientras es solo una cotización: se ve y se suma como propuesta, pero no genera porciones ni entra en la previsión de cobros.';

-- Una etapa inactiva no reparte plata entre nadie.
create or replace function recalcular_porciones(p_hito uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h hitos%rowtype;
begin
  select * into v_h from hitos where id = p_hito;
  if not found then return; end if;

  -- Se borran siempre: si el hito se desactiva, las porciones que había
  -- tienen que irse, no quedarse colgadas prometiendo plata.
  delete from porciones
   where hito_id = p_hito and estado = 'comprometido';

  if not v_h.activo then return; end if;

  insert into porciones (hito_id, participacion_id, monto, moneda, estado)
  select v_h.id, pa.id,
         round(coalesce(v_h.monto_neto, 0) * pa.porcentaje / 100, 2),
         v_h.moneda, 'comprometido'
    from participaciones pa
   where pa.proyecto_id = v_h.proyecto_id
     and not exists (select 1 from porciones po
                      where po.hito_id = v_h.id and po.participacion_id = pa.id);
end;
$$;

drop trigger if exists hitos_activan_porciones on hitos;
create trigger hitos_activan_porciones
  after update of activo on hitos
  for each row execute function porciones_al_cambiar_hito();


-- ------------------------------------------------------------------
-- Ganar eligiendo qué arranca.
--
-- Si la oportunidad ya está cotizada por etapas, se activan las que se
-- eligen y no se generan hitos del esquema: ya hay un presupuesto y
-- pisarlo con un 50/50 genérico sería tirar lo que se acordó.
--
-- Si no tiene etapas, sigue funcionando como antes.
-- ------------------------------------------------------------------

create or replace function ganar_oportunidad(
  p_proyecto uuid,
  p_esquema esquema_cobro default 'cincuenta_cincuenta',
  p_activar uuid[] default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_cotizados integer;
begin
  if not (ve_todo() or participa_en(p_proyecto)) then
    raise exception 'No tenés permiso sobre esta oportunidad.';
  end if;

  select count(*) into v_cotizados from hitos where proyecto_id = p_proyecto;

  update proyectos
     set etapa = 'ganado', color = 'verde', subestado = 'en_curso',
         motivo_gris = null, esquema_cobro = p_esquema,
         fecha_inicio = coalesce(fecha_inicio, current_date),
         proxima_accion = null, proximo_seguimiento = null
   where id = p_proyecto;

  if v_cotizados = 0 then
    perform generar_hitos(p_proyecto, p_esquema);
    return;
  end if;

  -- Sin lista, arrancan todas: es lo que uno espera si cotizó tres
  -- etapas y vendió las tres.
  update hitos
     set activo = (p_activar is null or id = any(p_activar))
   where proyecto_id = p_proyecto;
end;
$$;

grant execute on function ganar_oportunidad(uuid, esquema_cobro, uuid[]) to authenticated;


-- ------------------------------------------------------------------
-- Lo cotizado y todavía no activado, por cliente.
--
-- Es la lista de lo que ya se le presupuestó y no se le vendió: la
-- conversación más fácil que tiene un comercial, porque el precio ya
-- está acordado y el cliente ya lo vio.
-- ------------------------------------------------------------------

drop view if exists v_precotizado;
create view v_precotizado
with (security_invoker = true)
as
select
  h.id            as hito_id,
  h.proyecto_id,
  p.codigo,
  p.nombre        as trabajo,
  p.organizacion_id,
  o.nombre_canonico as cliente,
  p.etapa,
  p.color,
  h.orden,
  h.titulo        as etapa_nombre,
  h.entregable,
  h.monto_neto,
  h.moneda,
  h.vence_at,
  (p.etapa = 'ganado' or p.etapa is null) as ya_es_proyecto
from hitos h
join proyectos p      on p.id = h.proyecto_id
join organizaciones o on o.id = p.organizacion_id
where h.activo = false
  and p.archivado_at is null;

grant select on v_precotizado to authenticated;

comment on view v_precotizado is
  'Etapas cotizadas que todavía no arrancaron. El precio ya está acordado y el cliente ya lo vio: es la venta más fácil que hay.';
